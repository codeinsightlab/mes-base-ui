<script setup lang="ts">
import { executionStatusLabel } from '@/lib/production/executionState'
import { quantityColumn } from '@/lib/production/quantity'
import { onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/stores/auth'
import { api, type MesProductionExecutionVo } from '@/api/production/mesProductionExecution'
import Pagination from '@/components/Pagination/index.vue'
import ExecutionRoutePreview from './ExecutionRoutePreview.vue'
const props = defineProps<{ workorderId: string }>()
const auth = useAuth(), router = useRouter(), rows = ref<MesProductionExecutionVo[]>([]), total = ref(0), page = ref(1), limit = ref(20), loading = ref(false), error = ref('')
let sequence = 0
function clear() { sequence++; rows.value = []; total.value = 0; loading.value = false; error.value = '' }
async function load() {
  clear(); if (!auth.hasPermission('business:mes:production:execution:list', 'factory')) return
  const ticket = sequence; loading.value = true
  try { const result = await api.list({ workorderId: props.workorderId, offset: (page.value - 1) * limit.value, limit: limit.value }); if (ticket === sequence) { rows.value = result.items; total.value = result.total } } catch(e) { if (ticket === sequence) error.value = e instanceof Error ? e.message : '执行摘要读取失败' } finally { if (ticket === sequence) loading.value = false }
}
watch(() => [props.workorderId, auth.factoryId, auth.revision, auth.factoryPermissions.join('|')], () => { page.value = 1; void load() }, { immediate: true, flush: 'sync' })
onBeforeUnmount(clear)
</script>
<template>
  <section aria-label="工单执行摘要">
    <div class="table-toolbar"><strong>生产执行摘要</strong><el-button type="primary" @click="router.push({path:'/production/mesProductionExecution',query:{workorderId}})">进入生产执行</el-button></div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-table v-loading="loading" :data="rows" row-key="id">
      <el-table-column prop="id" label="执行ID" min-width="210" /><el-table-column label="实际工艺版本" min-width="260"><template #default="{row}"><span :title="'版本 ID：'+row.routingId">{{ row.routingCode || '工艺名称未记录' }} / V{{ row.routingVersion ?? '未记录' }} · {{ row.routingName || '名称未记录' }}</span></template></el-table-column><el-table-column :formatter="quantityColumn" prop="targetQty" label="目标数量" min-width="140" /><el-table-column label="执行状态" width="120"><template #default="{row}">{{ executionStatusLabel(row.status) }}</template></el-table-column>
      <el-table-column label="查看 / 跳转" min-width="280"><template #default="{row}"><ExecutionRoutePreview :execution-id="row.id" /><el-button v-if="auth.hasPermission('business:production:report:quantity','factory')" link type="primary" @click="router.push({path:'/production/productionReport',query:{executionId:row.id,workorderId}})">查看生产数量</el-button></template></el-table-column>
    </el-table>
    <Pagination v-model:page="page" v-model:limit="limit" :total="total" @pagination="load" />
  </section>
</template>
