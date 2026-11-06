<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { ApiError } from '@/lib/request'
import { bomRatio } from '@/lib/bomRatio'
import { readBomTree, previewBomTree, confirmBomTree, type Line, type Node, type Plan, type Open, type Change, type Preview } from '@/api/basic/bomTree'
import type { Row } from '@/lib/crud'
import MaterialPicker from './MaterialPicker.vue'
import QuantityInput from './QuantityInput.vue'
import BomVersionSelect from './BomVersionSelect.vue'
const props = defineProps<{ source?: string;material: Row }>(), emit = defineEmits<{ close: [] }>()
const root = ref(''), nodes = ref<Record<string, Node>>({}), names = ref<Record<string, string>>({}), statuses = ref<Record<string, string>>({})
const picker = ref<InstanceType<typeof MaterialPicker>>(), busy = ref(false), error = ref(''), selected = ref<string[]>([]), baseline = ref('')
const preview = ref<Preview>(), requestId = ref(''), collapsed = ref(new Set<string>())
const fresh = (product:string, code:string):Node => ({ key: crypto.randomUUID(), source: null, revision: null, product, code, version: '1', base: '1', remark: null, lines: [] })
function install(data:Open) { Object.assign(names.value, data.materials);Object.assign(statuses.value, data.statuses);for (const n of data.plan.nodes) if (!nodes.value[n.key])nodes.value[n.key] = n }
async function run(fn:() => Promise<void>) { if (busy.value) return;busy.value = true;error.value = '';try { await fn() } catch(e) { error.value = e instanceof Error ? e.message : '操作失败' } finally { busy.value = false } }
onMounted(() => run(async() => { if (props.source) { const d = await readBomTree(props.source);install(d);root.value = d.plan.root } else { const n = fresh(String(props.material.id), 'BOM-' + props.material.code);nodes.value[n.key] = n;root.value = n.key;names.value[n.product] = String(props.material.name) }selected.value = [root.value];baseline.value = JSON.stringify(nodes.value) }))
const active = computed(() => nodes.value[selected.value.at(-1) ?? ''])
const dirty = computed(() => baseline.value !== '' && JSON.stringify(nodes.value) !== baseline.value)
defineExpose({ dirty })
watch(nodes, () => { preview.value = undefined }, { deep: true, flush: 'sync' })
function tree() {
  type TreeRow = { path: string[];node: Node;index: number[];leaf?: Line }
  const rows:TreeRow[] = []
  function walk(k:string, path:string[], ix:number[]) {
    if (path.includes(k) || path.length >= 100 || rows.length >= 10001) return
    const n = nodes.value[k]
    if (!n) return
    const next = [...path, k]
    rows.push({ path: next, node: n, index: ix })
    if (collapsed.value.has(ix.join('/'))) return
    for (const [i, line] of n.lines.entries()) {
      if (rows.length >= 10001) break
      const index = [...ix, i]
      if (line.child) walk(line.child, next, index)
      else rows.push({ path: next, node: n, index, leaf: line })
    }
  }
  walk(root.value, [], [])
  return rows
}
const branch = ref<number[]>([]), isolatedKeys = ref(new Set<string>())
const pathIsolated = computed(() => !!active.value && isolatedKeys.value.has(active.value.key))
function split() {
  if (busy.value || !branch.value.length || pathIsolated.value) return
  let n = nodes.value[root.value]
  const path = [n.key]
  for (const i of branch.value) {
    const l = n.lines[i], copy = JSON.parse(JSON.stringify(nodes.value[l.child!])) as Node
    copy.key = crypto.randomUUID()
    l.child = copy.key
    nodes.value[copy.key] = copy
    isolatedKeys.value.add(copy.key)
    n = copy
    path.push(n.key)
  }
  selected.value = path
}
async function pick(i?:number) { const n = active.value;const m = await picker.value?.choose();if (!m) return;names.value[m.id] = m.code + ' · ' + m.name;if (i === undefined)n.lines.push({ material: m.id, quantity: '1', sort: n.lines.length, child: null });else Object.assign(n.lines[i], { material: m.id, child: null }) }
async function link(l:Line, k:string | null) { if (!k) { l.child = null;return } await run(async() => { if (!nodes.value[k])install(await readBomTree(k));l.child = k }) }
function plan():Plan { const keys = new Set<string>();function visit(k:string) { if (keys.has(k)) return;keys.add(k);for (const l of nodes.value[k].lines) if (l.child)visit(l.child) }visit(root.value);return { root: root.value, nodes: [...keys].map(k => nodes.value[k]) } }
function review() {
  return run(async() => {
    const proposed = plan()
    for (const n of proposed.nodes) {
      bomRatio(n.base)
      for (const l of n.lines) bomRatio(l.quantity)
    }
    preview.value = await previewBomTree(proposed)
    requestId.value = crypto.randomUUID()
  })
}
function save() {
  return run(async() => {
    try {
      await confirmBomTree(plan(), preview.value!.hash, requestId.value)
      emit('close')
    } catch(cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        preview.value = undefined
        throw new Error(cause.message + '。请核对版本号后重新预览；若来源版本已变化，请返回列表重新打开。', { cause })
      }
      // Keep the request ID after an uncertain network outcome so retry replays the receipt.
      throw cause
    }
  })
}
const actions:Record<string, string> = { CREATE: '新建草稿', EDIT: '更新草稿', COPY: '复制并修订', REUSE: '复用', SHARE: '共享修订结果' }
function summary(lines:Line[], proposed = false) { return lines.map(l => (names.value[l.material] ?? l.material) + ' × ' + l.quantity + (l.child ? ' [' + ((proposed ? preview.value?.changes.find(c => c.key === l.child)?.version : undefined) ?? preview.value?.original.nodes.find(n => n.key === l.child)?.version ?? nodes.value[l.child]?.version ?? l.child) + ']' : '')).join('；') || '无组件' }
function metadata(c:Change) {
  const next = nodes.value[c.key]
  const prev = preview.value?.original.nodes.find(n => n.source === next.source)
  const edits:string[] = []
  if (!prev || String(prev.base) !== String(next.base)) edits.push('产出基准：' + (prev?.base ?? '无') + ' → ' + next.base)
  if (prev?.remark !== next.remark && (prev?.remark || next.remark)) edits.push('备注：' + (prev?.remark || '无') + ' → ' + (next.remark || '无'))
  return edits.join('；')
}
function adjustVersion(key:string, value:string) { const n = nodes.value[key];if (n.version !== value) n.version = value }
function windowConfirm() { return window.confirm('放弃未保存的整阶修改？') }
function createChild(l:Line) { const n = fresh(l.material, 'BOM-' + (names.value[l.material] ?? l.material).split(' · ')[0]);nodes.value[n.key] = n;l.child = n.key }
</script>
<template>
  <section v-loading="busy" class="bom-editor" aria-label="整阶 BOM 编排">
    <MaterialPicker ref="picker" />
    <header class="editor-toolbar">
      <el-button @click="!dirty || windowConfirm() ? emit('close') : undefined">返回版本列表</el-button>
      <div class="editor-title"><h3>整阶编排</h3><span>维护多层组成，统一预览并保存草稿</span></div>
      <span class="edit-state">{{ dirty ? '有未保存的修改' : '尚未修改' }}</span>
    </header>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <template v-if="active">
      <div class="workspace">
        <nav class="structure-panel panel" aria-label="BOM 结构">
          <div class="section-heading"><h4>组成结构</h4><span>选择节点编辑</span></div>
          <div class="structure-tree">
            <div v-for="r in tree()" :key="r.index.join('/')" class="tree-row" :class="{ 'is-active': !r.leaf && branch.join('/')===r.index.join('/') }" :style="{paddingLeft: `calc(var(--ui-space-2) + ${r.index.length * 16}px)`}">
              <template v-if="r.leaf">
                <span class="leaf-marker" aria-hidden="true">·</span>
                <el-button class="node-label" link @click="selected=r.path;branch=r.index.slice(0,-1)"><span class="node-copy"><span>{{ names[r.leaf.material]??r.leaf.material }}</span><small>叶项 · 用量 {{ r.leaf.quantity }}</small></span></el-button>
              </template>
              <template v-else>
                <el-button class="tree-toggle" link :aria-label="collapsed.has(r.index.join('/'))?'展开':'折叠'" :aria-expanded="!collapsed.has(r.index.join('/'))" @click="collapsed.has(r.index.join('/'))?collapsed.delete(r.index.join('/')):collapsed.add(r.index.join('/'))">{{ collapsed.has(r.index.join('/'))?'▸':'▾' }}</el-button>
                <el-button class="node-label" link :aria-current="branch.join('/')===r.index.join('/') ? 'true' : undefined" :class="{changed:preview?.changes.some(c=>c.key===r.node.key && c.action!=='REUSE')}" @click="selected=r.path;branch=r.index"><span class="node-copy"><span>{{ names[r.node.product]??r.node.product }}</span><small>{{ r.node.version }} · {{ isolatedKeys.has(r.node.key) ? '当前路径独立' : r.node.source ? '来源版本' : '新建草稿' }}</small></span></el-button>
              </template>
            </div>
          </div>
          <p class="structure-note">共享节点的修改会应用于当前根内的所有引用。</p>
        </nav>
        <main class="node-editor panel">
          <div class="node-heading">
            <div><span class="eyebrow">当前编辑节点</span><h3>{{ names[active.product]??active.product }}</h3></div>
            <el-button v-if="branch.length" :disabled="busy || pathIsolated" @click="split">{{ pathIsolated ? '已独立修订' : '仅此路径单独修订' }}</el-button>
          </div>
          <p v-if="pathIsolated" class="node-hint isolated-hint" role="status">当前节点已在此路径独立。现在可修改版本号、用量和直接组件，不影响其他路径中的原节点；下层子 BOM 仍保留原引用。完成后请预览并保存草稿。</p>
          <p v-else-if="branch.length" class="node-hint">仅修改当前节点在这条路径中的组成？请先「仅此路径单独修订」。点击只拆分编辑草稿，不会自动改版本号或保存。</p>
          <div class="version-fields">
            <label>BOM 编码 <el-input v-model="active.code" :disabled="!!active.source" /></label>
            <label>版本号 <el-input v-model="active.version" /></label>
            <label>产出基准 <QuantityInput v-model="active.base" semantic="bom-ratio" :material-id="active.product" /></label>
            <label class="remark-field">备注 <el-input v-model="active.remark" type="textarea" :autosize="{minRows:2,maxRows:4}" /></label>
          </div>
          <div class="section-heading components-heading"><div><h4>直接组件</h4><span>{{ active.lines.length }} 项 · 用量对应当前产出基准</span></div><el-button @click="pick()">添加组件</el-button></div>
          <el-table :data="active.lines" class="components-table" empty-text="暂无组件，点击「添加组件」开始维护">
            <el-table-column label="组件" min-width="170">
              <template #default="{row,$index}"><el-button link @click="pick($index)">{{ names[row.material]??row.material }}</el-button></template>
            </el-table-column>
            <el-table-column label="用量" min-width="160">
              <template #default="{row}"><QuantityInput v-model="row.quantity" semantic="bom-ratio" show-unit :material-id="row.material" /></template>
            </el-table-column>
            <el-table-column label="子版本" min-width="210">
              <template #default="{row}">
                <div class="child-version">
                  <template v-if="row.child"><span>{{ nodes[row.child]?.version }} · {{ statuses[row.child]==='PUBLISHED'?'已发布':'草稿，须先发布' }}</span><el-button link @click="row.child=null">解除引用</el-button></template>
                  <template v-else>
                    <BomVersionSelect allow-draft placeholder="选择子版本（可不选）" :material-id="row.material" @update:model-value="link(row,$event)" />
                    <el-button link @click="createChild(row)">新建子草稿</el-button>
                    <el-select v-if="Object.values(nodes).some(n=>n.product===row.material&&!n.source)" placeholder="复用本次草稿" @change="row.child=$event">
                      <el-option v-for="n in Object.values(nodes).filter(n=>n.product===row.material&&!n.source)" :key="n.key" :value="n.key" :label="n.code+' · '+n.version" />
                    </el-select>
                  </template>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="顺序" width="110"><template #default="{row}"><el-input-number v-model="row.sort" :min="0" controls-position="right" aria-label="组件顺序" /></template></el-table-column>
            <el-table-column label="操作" width="96" fixed="right"><template #default="{$index}"><el-button link type="danger" @click="active.lines.splice($index,1)">移除组件</el-button></template></el-table-column>
          </el-table>
        </main>
      </div>
      <section v-if="preview" class="preview-panel panel" aria-label="整阶变更预览">
        <div class="section-heading"><div><h4>变更预览</h4><span>确认以下变更后保存整阶草稿</span></div></div>
        <div class="preview-summary">
          <span>新增版本 <strong>{{ preview.createdVersions }}</strong></span><span>更新版本 <strong>{{ preview.editedVersions }}</strong></span>
          <span>组件新增 <strong>{{ preview.insertedLines }}</strong></span><span>修改 <strong>{{ preview.updatedLines }}</strong></span><span>移除 <strong>{{ preview.removedLines }}</strong></span>
        </div>
        <div class="change-list">
          <div v-for="c in preview.changes" :key="c.key" class="change-row">
            <div class="change-heading"><span class="change-action" :class="{changed:c.action!=='REUSE'}">{{ c.ancestor ? '自动生成祖先草稿' : actions[c.action] }}</span><strong>{{ nodes[c.key].code }} · {{ c.version }}</strong></div>
            <label v-if="['COPY','CREATE','EDIT'].includes(c.action)" class="proposed-version">拟保存版本号（调整后重新预览）<el-input :model-value="c.version" maxlength="32" @change="adjustVersion(c.key,$event)" /></label>
            <template v-if="c.action!=='REUSE'"><div class="change-comparison"><p><span>变更前</span>{{ summary(c.before) }}</p><p><span>变更后</span>{{ summary(c.after,true) }}</p></div><p v-if="metadata(c)" class="metadata">{{ metadata(c) }}</p></template>
          </div>
        </div>
      </section>
      <footer class="editor-footer">
        <div class="save-note"><strong>{{ preview ? '已生成变更预览' : '编辑完成后，先预览变更' }}</strong><span>保存只生成草稿；请先发布子版本，再发布父版本。</span></div>
        <div class="footer-actions"><el-button :type="preview ? 'default' : 'primary'" :disabled="busy" @click="review">预览整阶变更</el-button><el-button v-if="preview" type="primary" :disabled="busy" @click="save">确认保存整阶草稿</el-button></div>
      </footer>
    </template>
  </section>
