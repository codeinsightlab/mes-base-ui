<script setup lang="ts">
import PageDialog from '@/components/page/PageDialog.vue'

import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { useAuth } from '@/stores/auth'
import { executionActions, type PathView } from '@/api/production/executionActions'
const props = defineProps<{ id: string }>()
const emit = defineEmits<{ changed: [] }>()
const auth = useAuth(), open = ref(false), busy = ref(false), error = ref(''), view = ref<PathView | null>(null), selected = ref<string[]>([]), next = ref('')
let generation = 0
let changedPending = false
const can = (action: string) => auth.hasPermission('business:mes:production:execution:' + (['start', 'select-path'].includes(action) ? 'update' : action), 'factory')
const editable = computed(() => view.value?.executionStatus === 'READY' && view.value.pathStatus !== 'LOCKED' && can('select-path'))
const candidates = computed(() => {
  const v = view.value; if (!v) return []
  return v.nodes.filter(n => !selected.value.includes(n.id) && (selected.value.length ? v.edges.some(e => e.fromNodeId === selected.value.at(-1) && e.toNodeId === n.id) : !v.edges.some(e => e.toNodeId === n.id)))
})
const complete = computed(() => !!view.value && !!selected.value.length && !view.value.edges.some(e => e.fromNodeId === selected.value.at(-1)) && view.value.nodes.filter(n => n.required).every(n => selected.value.includes(n.id)))
function clear() { generation++; open.value = false; busy.value = false; error.value = ''; view.value = null; selected.value = []; next.value = '' }
watch(() => [props.id, auth.factoryId, auth.revision, auth.factoryPermissions.join('|')], clear)
onBeforeUnmount(clear)
function closed() { const changed = changedPending; changedPending = false; clear(); if (changed) emit('changed') }
async function load() {
  if (!can('query') || busy.value) return
  const seq = ++generation; open.value = true; busy.value = true; error.value = ''
  try { const data = await executionActions.path(props.id); if (seq === generation) { view.value = data; selected.value = [...data.selectedNodeIds] } } catch(e) { if (seq === generation) error.value = e instanceof Error ? e.message : '路径读取失败' } finally { if (seq === generation) busy.value = false }
}
async function run(start: boolean) {
  if (busy.value || !view.value || !(start ? can('start') : editable.value && complete.value)) return
  const seq = ++generation; busy.value = true; error.value = ''
  try {
    if (start) { const result = await executionActions.start(props.id); if (seq === generation && view.value) { view.value.executionStatus = result.status; changedPending = true } } else { const result = await executionActions.select(props.id, view.value.revision, selected.value); if (seq === generation) { view.value = result; selected.value = [...result.selectedNodeIds]; changedPending = true } }
  } catch(e) { if (seq === generation) error.value = e instanceof Error ? e.message : '执行操作失败' } finally { if (seq === generation) busy.value = false }
}
function add() { if (next.value && editable.value && !busy.value) { selected.value.push(next.value); next.value = '' } }
</script>
<template>
  <el-button v-if="can('query')" text @click="load">路径与开工</el-button>
  <PageDialog v-model="open" title="执行路径与开工" width="680px" append-to-body destroy-on-close @closed="closed">
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <section v-if="view" v-loading="busy">
      <p>执行状态：{{ view.executionStatus }} · 路径：{{ view.pathStatus === 'LOCKED' ? '已锁定' : view.pathStatus === 'SELECTED' ? '已选择，待领料确认' : '未选择' }}</p>
      <ol aria-label="路径节点顺序"><li v-for="(id, index) in selected" :key="id">{{ index + 1 }}. {{ view.nodes.find(n => n.id === id)?.nodeCode }} · {{ view.nodes.find(n => n.id === id)?.operationName || '历史工序名称未记录' }}</li></ol>
      <template v-if="editable">
        <el-select v-model="next" aria-label="下一路径节点" placeholder="选择起点或下一相邻节点" :disabled="busy"><el-option v-for="node in candidates" :key="node.id" :value="node.id" :label="node.nodeCode + ' · ' + (node.operationName || '历史工序名称未记录') + (node.required ? '（必经）' : '')" /></el-select>
        <el-button :disabled="!next || busy" @click="add">添加节点</el-button>
        <el-button :disabled="!selected.length || busy" @click="selected.pop(); next = ''">撤回末节点</el-button>
        <p>选择从起点到终点的完整路径，必须经过标记为必经的节点。领料确认后永久只读。</p>
        <el-button type="primary" :disabled="!complete || busy" @click="run(false)">保存路径</el-button>
      </template>
      <p v-if="view.lockedAt">锁定时间：{{ view.lockedAt }}</p>
      <el-button v-if="can('start') && view.executionStatus === 'READY'" type="success" :disabled="view.pathStatus !== 'LOCKED' || busy" @click="run(true)">开工</el-button>
      <p v-if="view.executionStatus === 'RUNNING'" role="status">执行已开工 · RUNNING</p>
    </section>
  </PageDialog>
</template>
