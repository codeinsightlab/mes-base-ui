<script setup lang="ts">
import QueryForm from '@/components/QueryForm.vue'

import CodeScanner from '@/components/scanner/CodeScanner.vue'
import QuantityText from '@/components/business/production/QuantityText.vue'
import { quantityColumn } from '@/lib/production/quantity'
import { executionStatusLabel } from '@/lib/production/executionState'
import DefectDeclarationPanel from '@/components/business/quality/DefectDeclarationPanel.vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useAuth } from '@/stores/auth'
import { ApiError } from '@/lib/request'
import PageHeader from '@/components/PageHeader.vue'
import RoutingGraphPreview from '@/components/business/RoutingGraphPreview.vue'
import { productionReporting, submitPermission, type ReportingContext, type ReportCommand } from '@/api/production/productionReporting'
import { scanExecution, type ScanInputMethod } from '@/api/production/productionScan'
import type { Ledger } from '@/api/production/productionReport'
import type { RoutingNode, RoutingEdge } from '@/api/production/routing'
const auth = useAuth()
const allowed = computed(() => !!auth.factoryId && !auth.factorySwitching && auth.hasPermission(submitPermission, 'factory'))
const code = ref(''), context = ref<ReportingContext | null>(null), selectedId = ref(''), quantity = ref('')
const loading = ref(false), busy = ref(false), error = ref(''), result = ref<Ledger | null>(null)
const pending = ref<ReportCommand | null>(null), showAll = ref(false)
let version = 0
const nodes = computed(() => context.value?.quantities.nodes.map(n => ({ ...n, ...context.value?.candidates.find(c => c.routingNodeId === n.routingNodeId) })) ?? [])
const visibleNodes = computed(() => nodes.value.filter(n => showAll.value || n.status === 'AVAILABLE'))
const qualityPending = computed(() => [...new Set(nodes.value.filter(n => n.status === 'QUALITY_PENDING').map(n => n.reason).filter(Boolean))].join('；'))
const selected = computed(() => nodes.value.find(n => n.routingNodeId === selectedId.value))
const graphNodes = computed<RoutingNode[]>(() => context.value?.path.nodes.map((n, i) => ({ id: n.id, nodeCode: n.nodeCode, operationId: n.operationId, operationCode: n.operationCode, operationName: n.operationName, isKey: n.required, displayOrder: i, description: null })) ?? [])
const graphEdges = computed<RoutingEdge[]>(() => {
 const codes = new Map(context.value?.path.nodes.map(n => [n.id, n.nodeCode]))
 return context.value?.path.edges.map(e => ({ fromNodeCode: codes.get(e.fromNodeId)!, toNodeCode: codes.get(e.toNodeId)! })) ?? []
})
const statusNames: Record<string, string> = { AVAILABLE: '可报工', QUALITY_PENDING: '受待核实不良影响', NO_QUANTITY: '无可报数量', NOT_ASSIGNED: '未被派工', NO_CAPABILITY: '无工序能力', EXECUTION_NOT_READY: '执行未就绪' }
function clear() {
 version++; context.value = null; selectedId.value = ''; quantity.value = ''; pending.value = null
 result.value = null; error.value = ''; busy.value = loading.value = false; showAll.value = false
}
watch(() => [auth.factoryId, auth.revision, allowed.value], () => { clear(); code.value = '' }, { flush: 'sync' })
onBeforeUnmount(clear)
async function locate(value?:string,inputMethod:ScanInputMethod='TEXT') {
 if (!allowed.value) return
 if(value!==undefined)code.value=value
 clear(); loading.value = true; const ticket = version
 try {
  const identity = await scanExecution('REPORTING',code.value,inputMethod)
  if(ticket!==version)return
  const value = await productionReporting.context(identity.executionId)
  if (ticket !== version) return
  context.value = value
 } catch(e) { if (ticket === version) error.value = e instanceof Error ? e.message : '执行查询失败' }
 finally { if (ticket === version) loading.value = false }
}
async function submit() {
 if (!allowed.value || busy.value || !context.value) return
 if (!pending.value && (selected.value?.status !== 'AVAILABLE' || !/^\d{1,14}(\.\d{1,2})?$/.test(quantity.value) || !/[1-9]/.test(quantity.value))) { error.value = '请选择可报工序，输入正数量（最多2位小数）'; return }
 if (!pending.value) pending.value = { executionId: context.value.identity.executionId, routingNodeId: selectedId.value, reportQty: quantity.value, workstationId: null, requestId: crypto.randomUUID() }
 const command = { ...pending.value }, ticket = version
 busy.value = true; error.value = ''
 try {
  const saved = await productionReporting.submit(command)
  if (ticket !== version) return
  result.value = saved; pending.value = null; quantity.value = ''; selectedId.value = ''
  try {
   const fresh = await productionReporting.context(command.executionId)
   if (ticket === version) context.value = fresh
  } catch(e) { if (ticket === version) error.value = '报工已成功，数量刷新失败，请重新定位执行单元：' + (e instanceof Error ? e.message : '读取失败') }
 } catch(e) {
  if (ticket !== version) return
  // Unknown transport/5xx outcomes retain the exact command. Definite rejection allows corrected input with a new ID.
  if (e instanceof ApiError && e.status >= 400 && e.status < 500) pending.value = null
  error.value = e instanceof Error ? e.message : '报工结果未确认，请使用原请求重试'
 } finally { if (ticket === version) busy.value = false }
}
</script>
<template>
 <div class="app-container reporting-page">
  <PageHeader title="生产报工" description="扫描生产执行身份码，选择当前可报工序并确认完成数量。" />
  <el-alert v-if="!allowed" title="当前账号没有正式生产报工权限，或尚未选择工厂" type="warning" :closable="false" />
  <template v-else>
   <QueryForm class="filter-panel reporting-scan" label-position="top" @submit="locate()">
    <el-form-item label="执行身份码"><el-input v-model="code" placeholder="工单号:品号#批次号，例如 WO001:P001#LOT001" maxlength="2048" clearable aria-label="执行身份码" aria-describedby="reporting-scan-help" /></el-form-item>
    <el-button native-type="submit" type="primary" :loading="loading" >定位执行</el-button>
    <CodeScanner v-model="code" :disabled="loading || busy || !!pending || !allowed" :context-key="auth.factoryId + ':' + auth.revision" @confirm="locate" />
   </QueryForm>
   <p id="reporting-scan-help" class="secondary">扫码格式为“工单号:品号#批次号”，例如 WO001:P001#LOT001。</p>
   <el-alert v-if="error" :title="error" type="error" :closable="false" role="alert" />
   <el-alert v-if="result" :title="`报工成功：流水 ${result.id}，本次完成 ${result.quantityDelta}，时间 ${result.reportTime}`" type="success" :closable="false" />
   <section v-if="context" class="panel" v-loading="loading">
    <el-descriptions :column="1" border>
     <el-descriptions-item label="生产执行">{{ context.identity.executionId }} · {{ executionStatusLabel(context.identity.status) }}</el-descriptions-item>
     <el-descriptions-item label="工单">{{ context.identity.workorderCode }}</el-descriptions-item>
     <el-descriptions-item label="产出物料">{{ context.identity.productCode }} · {{ context.identity.productName }}</el-descriptions-item>
     <el-descriptions-item label="生产批次">{{ context.identity.batchNo || '未记录' }}</el-descriptions-item>
     <el-descriptions-item label="目标数量"><QuantityText :value="context.identity.targetQty" /></el-descriptions-item>
     <el-descriptions-item label="实际工艺">{{ context.quantities.routingLabel || context.identity.routingCode + ' / V' + context.identity.routingVersion }} · {{ context.quantities.pathStatus }}</el-descriptions-item>
    </el-descriptions>
    <el-alert v-if="context.quantities.pathStatus !== 'LOCKED'" title="实际路径尚未锁定，不能正式报工。请在生产执行完成选路与领料确认。" type="warning" :closable="false" />
    <el-collapse v-if="context.quantities.pathStatus !== 'UNSELECTED'"><el-collapse-item title="查看本次实际执行路径" name="path"><p class="secondary">突出节点与连线是本次已选路径，其余节点仅为同版本工艺定义参考。</p><RoutingGraphPreview :nodes="graphNodes" :edges="graphEdges" :selected-node-ids="context.path.selectedNodeIds" /></el-collapse-item></el-collapse>
    <div class="table-toolbar"><strong>实际路径工序</strong><el-switch v-model="showAll" active-text="查看其他节点状态" /></div>
    <el-alert v-if="qualityPending" :title="qualityPending" type="warning" :closable="false" />
    <el-table :data="visibleNodes" row-key="routingNodeId">
     <el-table-column label="顺序" prop="sequenceNo" width="75" />
     <el-table-column label="工序" min-width="190"><template #default="{row}">{{ row.code }} · {{ row.name || '工序名称未记录' }}</template></el-table-column>
     <el-table-column :formatter="quantityColumn" label="上游可用 / 输入" prop="inputQty" min-width="145" />
     <el-table-column :formatter="quantityColumn" label="累计报工" prop="reportedQty" min-width="130" />
     <el-table-column :formatter="quantityColumn" label="原始申报量" prop="defectQty" min-width="110" /><el-table-column :formatter="quantityColumn" label="独立不良" prop="directDefectQty" min-width="110" /><el-table-column :formatter="quantityColumn" label="待核实" prop="unverifiedDefectQty" min-width="110" /><el-table-column :formatter="quantityColumn" label="历史已返回" prop="returnedQty" min-width="110" /><el-table-column :formatter="quantityColumn" label="当前净不良" prop="netDefectQty" min-width="110" />
     <el-table-column label="产出数量投影" min-width="180"><template #default="{row}"><QuantityText :value="row.effectiveOutputQty" /><span v-if="row.status === 'QUALITY_PENDING'"> · 待核实，暂不可流转</span></template></el-table-column>
     <el-table-column :formatter="quantityColumn" label="剩余可报" prop="availableQty" min-width="130" />
     <el-table-column label="状态 / 原因" min-width="230"><template #default="{row}">{{ statusNames[row.status] || row.status }}<span v-if="row.reason"> · {{ row.reason }}</span></template></el-table-column>
    </el-table>
    <el-empty v-if="!visibleNodes.length" description="暂无可报工序，可打开其他节点状态查看原因" :image-size="55" />
    <el-form class="report-form" label-position="top" @submit.prevent="submit">
     <el-form-item label="本次报工工序"><el-select v-model="selectedId" :disabled="busy || !!pending" placeholder="选择可报工序"><el-option v-for="n in nodes" :key="n.routingNodeId" :value="n.routingNodeId" :label="n.code + ' · ' + (n.name || '工序名称未记录') + (n.reason ? '（' + n.reason + '）' : '')" :disabled="n.status !== 'AVAILABLE'" /></el-select></el-form-item>
     <p v-if="selected">上游输入 <QuantityText :value="selected.inputQty" /> · 已报 <QuantityText :value="selected.reportedQty" /> · 不良 <QuantityText :value="selected.defectQty" /> · 可流转 <QuantityText :value="selected.effectiveOutputQty" /> · 剩余 <QuantityText :value="selected.availableQty" /></p>
     <el-form-item label="本次完成数量"><el-input v-model="quantity" inputmode="decimal" :disabled="busy || !!pending" placeholder="输入大于0的完成数量" /></el-form-item>
     <el-button type="primary" size="large" :loading="busy" :disabled="!pending && selected?.status !== 'AVAILABLE'" @click="submit">{{ pending && !busy ? '结果未确认，安全重试原报工' : '确认报工' }}</el-button>
    </el-form>
    <p v-if="pending && !busy" class="secondary">原工序和数量已保留。重试复用同一请求标识；切换执行前请确认原请求结果。</p>
    <el-collapse v-if="context && selected && auth.hasPermission('business:quality:defect:create', 'factory')"><el-collapse-item title="申报本工序不良" name="defect"><DefectDeclarationPanel :execution-id="context.identity.executionId" :node-id="selected.routingNodeId" /></el-collapse-item></el-collapse>
    <p class="secondary">报工数量为加工完成总量（含不良），不良由质量申报独立记录并扣减可流转产出；末道报工只登记事实；正常品及不良入库审核后统一核对执行和工单收尾条件。待开工执行的首次报工还会校验正式领料确认。</p>
   </section>
   <el-empty v-else-if="!loading" description="请扫描或输入生产执行身份码" />
  </template>
 </div>
</template>
<style scoped>
.reporting-scan { display: flex; flex-wrap: wrap; align-items: flex-end; gap: var(--ui-space-3); }
.reporting-scan .el-form-item { flex: 0 1 640px; min-width: min(100%, 320px); max-width: 100%; margin: 0; }
.reporting-scan :deep(.el-form-item__label) { height: auto; line-height: 1.5; }
.reporting-scan .el-button { flex-shrink: 0; margin-left: 0; }
.report-form { margin-top: var(--mes-space-5, 20px); max-width: 640px; }
.report-form .el-select { width: 100%; }
.report-form .el-button, .filter-panel .el-button { min-height: 44px; }
.reporting-page :deep(.el-input__wrapper), .reporting-page :deep(.el-select__wrapper) { min-height: 44px; }
.reporting-scan :deep(.el-form-item__content) { min-width: 0; }
/* The shared compact-filter widths use !important at each desktop breakpoint. */
.reporting-page .reporting-scan :deep(.el-input) { width: 100% !important; }
.panel { padding: var(--mes-space-4, 16px); }
</style>