</template>
<style scoped>
.bom-editor { display: flex; flex-direction: column; gap: var(--ui-space-5); container-type: inline-size; }
.editor-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: var(--ui-space-4); }
h3, h4, p { margin: 0; }
h3 { font-size: var(--ui-text-lg); color: var(--ui-text); line-height: 1.5; }
h4 { font-size: var(--ui-text-base); color: var(--ui-text); }
.editor-title { display: flex; align-items: baseline; flex-wrap: wrap; gap: var(--ui-space-3); }
.editor-title span, .edit-state, .section-heading span, .eyebrow, .node-hint, .structure-note, .save-note span { font-size: var(--ui-text-xs); color: var(--ui-text-secondary); }
.edit-state { margin-left: auto; }
.workspace { display: grid; grid-template-columns: minmax(240px, 28%) minmax(0, 1fr); gap: var(--ui-space-4); align-items: start; }
.structure-panel, .node-editor { min-width: 0; }
.section-heading { display: flex; align-items: center; justify-content: space-between; gap: var(--ui-space-3); padding: var(--ui-space-4); border-bottom: 1px solid var(--ui-border-soft); }
.section-heading > div { display: flex; align-items: baseline; flex-wrap: wrap; gap: var(--ui-space-2); }
.structure-tree { padding: var(--ui-space-2); max-height: 56vh; overflow: auto; }
.tree-row { display: flex; align-items: flex-start; border-radius: var(--ui-radius-sm); padding-top: var(--ui-space-2); padding-bottom: var(--ui-space-2); padding-right: var(--ui-space-2); gap: var(--ui-space-1); }
.tree-row:hover { background: var(--ui-surface-soft); }
.tree-row.is-active { background: var(--ui-running-bg); box-shadow: inset 2px 0 var(--ui-primary); }
.tree-toggle, .leaf-marker { flex: 0 0 16px; height: 20px; text-align: center; color: var(--ui-text-muted); }
.node-label { justify-content: flex-start; flex: 1; min-width: 0; height: auto; margin-left: 0; white-space: normal; text-align: left; line-height: 1.5; }
.node-label :deep(span) { overflow-wrap: anywhere; }
.node-copy { display: flex; flex-direction: column; align-items: flex-start; gap: var(--ui-space-1); }
.node-copy small { color: var(--ui-text-muted); font-size: var(--ui-text-xs); font-weight: normal; }
.is-active .node-label { color: var(--ui-primary); }
.structure-note { padding: var(--ui-space-3) var(--ui-space-4); border-top: 1px solid var(--ui-border-soft); line-height: 1.6; }
.node-editor { padding: var(--ui-space-4); }
.node-heading { display: flex; align-items: flex-start; flex-wrap: wrap; justify-content: space-between; gap: var(--ui-space-3); overflow-wrap: anywhere; }
.node-heading > div { flex: 1; min-width: 180px; }
.eyebrow { display: block; margin-bottom: var(--ui-space-1); }
.node-hint { margin-top: var(--ui-space-2); line-height: 1.6; }
.isolated-hint { padding: var(--ui-space-3); border-radius: var(--ui-radius-sm); background: var(--ui-running-bg); color: var(--ui-primary); }
.version-fields { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, .8fr) minmax(0, 1fr); gap: var(--ui-space-4); margin: var(--ui-space-5) 0; }
.version-fields label, .proposed-version { display: flex; flex-direction: column; gap: var(--ui-space-2); min-width: 0; font-size: var(--ui-text-sm); color: var(--ui-text-secondary); }
.remark-field { grid-column: 1 / -1; }
.components-heading { padding: var(--ui-space-3) 0; border-top: 1px solid var(--ui-border-soft); border-bottom: 0; }
.components-table { width: 100%; }
.components-table :deep(.el-button.is-link) { height: auto; white-space: normal; text-align: left; line-height: 1.5; overflow-wrap: anywhere; }
.components-table :deep(.el-input-number) { width: 100%; }
.child-version { display: flex; flex-direction: column; align-items: flex-start; gap: var(--ui-space-2); padding: var(--ui-space-1) 0; }
.child-version :deep(.el-select) { width: 100%; }
.preview-panel { overflow: hidden; }
.preview-summary { display: flex; flex-wrap: wrap; gap: var(--ui-space-4); padding: var(--ui-space-3) var(--ui-space-4); background: var(--ui-surface-soft); font-size: var(--ui-text-sm); color: var(--ui-text-secondary); }
.preview-summary strong { margin-left: var(--ui-space-2); color: var(--ui-text); font-variant-numeric: tabular-nums; }
.change-list { padding: 0 var(--ui-space-4); }
.change-row { padding: var(--ui-space-3) 0; }
.change-row + .change-row { border-top: 1px solid var(--ui-border-soft); }
.change-heading { display: flex; align-items: baseline; flex-wrap: wrap; gap: var(--ui-space-3); font-size: var(--ui-text-sm); overflow-wrap: anywhere; }
.change-action { color: var(--ui-text-secondary); }
.changed { color: var(--ui-primary); }
.proposed-version { max-width: 300px; margin-top: var(--ui-space-3); }
.change-comparison { display: grid; gap: var(--ui-space-2); margin-top: var(--ui-space-3); font-size: var(--ui-text-sm); overflow-wrap: anywhere; }
.change-comparison p { display: flex; align-items: baseline; gap: var(--ui-space-3); }
.change-comparison p > span { flex-shrink: 0; color: var(--ui-text-muted); }
.metadata { margin-top: var(--ui-space-2); font-size: var(--ui-text-xs); color: var(--ui-text-secondary); overflow-wrap: anywhere; }
.editor-footer { position: sticky; bottom: 0; z-index: 2; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--ui-space-4); padding: var(--ui-space-4) 0; border-top: 1px solid var(--ui-border); background: var(--ui-surface); }
.save-note { display: flex; flex-direction: column; gap: var(--ui-space-1); }
.save-note strong { font-size: var(--ui-text-sm); }
.footer-actions { display: flex; flex-wrap: wrap; gap: var(--ui-space-2); }
.footer-actions .el-button + .el-button { margin-left: 0; }
@container (max-width: 850px) { .workspace { grid-template-columns: minmax(0, 1fr); } .structure-tree { max-height: 240px; } }
@container (max-width: 520px) { .version-fields { grid-template-columns: minmax(0, 1fr); } .editor-title { flex: 1; } .edit-state { width: 100%; margin-left: 0; } .footer-actions { width: 100%; } }
</style>
