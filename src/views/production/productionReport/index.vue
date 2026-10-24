<script setup lang="ts">
import QueryForm from '@/components/QueryForm.vue'

import { quantityColumn } from '@/lib/production/quantity'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import Pagination from '@/components/Pagination/index.vue'
import WorkOrderSelect from '@/components/business/production/WorkOrderSelect.vue'
import ExecutionSelect from '@/components/business/production/ExecutionSelect.vue'
import ProductionReportManager from '@/components/business/production/ProductionReportManager.vue'
import { productionReport, reportPermissions, type ExecutionSummary } from '@/api/production/productionReport'
import { useAuth } from '@/stores/auth'
const auth = useAuth(), route = useRoute(), router = useRouter()
const allowed = computed(() => auth.hasPermission(reportPermissions.quantity, 'factory'))
const workorderId = ref<string | null>(null), executionId = ref(''), selectedId = ref(''), rows = ref<ExecutionSummary[]>([]), total = ref(0), page = ref(1), limit = ref(20), loading = ref(false), error = ref('')
let sequence = 0
function clear() { sequence++; selectedId.value = ''; rows.value = []; total.value = 0; loading.value = false; error.value = '' }
function select(id: string) { selectedId.value = id }
const pathLabel = (status: string) => ({ UNSELECTED: '尚未选择', SELECTED: '已选择，未锁定', LOCKED: '已锁定' }[status] ?? status)
function selectRow(row: ExecutionSummary) { select(row.executionId) }
async function load() {
  clear(); if (!allowed.value) return
  if (executionId.value) { if (!/^[1-9]\d{0,18}$/.test(executionId.value)) { error.value = '请输入有效的 Execution ID'; return }; select(executionId.value); return }
  if (!workorderId.value) { error.value = '请选择工单或填写 Execution ID'; return }
  const ticket = sequence; loading.value = true
  try { const result = await productionReport.workorderQuantities(workorderId.value, (page.value - 1) * limit.value, limit.value); if (ticket === sequence) { rows.value = result.items; total.value = result.total } } catch(e) { if (ticket === sequence) error.value = e instanceof Error ? e.message : '执行数量摘要读取失败' } finally { if (ticket === sequence) loading.value = false }
}
watch(workorderId, () => { clear(); executionId.value = ''; page.value = 1 }, { flush: 'sync' })
watch(executionId, () => { clear() }, { flush: 'sync' })
watch(() => [auth.factoryId, auth.revision, allowed.value], () => { clear(); workorderId.value = null; executionId.value = ''; page.value = 1 }, { flush: 'sync' })
watch(() => [route.query.executionId, route.query.workorderId], () => {
  if (!allowed.value) return
  const order = route.query.workorderId, execution = route.query.executionId
  workorderId.value = typeof order === 'string' && /^[1-9]\d{0,18}$/.test(order) ? order : null
  executionId.value = typeof execution === 'string' && /^[1-9]\d{0,18}$/.test(execution) ? execution : ''
  if (executionId.value) selectedId.value = executionId.value
  else if (workorderId.value) void load()
}, { immediate: true })
onBeforeUnmount(clear)
async function changed() {
  if (!workorderId.value || !rows.value.length) return
  const ticket = sequence
  try { const result = await productionReport.workorderQuantities(workorderId.value, (page.value - 1) * limit.value, limit.value); if (ticket === sequence) { rows.value = result.items; total.value = result.total } } catch(e) { if (ticket === sequence) error.value = e instanceof Error ? e.message : '执行摘要刷新失败' }
}
</script>
<template>
  <div class="app-container">
    <PageHeader title="生产数量管理" description="查询执行单元的实际节点数量与不可变报工流水，管理历史补录、订正和冲销。" />
    <el-alert v-if="!allowed" title="当前账号没有生产数量查询权限" type="info" :closable="false" />
    <template v-else>
      <QueryForm class="filter-panel report-filter" inline @submit="page=1;load()">
        <el-form-item label="工单"><WorkOrderSelect v-model="workorderId" /></el-form-item>
        <el-form-item label="执行单元"><ExecutionSelect v-model="executionId" :workorder-id="workorderId" /></el-form-item>
        <el-button native-type="submit" type="primary">查询</el-button>
        <el-button native-type="button" v-if="auth.hasPermission('workorder:list','factory')" @click="router.push('/production/workorder')">返回工单</el-button>
      </QueryForm>
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <section v-if="rows.length || loading" aria-label="Execution 数量摘要">
        <el-table v-loading="loading" :data="rows" row-key="executionId" :current-row-key="selectedId" highlight-current-row @row-click="selectRow">
          <el-table-column prop="executionId" label="Execution ID" width="140" /><el-table-column :formatter="quantityColumn" prop="targetQty" label="计划数量" min-width="140" /><el-table-column :formatter="quantityColumn" prop="productionInputQty" label="可支用投产额度" min-width="160" /><el-table-column label="实际工艺版本" min-width="260"><template #default="{row}"><span :title="'版本 ID：'+row.routingId">{{ row.routingLabel || '工艺名称未记录' }}</span></template></el-table-column><el-table-column label="路径状态" width="150"><template #default="{row}">{{ pathLabel(row.pathStatus) }}</template></el-table-column><el-table-column :formatter="quantityColumn" prop="lastNodeReportedQty" label="末节点累计报工" min-width="160" />
          <el-table-column label="操作" width="120"><template #default="{row}"><el-button link type="primary" @click.stop="select(row.executionId)">查看数量</el-button></template></el-table-column>
        </el-table>
        <Pagination v-model:page="page" v-model:limit="limit" :total="total" @pagination="load" />
      </section>
      <ProductionReportManager v-if="selectedId" :execution-id="selectedId" @changed="changed" />
      <el-empty v-else :description="workorderId && !loading ? '查询工单后选择执行单元查看数量' : '选择工单或直接查询 Execution ID'" />
    </template>
  </div>
</template>

<style scoped>
.report-filter :deep(.el-select) { width: 280px; max-width: 100%; }
</style>
