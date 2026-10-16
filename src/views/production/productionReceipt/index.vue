<script setup lang="ts">
import ExecutionIdentityLookup from '@/components/business/production/ExecutionIdentityLookup.vue'
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import Pagination from '@/components/Pagination/index.vue'
import WorkOrderSelect from '@/components/business/production/WorkOrderSelect.vue'
import ExecutionSelect from '@/components/business/production/ExecutionSelect.vue'
import WarehouseSelect from '@/components/business/WarehouseSelect.vue'
import { productionReceipt as api, receiptPermissions as perms, type Receipt, type ReceiptSummary, type Receive, type Reverse } from '@/api/production/productionReceipt'
import { useAuth } from '@/stores/auth'
import { ApiError } from '@/lib/request'
const auth = useAuth(), route = useRoute()
const allowed = computed(() => auth.hasPermission(perms.list, 'factory'))
const canCreate = computed(() => auth.hasPermission(perms.create, 'factory'))
const canReverse = computed(() => auth.hasPermission(perms.reverse, 'factory'))
const canDetail = computed(() => auth.hasPermission(perms.detail, 'factory'))
const workorderId = ref<string | null>(null), executionId = ref(''), warehouseId = ref<string | null>(null), lot = ref('')
const rows = ref<Receipt[]>([]), summary = ref<ReceiptSummary | null>(null), total = ref(0), page = ref(1), limit = ref(20)
const loading = ref(false), error = ref(''), summaryError = ref(''), success = ref('')
const detail = ref<{record: Receipt; originalBalance: string} | null>(null), history = ref<Receipt[]>([]), historyTotal = ref(0), historyPage = ref(1), detailOpen = ref(false), detailLoading = ref(false), detailError = ref('')
const reverseBalance = ref('')
const formOpen = ref(false), mode = ref<'receive' | 'reverse'>('receive'), originalId = ref(''), formError = ref(''), saving = ref(false)
const form = reactive({ warehouseId: null as string | null, productLotCode: '', quantity: '', reason: '' })
const pending = ref<{mode: 'receive'; body: Receive} | {mode: 'reverse'; id: string; body: Reverse} | null>(null)
let generation = 0, listSeq = 0, summarySeq = 0, detailSeq = 0, historySeq = 0, writeSeq = 0
function closeState() { detailSeq++; historySeq++; writeSeq++; detailOpen.value = false; detail.value = null; history.value = []; historyTotal.value = 0; detailLoading.value = false; detailError.value = ''; formOpen.value = false; reverseBalance.value = ''; pending.value = null; saving.value = false; formError.value = ''; Object.assign(form, { warehouseId: null, productLotCode: '', quantity: '', reason: '' }) }
function invalidate() { generation++; listSeq++; summarySeq++; rows.value = []; total.value = 0; summary.value = null; loading.value = false; error.value = ''; summaryError.value = ''; success.value = ''; closeState() }
watch(workorderId, () => { executionId.value = ''; page.value = 1; invalidate() }, { flush: 'sync' })
watch(executionId, () => { page.value = 1; invalidate() }, { flush: 'sync' })
watch([warehouseId, lot], () => { page.value = 1; listSeq++; rows.value = []; total.value = 0; loading.value = false; error.value = ''; closeState() }, { flush: 'sync' })
watch(() => [auth.factoryId, auth.revision, allowed.value, canCreate.value, canReverse.value, canDetail.value], () => {
 invalidate(); workorderId.value = null; executionId.value = ''; warehouseId.value = null; lot.value = ''; page.value = 1
 if (allowed.value) void load()
}, { flush: 'sync' })
function query() { return { ...(workorderId.value ? {workorderId: workorderId.value} : {}), ...(executionId.value ? {executionId: executionId.value} : {}), ...(warehouseId.value ? {warehouseId: warehouseId.value} : {}), ...(lot.value.trim() ? {productLotCode: lot.value.trim()} : {}), offset: (page.value - 1) * limit.value, limit: limit.value } }
async function load() {
 if (!allowed.value) return
 const n = ++listSeq; loading.value = true; error.value = ''; rows.value = []; total.value = 0
 const s = ++summarySeq; summary.value = null; summaryError.value = ''
 const summaryTask = executionId.value ? api.summary(executionId.value).then(v => { if (s === summarySeq) summary.value = v }).catch(e => { if (s === summarySeq) summaryError.value = e instanceof Error ? e.message : '产出查询失败' }) : Promise.resolve()
 try { const p = await api.page(query()); if (n === listSeq) { rows.value = p.items; total.value = p.total } }
 catch (e) { if (n === listSeq) error.value = e instanceof Error ? e.message : '交接记录查询失败' }
 finally { if (n === listSeq) loading.value = false }
 await summaryTask
}
async function showDetail(row: Receipt) {
 if (!canDetail.value) return
 closeState(); detailOpen.value = true; detailLoading.value = true; historyPage.value = 1
 const n = ++detailSeq
 try { const d = await api.detail(row.id); if (n !== detailSeq) return; detail.value = d; await loadHistory() }
 catch (e) { if (n === detailSeq) detailError.value = e instanceof Error ? e.message : '详情查询失败' }
 finally { if (n === detailSeq) detailLoading.value = false }
}
async function loadHistory() {
 if (!detail.value || !canDetail.value) return
 const n = detailSeq, h = ++historySeq, id = detail.value.record.referenceReceiptId || detail.value.record.id
 const p = await api.page({ referenceReceiptId: id, offset: (historyPage.value - 1) * 20, limit: 20 })
 if (n === detailSeq && h === historySeq) { history.value = p.items; historyTotal.value = p.total }
}
async function historyChanged() { const n = detailSeq, h = historySeq + 1; try { await loadHistory() } catch (e) { if (n === detailSeq && h === historySeq) detailError.value = e instanceof Error ? e.message : '历史查询失败' } }
function openReceive() { if (!canCreate.value || !summary.value?.canReceive) return; closeState(); mode.value = 'receive'; form.warehouseId = warehouseId.value; form.productLotCode = lot.value; formOpen.value = true }
async function openReverse(row: Receipt) {
 if (!canReverse.value || !canDetail.value || row.recordType !== 'RECEIPT') return
 closeState(); mode.value = 'reverse'; originalId.value = row.id; formOpen.value = true
 const n = writeSeq
 try { const d = await api.detail(row.id); if (n === writeSeq) { form.quantity = d.originalBalance; reverseBalance.value = d.originalBalance } }
 catch (e) { if (n === writeSeq) formError.value = e instanceof Error ? e.message : '原始余额读取失败' }
}
function clearDetail() { detailSeq++; historySeq++; detail.value = null; history.value = []; historyTotal.value = 0; detailOpen.value = false; detailError.value = '' }
async function closeForm(done?: () => void) {
 if (form.quantity || form.reason || pending.value) { try { await ElMessageBox.confirm(pending.value ? '本次请求结果待核实，关闭后请按请求 UUID 核对事实，确认关闭？' : '放弃尚未提交的交接操作？', '关闭操作', {type: 'warning'}) } catch { return } }
 closeState(); done?.()
}
async function submit() {
 if (saving.value || !allowed.value || (mode.value === 'receive' ? !canCreate.value : !canReverse.value)) return
 if (!pending.value) {
  if (!/^(?:0|[1-9]\d{0,13})(?:\.\d{1,6})?$/.test(form.quantity) || !/[1-9]/.test(form.quantity)) { formError.value = '请输入最多六位小数的正数量'; return }
  if (mode.value === 'reverse' && !form.reason.trim()) { formError.value = '请填写冲销原因'; return }
  if (mode.value === 'receive' && (!summary.value?.canReceive || !form.warehouseId || !executionId.value)) { formError.value = '当前执行尚不允许交接或未选择仓库'; return }
  pending.value = mode.value === 'receive' ? {mode: 'receive', body: {executionId: executionId.value, warehouseId: form.warehouseId!, productLotCode: form.productLotCode.trim() || null, quantity: form.quantity, requestId: crypto.randomUUID()}} : {mode: 'reverse', id: originalId.value, body: {quantity: form.quantity, reason: form.reason.trim(), requestId: crypto.randomUUID()}}
 }
 const command = pending.value, n = ++writeSeq, g = generation; saving.value = true; formError.value = ''
 try {
  const r = command.mode === 'receive' ? await api.receive(command.body) : await api.reverse(command.id, command.body)
  if (n !== writeSeq || g !== generation) return
  pending.value = null; success.value = `生产交接已登记，尚未执行库存入账。记录编号：${r.receiptNo}`; closeState()
  await load()
 } catch (e) {
  if (n !== writeSeq || g !== generation) return
  if (e instanceof ApiError && e.status >= 400 && e.status < 500) pending.value = null
  formError.value = e instanceof Error ? e.message : '提交失败'
 } finally { if (n === writeSeq) saving.value = false }
}
watch(() => [route.query.executionId, route.query.workorderId], () => {
 const e = route.query.executionId, w = route.query.workorderId
 workorderId.value = typeof w === 'string' && /^[1-9]\d{0,18}$/.test(w) ? w : null
 executionId.value = typeof e === 'string' && /^[1-9]\d{0,18}$/.test(e) ? e : ''
 if (allowed.value) void load()
}, { immediate: true })
onBeforeUnmount(invalidate)
</script>
<template>
 <div class="app-container receipt-page">
  <PageHeader title="生产交接管理" description="登记实际交接、查询不可变历史与冲销；交接额度来自锁定实际路径的末道有效产出。" />
  <el-alert title="生产交接已登记，尚未执行库存入账。" description="本模块仅记录车间向仓库的交接事实，不改变库存、ERP 或生产执行状态。" type="info" :closable="false" show-icon />
  <el-alert v-if="!allowed" title="当前账号没有生产交接查询权限" type="warning" :closable="false" />
  <template v-else>
   <el-form inline class="filter-panel receipt-filters" @submit.prevent="page=1;load()">
    <ExecutionIdentityLookup selectable @selected="i => { workorderId = i.workorderId; executionId = i.executionId }" />
   <el-form-item label="工单"><WorkOrderSelect v-model="workorderId" /></el-form-item>
    <el-form-item label="执行单元"><ExecutionSelect v-model="executionId" :workorder-id="workorderId" /></el-form-item>
    <el-form-item label="目标仓库"><WarehouseSelect v-model="warehouseId" /></el-form-item>
    <el-form-item label="产品批次"><el-input v-model="lot" clearable maxlength="100" placeholder="按实际产品批次精确查询" /></el-form-item>
    <el-button type="primary" :loading="loading" @click="page=1;load()">查询</el-button>
   </el-form>
   <el-alert v-if="success" :title="success" type="success" :closable="false" />
   <el-alert v-if="error || summaryError" :title="error || summaryError" type="error" :closable="false" />
   <section v-if="summary" class="panel receipt-summary" aria-label="当前执行交接数量">
    <h3>{{ summary.executionNo }} · {{ summary.productCode }} / {{ summary.productName }}</h3>
    <p class="secondary">工单 {{ summary.workorderCode }} · {{ summary.routingLabel }} · 末道：{{ summary.terminalNodeName || '尚未确定' }}</p>
    <el-descriptions :column="2" border>
     <el-descriptions-item label="执行目标">{{ summary.targetQty }}</el-descriptions-item><el-descriptions-item label="末道有效产出 O">{{ summary.output ?? '无法确定' }}</el-descriptions-item>
     <el-descriptions-item label="已交接净额 R">{{ summary.received }}</el-descriptions-item><el-descriptions-item label="剩余可交接 O − R">{{ summary.remaining ?? '无法确定' }}</el-descriptions-item>
     <el-descriptions-item label="超额差额">{{ summary.excess ?? '无法确定' }}</el-descriptions-item><el-descriptions-item label="实际路径">{{ ({UNSELECTED: '尚未选择', SELECTED: '已选择，未锁定', LOCKED: '已锁定'} as Record<string, string>)[summary.pathStatus] || summary.pathStatus }}</el-descriptions-item>
    </el-descriptions>
    <el-alert v-if="summary.excess && /[1-9]/.test(summary.excess)" :title="`已交接超过当前有效产出 ${summary.excess}，禁止新增交接，可按原始余额冲销交接。`" type="error" :closable="false" />
    <el-alert v-if="!summary.canReceive" :title="summary.blockedReason" type="warning" :closable="false" />
   </section>
   <div class="table-toolbar"><span>交接事实 · {{ total }} 条</span><div class="receipt-actions"><el-button v-if="canCreate" type="primary" :disabled="!summary?.canReceive" @click="openReceive">登记交接</el-button><el-button @click="load">刷新数量与记录</el-button></div></div>
   <p v-if="!executionId" class="secondary">可独立查询全部交接记录；选择执行单元后查看产出与额度。</p>
   <el-table v-loading="loading" :data="rows" row-key="id">
    <el-table-column prop="receiptNo" label="记录编号" min-width="220" show-overflow-tooltip />
    <el-table-column prop="executionNo" label="执行编号" min-width="180" /><el-table-column prop="workorderCode" label="工单" min-width="160" />
    <el-table-column label="产出物料" min-width="190"><template #default="{row}">{{ row.productCode }} / {{ row.productName || '名称未记录' }}</template></el-table-column>
    <el-table-column label="类型" width="90"><template #default="{row}">{{ row.recordType === 'RECEIPT' ? '交接' : '冲销' }}</template></el-table-column>
    <el-table-column prop="quantityDelta" label="数量变化" min-width="145" /><el-table-column label="目标仓库" min-width="160"><template #default="{row}">{{ row.warehouseName || '名称未记录' }}</template></el-table-column>
    <el-table-column prop="productLotCode" label="产品批次" min-width="150" /><el-table-column label="实际人员" min-width="130"><template #default="{row}">{{ row.operatorName || '姓名未记录' }}</template></el-table-column>
    <el-table-column label="录入人员" min-width="130"><template #default="{row}">{{ row.recordedByName || '姓名未记录' }}</template></el-table-column><el-table-column prop="occurredAt" label="实际发生时间" min-width="200" /><el-table-column prop="createTime" label="登记时间" min-width="200" />
    <el-table-column label="操作" width="150" fixed="right"><template #default="{row}"><el-button v-if="canDetail" link type="primary" @click="showDetail(row)">详情</el-button><el-button v-if="canReverse && canDetail && row.recordType === 'RECEIPT'" link type="danger" @click="openReverse(row)">冲销</el-button></template></el-table-column>
   </el-table>
   <Pagination v-model:page="page" v-model:limit="limit" :total="total" @pagination="load" />
  </template>
  <el-dialog v-model="detailOpen" title="交接事实与冲销历史" width="min(1000px, calc(100vw - 32px))" @close="clearDetail">
   <div v-loading="detailLoading"><el-alert v-if="detailError" :title="detailError" type="error" :closable="false" />
    <template v-if="detail"><p class="receipt-reference">{{ detail.record.receiptNo }}</p><p>原始交接当前余额：{{ detail.originalBalance }} · 实际交接人员：{{ detail.record.operatorName || '姓名未记录' }}</p><p>产品批次：{{ detail.record.productLotCode || '未填写' }} · 仓库：{{ detail.record.warehouseName || '名称未记录' }}</p><p>原始交接引用：{{ detail.record.referenceReceiptId || '本条为原始交接' }}</p><p>本条原因：{{ detail.record.reason || '无' }}</p>
     <el-table :data="history"><el-table-column prop="receiptNo" label="冲销编号" min-width="220" show-overflow-tooltip /><el-table-column prop="quantityDelta" label="数量变化" min-width="140" /><el-table-column prop="reason" label="原因" min-width="180" /><el-table-column prop="recordedByName" label="录入人员" min-width="130" /><el-table-column prop="createTime" label="登记时间" min-width="200" /></el-table>
     <Pagination v-model:page="historyPage" :limit="20" :total="historyTotal" @pagination="historyChanged" />
    </template></div>
  </el-dialog>
  <el-dialog v-model="formOpen" :title="mode === 'receive' ? '登记生产交接' : '冲销生产交接'" width="min(600px, calc(100vw - 32px))" :before-close="closeForm">
   <el-alert v-if="formError" :title="formError" type="error" :closable="false" />
   <el-alert v-if="pending" title="上次请求结果待核实，仅可用原 UUID 和原参数安全重试。" type="warning" :closable="false" />
   <p v-if="pending" class="receipt-reference">请求 UUID：{{ pending.body.requestId }}</p>
   <el-form label-position="top" @submit.prevent="submit">
    <template v-if="mode === 'receive'"><el-form-item label="目标仓库"><WarehouseSelect v-model="form.warehouseId" :disabled="!!pending || saving" /></el-form-item><el-form-item label="产品批次（可空）"><el-input v-model="form.productLotCode" maxlength="100" :disabled="!!pending || saving" /></el-form-item></template>
    <p v-else>仓库、产品批次、实际操作人及发生时间继承原始交接。剩余余额：{{ reverseBalance || '读取中' }}</p>
    <el-form-item label="本次数量（正数）"><el-input v-model="form.quantity" inputmode="decimal" :disabled="!!pending || saving" /></el-form-item>
    <el-form-item v-if="mode === 'reverse'" label="冲销原因"><el-input v-model="form.reason" type="textarea" maxlength="500" :disabled="!!pending || saving" /></el-form-item>
   </el-form>
   <template #footer><el-button @click="closeForm()">取消</el-button><el-button type="primary" :loading="saving" :disabled="mode === 'reverse' && !/[1-9]/.test(reverseBalance)" @click="submit">{{ pending ? '安全重试原请求' : mode === 'receive' ? '登记交接' : '确认冲销' }}</el-button></template>
  </el-dialog>
 </div>
