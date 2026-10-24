<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useAuth } from '@/stores/auth'
import { api } from '@/api/production/workorder'
import type { RoutingDetail } from '@/api/production/routing'
import RoutingGraphPreview from '@/components/business/RoutingGraphPreview.vue'
const props = defineProps<{ workorderId: string; routingId: string }>()
const auth = useAuth(), graph = ref<RoutingDetail | null>(null), error = ref(''), loading = ref(false)
let sequence = 0
function clear() { sequence++; graph.value = null; error.value = ''; loading.value = false }
watch(() => [props.workorderId, props.routingId, auth.factoryId, auth.revision, auth.hasPermission('workorder:query', 'factory')], async() => {
  clear(); if (!auth.hasPermission('workorder:query', 'factory')) return
  const ticket = sequence; loading.value = true
  try { const data = await api.graph(props.workorderId); if (ticket !== sequence) return; if (data.routing.id !== props.routingId) throw new Error('工单默认工艺版本不一致，请重新打开详情'); graph.value = data } catch(e) { if (ticket === sequence) error.value = e instanceof Error ? e.message : '默认工艺图读取失败' } finally { if (ticket === sequence) loading.value = false }
}, { immediate: true, flush: 'sync' })
onBeforeUnmount(clear)
</script>
<template>
  <section v-loading="loading" aria-label="工单默认工艺定义">
    <h3>工单默认工艺定义</h3><p class="secondary">仅代表工单默认版本；各执行单元的实际版本及已选路径请分别查看。</p>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <template v-if="graph"><p>{{ graph.routing.code }} / V{{ graph.routing.version }} · 版本 ID：{{ graph.routing.id }}</p><RoutingGraphPreview :nodes="graph.nodes" :edges="graph.edges" /></template>
  </section>
</template>
