<script setup lang="ts">
import PageDialog from '@/components/page/PageDialog.vue'

import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useAuth } from '@/stores/auth'
import { executionActions, type PathView } from '@/api/production/executionActions'
import type { RoutingEdge, RoutingNode } from '@/api/production/routing'
import RoutingGraphPreview from '@/components/business/RoutingGraphPreview.vue'
const props = defineProps<{ executionId: string }>()
const auth = useAuth(), visible = ref(false), loading = ref(false), error = ref(''), view = ref<PathView | null>(null)
const allowed = computed(() => auth.hasPermission('business:mes:production:execution:query', 'factory'))
let sequence = 0
function clear() { sequence++; visible.value = false; loading.value = false; view.value = null; error.value = '' }
watch(() => [props.executionId, auth.factoryId, auth.revision, allowed.value], clear, { flush: 'sync' })
onBeforeUnmount(clear)
const selected = computed(() => view.value?.pathStatus === 'UNSELECTED' ? [] : view.value?.selectedNodeIds ?? [])
const nodes = computed<RoutingNode[]>(() => view.value?.nodes.map((n, index) => ({ id: n.id, nodeCode: n.nodeCode, operationId: n.operationId, operationCode: n.operationCode, operationName: n.operationName, displayOrder: index, isKey: n.required, description: null })) ?? [])
const edges = computed<RoutingEdge[]>(() => {
 const byId = new Map(view.value?.nodes.map(n => [n.id, n.nodeCode]))
 return view.value?.edges.map(e => ({ fromNodeCode: byId.get(e.fromNodeId)!, toNodeCode: byId.get(e.toNodeId)! })) ?? []
})
async function open() {
 if (!allowed.value) return
 clear(); visible.value = true; loading.value = true; const ticket = sequence
 try {
  const data = await executionActions.path(props.executionId)
  if (ticket !== sequence) return
  const ids = new Set(data.nodes.map(n => n.id))
  if (data.executionId !== props.executionId || !data.routingId || !data.routingVersion || data.nodes.some(n => !n.operationId) || data.edges.some(e => !ids.has(e.fromNodeId) || !ids.has(e.toNodeId)) || data.selectedNodeIds.some(id => !ids.has(id))) throw new Error('执行路径与工艺版本数据不完整，请刷新后重试')
  view.value = data
 } catch(e) { if (ticket === sequence) error.value = e instanceof Error ? e.message : '执行路线读取失败' }
 finally { if (ticket === sequence) loading.value = false }
}
</script>
<template>
 <el-button v-if="allowed" link type="primary" @click="open">实际工艺路线</el-button>
 <PageDialog v-model="visible" title="执行单元实际工艺路线" width="min(1180px,96vw)" append-to-body destroy-on-close @close="clear">
  <el-alert v-if="error" :title="error" type="error" :closable="false" />
  <section v-if="view" v-loading="loading">
   <p><strong>{{ view.executionId }}</strong> · {{ view.routingCode }} / V{{ view.routingVersion }} · 工艺版本 ID：{{ view.routingId }}</p>
   <el-alert v-if="view.pathStatus === 'UNSELECTED'" title="尚未选择实际执行路径；下图仅为该执行版本的完整工艺定义。" type="info" :closable="false" />
   <p v-else>{{ view.pathStatus === 'LOCKED' ? '已锁定的实际执行路径' : '已选择，尚未锁定的执行路径' }}；突出节点及连接表示当前已选路径。</p>
   <RoutingGraphPreview :nodes="nodes" :edges="edges" :selected-node-ids="selected" />
   <el-empty v-if="view.pathStatus === 'UNSELECTED'" description="尚未选择路径" :image-size="45" />
   <ol v-else aria-label="实际执行节点顺序"><li v-for="id in selected" :key="id">{{ view.nodes.find(n => n.id === id)?.nodeCode }} · {{ view.nodes.find(n => n.id === id)?.operationName || '工序名称未记录' }}</li></ol>
   <p class="secondary">此处仅查看路线；路径选择和开工在生产执行页面操作。</p>
  </section>
  <p v-else-if="loading" role="status">正在读取执行路线…</p>
 </PageDialog>
</template>