</template>
<style scoped>
.receipt-page > .el-alert, .receipt-summary .el-alert { margin-bottom: var(--ui-space-4); }
.receipt-filters :deep(.el-select), .receipt-filters :deep(.el-input) { width: 240px; max-width: 100%; }
.receipt-summary { padding: var(--ui-space-4); margin-block: var(--ui-space-4); }
.receipt-summary h3 { margin-top: 0; }
.receipt-summary :deep(.el-descriptions) { margin-bottom: 16px; }
.receipt-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.receipt-reference { overflow-wrap: anywhere; }
@media (max-width: 600px) {
 .receipt-filters { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; }
 .receipt-filters :deep(.el-form-item) { display: flex; flex-direction: column; align-items: stretch; width: 100%; margin: 0; }
 .receipt-filters :deep(.el-form-item__content), .receipt-filters :deep(.el-form-item__content > div) { width: 100%; min-width: 0; }
 .receipt-filters :deep(.el-form-item__label) { justify-content: flex-start; }
 .receipt-page .receipt-filters :deep(.el-select), .receipt-page .receipt-filters :deep(.el-input) { width: 100% !important; }
 .receipt-page :deep(.el-descriptions__cell) { word-break: break-word; }
 .receipt-page :deep(.el-button), .receipt-page :deep(.el-input__wrapper), .receipt-page :deep(.el-select__wrapper) { min-height: 44px; }
 .receipt-page :deep(.table-toolbar) { flex-wrap: wrap; gap: 8px; }
}
</style>
