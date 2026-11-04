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
const branch = ref<number[]>([])
function split() { let n = nodes.value[root.value];const path = [n.key];for (const i of branch.value) { const l = n.lines[i], copy = JSON.parse(JSON.stringify(nodes.value[l.child!])) as Node;copy.key = crypto.randomUUID();l.child = copy.key;nodes.value[copy.key] = copy;n = copy;path.push(n.key) }selected.value = path }
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
  <section v-loading="busy">
    <MaterialPicker ref="picker" />
    <el-alert v-if="error" :title="error" type="error" />
    <el-button @click="!dirty || windowConfirm() ? emit('close') : undefined">返回版本列表</el-button>
    <template v-if="active">
      <p>选择树中版本，编辑其直接组件。共享节点的修改应用于当前根内所有引用；仅改所选路径时先分开修订。</p>
      <div class="workspace">
        <nav aria-label="BOM 结构">
          <div v-for="r in tree()" :key="r.index.join('/')" class="tree-row" :style="{paddingLeft:r.index.length*12+'px'}">
            <el-button v-if="r.leaf" class="node-label" link @click="selected=r.path;branch=r.index.slice(0,-1)">{{ names[r.leaf.material]??r.leaf.material }} × {{ r.leaf.quantity }}（叶项）</el-button>
            <template v-else>
              <el-button link :aria-label="collapsed.has(r.index.join('/'))?'展开':'折叠'" @click="collapsed.has(r.index.join('/'))?collapsed.delete(r.index.join('/')):collapsed.add(r.index.join('/'))">{{ collapsed.has(r.index.join('/'))?'▸':'▾' }}</el-button>
              <el-button class="node-label" link :class="{changed:preview?.changes.some(c=>c.key===r.node.key && c.action!=='REUSE')}" @click="selected=r.path;branch=r.index">{{ names[r.node.product]??r.node.product }} · {{ r.node.version }}</el-button>
            </template>
          </div>
        </nav>
        <main>
          <div class="node-heading"><strong>{{ names[active.product]??active.product }}</strong><el-button v-if="branch.length" @click="split">仅此路径单独修订</el-button></div>
          <label>BOM 编码 <el-input v-model="active.code" :disabled="!!active.source" />
          </label>
          <label>版本号 <el-input v-model="active.version" />
          </label>
          <label>产出基准 <QuantityInput v-model="active.base" semantic="bom-ratio" :material-id="active.product" />
          </label>
          <label>备注 <el-input v-model="active.remark" />
          </label>
          <el-table :data="active.lines">
            <el-table-column label="组件" min-width="240">
              <template #default="{row,$index}">
                <el-button link @click="pick($index)">{{ names[row.material]??row.material }}</el-button>
              </template>
            </el-table-column>
            <el-table-column label="用量" min-width="260">
              <template #default="{row}">
                <QuantityInput v-model="row.quantity" semantic="bom-ratio" show-unit :material-id="row.material" />
              </template>
            </el-table-column>
            <el-table-column label="子版本" min-width="210">
              <template #default="{row}">
                <span v-if="row.child">{{ nodes[row.child]?.version }} · {{ statuses[row.child]==='PUBLISHED'?'已发布':'草稿，须先发布' }} <el-button link @click="row.child=null">解除引用</el-button>
                </span>
                <template v-else>
                  <BomVersionSelect allow-draft :material-id="row.material" @update:model-value="link(row,$event)" />
                  <el-button link @click="createChild(row)">新建子草稿</el-button>
                  <el-select v-if="Object.values(nodes).some(n=>n.product===row.material&&!n.source)" placeholder="复用本次草稿" @change="row.child=$event">
                    <el-option v-for="n in Object.values(nodes).filter(n=>n.product===row.material&&!n.source)" :key="n.key" :value="n.key" :label="n.code+' · '+n.version" />
                  </el-select>
                </template>
              </template>
            </el-table-column>
            <el-table-column label="顺序" width="150">
              <template #default="{row}">
                <el-input-number v-model="row.sort" :min="0" controls-position="right" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100" fixed="right">
              <template #default="{$index}">
                <el-button link @click="active.lines.splice($index,1)">移除组件</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-button @click="pick()">添加组件</el-button>
        </main>
      </div>
      <el-button type="primary" @click="review">预览整阶变更</el-button>
      <template v-if="preview">
        <p>新增 {{ preview.createdVersions }} 个版本，更新 {{ preview.editedVersions }} 个版本；明细新增 {{ preview.insertedLines }}、修改 {{ preview.updatedLines }}、移除 {{ preview.removedLines }}。保存只生成草稿；请先发布子版本，再发布父版本。</p>
        <div v-for="c in preview.changes" :key="c.key">
          <strong :class="{changed:c.action!=='REUSE'}">{{ c.ancestor ? '自动生成祖先草稿' : actions[c.action] }}：{{ nodes[c.key].code }} · {{ c.version }}</strong>
          <label v-if="['COPY','CREATE','EDIT'].includes(c.action)">拟保存版本号（调整后重新预览）<el-input :model-value="c.version" maxlength="32" @change="adjustVersion(c.key,$event)" />
          </label>
          <p v-if="c.action!=='REUSE'">{{ summary(c.before) }} → {{ summary(c.after,true) }}<br>{{ metadata(c) }}</p>
        </div>
        <el-button type="primary" @click="save">确认保存整阶草稿</el-button>
      </template>
    </template>
  </section>
</template>
<style scoped>
.changed { color: var(--el-color-primary); }
.workspace { display: grid; grid-template-columns: minmax(240px, 28%) minmax(0, 1fr); gap: 12px; }
.workspace nav, .workspace main { min-width: 0; overflow: auto; }
.workspace label { display: inline-block; max-width: 200px; margin: 6px; }
.tree-row { display: flex; align-items: flex-start; margin-bottom: 8px; }
.node-label { min-width: 0; height: auto; white-space: normal; text-align: left; line-height: 1.5; }
.node-label :deep(span) { overflow-wrap: anywhere; }
.workspace :deep(.el-table .el-button.is-link) { height: auto; white-space: normal; text-align: left; line-height: 1.5; overflow-wrap: anywhere; }
.node-heading { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 8px; overflow-wrap: anywhere; }
.workspace :deep(.quantity-input .el-input__wrapper) { min-width: 70px; }
.workspace :deep(.quantity-input .el-input-group__append) { max-width: 130px; white-space: normal; overflow-wrap: anywhere; padding: 0 8px; }
@media (max-width: 1280px) {
  .workspace { grid-template-columns: minmax(0, 1fr); }
  .workspace nav { max-height: 240px; }
}
</style>
