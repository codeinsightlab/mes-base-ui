<script setup lang="ts">
import QuantityText from '@/components/business/production/QuantityText.vue'
import { displayQuantity, quantityColumn } from '@/lib/production/quantity'
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ApiError } from '@/lib/request'
import { useAuth } from '@/stores/auth'
import Pagination from '@/components/Pagination/index.vue'
import { executionActions, type PathView } from '@/api/production/executionActions'
import { productionReport as api, reportPermissions, type ExecutionQuantity, type NodeQuantity, type Ledger, type Detail, type HistoricalUser } from '@/api/production/productionReport'
const props = defineProps<{ executionId: string }>()
const emit = defineEmits<{ changed: [] }>()
const auth = useAuth(), visible = ref(false), loading = ref(false), error = ref('')
const quantity = ref<ExecutionQuantity | null>(null), nodeId = ref(''), rows = ref<Ledger[]>([]), total = ref(0), page = ref(1), limit = ref(20), ledgerLoading = ref(false)
const node = computed(() => quantity.value?.nodes.find(n => n.routingNodeId === nodeId.value))
const path = ref<PathView | null>(null), pathError = ref(''), ledgerError = ref('')
const ledgerNodes = computed(() => quantity.value?.nodes ?? path.value?.selectedNodeIds.flatMap(id => {
 const n = path.value!.nodes.find(n => n.id === id)
 return n ? [{ routingNodeId: n.id, code: n.nodeCode, name: n.operationName }] : []
}) ?? [])
const ledgerNode = computed(() => ledgerNodes.value.find(n => n.routingNodeId === nodeId.value))
// This manager edits historical facts; writable only describes normal forward reporting.
const historyWritable = computed(() => quantity.value?.pathStatus === 'LOCKED')
const can = (action: keyof typeof reportPermissions) => auth.hasPermission(reportPermissions[action], 'factory')
const command = ref<'supplement' | 'adjust' | 'void' | null>(null), original = ref<Ledger | null>(null), saving = ref(false), commandError = ref('')
const pending = ref<{ requestId: string; uncertain: boolean; mode: 'supplement' | 'adjust' | 'void'; originalId: string | null; executionId: string; nodeId: string; form: typeof form } | null>(null)
const pendingKey = () => 'mes-admin-report-pending:' + auth.username + ':' + auth.factoryId + ':' + props.executionId
const form = reactive({ quantity: '', operatorUserId: '', reportTime: '', workstationId: '', reason: '' })
const users = ref<HistoricalUser[]>([]), userKeyword = ref(''), usersLoading = ref(false), userOffset = ref(0), usersMore = ref(false)
const historyVisible = ref(false), detail = ref<Detail | null>(null), history = ref<Ledger[]>([]), historyPage = ref(1), historyLimit = ref(20), historyTotal = ref(0), historyLoading = ref(false), historyError = ref('')
let generation = 0, ledgerSequence = 0, userSequence = 0, historySequence = 0
const commandTitle = computed(() => command.value === 'supplement' ? '管理员历史补录' : command.value === 'adjust' ? '管理员数量订正' : '原始报工整笔冲销')
function setCommandVisible(value: boolean) { if (!value && !pending.value) clearCommand() }
function clearCommand() { pending.value = null; userSequence++; command.value = null; original.value = null; users.value = []; usersLoading.value = false; saving.value = false; commandError.value = ''; Object.assign(form, { quantity: '', operatorUserId: '', reportTime: '', workstationId: '', reason: '' }) }
function clear() { generation++; ledgerSequence++; historySequence++; visible.value = false; quantity.value = null; path.value = null; pathError.value = ''; ledgerError.value = ''; rows.value = []; nodeId.value = ''; total.value = 0; page.value = 1; loading.value = false; ledgerLoading.value = false; error.value = ''; clearCommand(); historyVisible.value = false; detail.value = null; history.value = []; historyLoading.value = false }
watch(() => props.executionId, () => { clear(); if (props.executionId && can('quantity')) { visible.value = true; void refresh() } }, { flush: 'sync', immediate: true })
watch(() => [auth.factoryId, auth.revision, auth.factoryPermissions.join('|')], clear, { flush: 'sync' })
onBeforeUnmount(clear)
async function refresh() {
 const ticket = ++generation; ledgerSequence++; loading.value = true; error.value = ''; pathError.value = ''; ledgerError.value = ''
 quantity.value = null; path.value = null; rows.value = []; total.value = 0
 let requestedNode = ''
 async function refreshLedger() {
  if (ticket !== generation || !visible.value) return
  if (!ledgerNodes.value.some(n => n.routingNodeId === nodeId.value)) { nodeId.value = ledgerNodes.value[0]?.routingNodeId ?? ''; page.value = 1 }
  if (!nodeId.value || nodeId.value === requestedNode) return
  requestedNode = nodeId.value
  await loadLedger()
 }
 const reads = [api.quantities(props.executionId).then(async value => {
  if (ticket !== generation || !visible.value) return
  quantity.value = value
  await refreshLedger()
 }).catch(e => {
  if (ticket === generation) error.value = e instanceof Error ? e.message : '数量读取失败'
 })]
 if (can('detail') && auth.hasPermission('business:mes:production:execution:query', 'factory')) {
  reads.push(executionActions.path(props.executionId).then(async value => {
   if (ticket !== generation || !visible.value) return
   path.value = value
   await refreshLedger()
  }).catch(e => {
   if (ticket === generation) pathError.value = e instanceof Error ? e.message : '实际节点读取失败'
  }))
 }
 try {
  await Promise.all(reads)
 } finally { if (ticket === generation) loading.value = false }
}
async function chooseNode(row: { routingNodeId: string }) { nodeId.value = row.routingNodeId; page.value = 1; await loadLedger() }
function selectLedgerNode(value: unknown) { void chooseNode({ routingNodeId: String(value) }) }
async function loadLedger() {
 const ticket = ++ledgerSequence; rows.value = []; total.value = 0; ledgerError.value = ''
 if (!visible.value || !nodeId.value || !can('detail')) return
 ledgerLoading.value = true
 try { const result = await api.page(props.executionId, nodeId.value, (page.value - 1) * limit.value, limit.value); if (ticket !== ledgerSequence) return; rows.value = result.items; total.value = result.total }
 catch(e) { if (ticket === ledgerSequence) ledgerError.value = e instanceof Error ? e.message : '流水读取失败' }
 finally { if (ticket === ledgerSequence) ledgerLoading.value = false }
}
async function openCommand(mode: 'supplement' | 'adjust' | 'void', row?: Ledger) {
 if (!can(mode) || !historyWritable.value || !node.value || mode === 'supplement' && node.value.positiveReportBlockReason || row && row.recordType !== 'REPORT') return
 clearCommand(); command.value = mode; original.value = row ?? null
 const saved = sessionStorage.getItem(pendingKey())
 if (saved) {
  try { pending.value = {...JSON.parse(saved), uncertain: true}; command.value = pending.value!.mode; Object.assign(form, pending.value!.form); commandError.value = '存在结果待确认的原请求，请原样重试核实；不会创建新请求。' } catch { commandError.value = '待确认请求无法读取，请保留记录并联系管理员'; return }
 }
 if (mode === 'supplement') { userKeyword.value = ''; await loadUsers('') }
}
async function loadUsers(keyword: string, more = false) {
 if (command.value !== 'supplement') return
 userKeyword.value = keyword; if (!more) userOffset.value = 0
 const ticket = ++userSequence; usersLoading.value = true; commandError.value = ''
 try { const result = await api.users(keyword, userOffset.value); if (ticket !== userSequence) return; users.value = more ? [...users.value, ...result.items] : result.items; userOffset.value += result.items.length; usersMore.value = userOffset.value < result.total }
 catch(e) { if (ticket === userSequence) commandError.value = e instanceof Error ? e.message : '人员读取失败' }
 finally { if (ticket === userSequence) usersLoading.value = false }
}
async function save() {
 const mode = command.value
 if (!mode || saving.value || !can(mode) || !historyWritable.value || !node.value) return
 if (!form.reason.trim() || form.reason.length > 500) { commandError.value = '请填写操作原因（最多500字）'; return }
 if (mode !== 'void' && (!/^[+-]?\d{1,14}(\.\d{1,2})?$/.test(form.quantity) || !/[1-9]/.test(form.quantity) || mode === 'supplement' && form.quantity.startsWith('-'))) { commandError.value = '请输入非零数量，最多14位整数和2位小数；补录必须为正数'; return }
 if (mode === 'supplement' && (!form.operatorUserId || !form.reportTime)) { commandError.value = '请选择历史操作人员并填写实际生产时间'; return }
 if (form.workstationId && !/^[1-9]\d*$/.test(form.workstationId)) { commandError.value = '工作站编号应为正整数'; return }
 if (!pending.value) {
  pending.value = { requestId: crypto.randomUUID(), uncertain: false, mode, originalId: original.value?.id ?? null, executionId: props.executionId, nodeId: node.value.routingNodeId, form: { ...form } }
  sessionStorage.setItem(pendingKey(), JSON.stringify(pending.value))
 }
 const intent = pending.value, body = intent.form, storageKey = pendingKey()
 const ticket = generation; saving.value = true; commandError.value = ''
 try {
  if (intent.mode === 'supplement') await api.supplement({ requestId: intent.requestId, executionId: intent.executionId, routingNodeId: intent.nodeId, quantity: body.quantity, operatorUserId: body.operatorUserId, reportTime: body.reportTime, workstationId: body.workstationId || null, reason: body.reason.trim() })
  else if (intent.mode === 'adjust') await api.adjust(intent.originalId!, body.quantity, body.reason.trim(), intent.requestId)
  else await api.void(intent.originalId!, body.reason.trim(), intent.requestId)
  sessionStorage.removeItem(storageKey)
  if (ticket !== generation) return
  clearCommand(); ElMessage.success('数量流水已追加'); await refresh(); emit('changed')
 } catch(e) {
  // A first-attempt local rejection rolls back. A later rejection cannot disprove an earlier unknown commit.
  if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.code !== 'REPORT_REQUEST_CONFLICT' && !intent.uncertain) {
   sessionStorage.removeItem(storageKey); if (ticket === generation) pending.value = null
  } else { intent.uncertain = true; sessionStorage.setItem(storageKey, JSON.stringify(intent)) }
  if (ticket === generation) commandError.value = (e instanceof Error ? e.message : '提交失败') + (pending.value ? '；结果待确认，请使用同一请求原样重试。' : '；请求已拒绝且未追加事实，可以修改后重新提交。')
 }
 finally { if (ticket === generation) saving.value = false }
}
async function closeCommand(done: () => void = clearCommand) {
 if (saving.value) return
 if (pending.value) { commandError.value = '原请求结果待确认，请原样重试核实后再关闭。'; return }
 const ticket = generation
 if (Object.values(form).some(Boolean)) { try { await ElMessageBox.confirm('尚有未提交的报工编辑，是否放弃？', '关闭编辑', { type: 'warning' }) } catch { return } }
 if (ticket === generation) { clearCommand(); done() }
}
async function openHistory(row: Ledger) {
 if (!can('detail')) return
 historySequence++; detail.value = null; history.value = []; historyVisible.value = true; historyPage.value = 1
 const originalId = row.referenceReportId ?? row.id
 await loadHistory(originalId)
}
async function loadHistory(id = detail.value?.record.id) {
 if (!id || !historyVisible.value) return
 const ticket = ++historySequence; historyLoading.value = true; historyError.value = ''
 try { const [d, h] = await Promise.all([api.detail(id), api.history(id, (historyPage.value - 1) * historyLimit.value, historyLimit.value)]); if (ticket !== historySequence) return; detail.value = d; history.value = h.items; historyTotal.value = h.total }
 catch(e) { if (ticket === historySequence) historyError.value = e instanceof Error ? e.message : '调整历史读取失败' }
 finally { if (ticket === historySequence) historyLoading.value = false }
}
function closeHistory() { historySequence++; historyVisible.value = false; detail.value = null; history.value = [] }
const person = (name: string | null | undefined, id: string) => name || `用户 ${id}（名称未记录）`
const time = (value: string) => value.replace('T', ' ').replace(/\.\d+$/, '')
</script>
<template>
 <section v-if="visible && can('quantity')" aria-label="生产数量与报工管理">
  <el-alert v-if="error" :title="error" type="error" :closable="false" />
  <div class="table-toolbar"><strong>{{ '执行 ' + executionId }}</strong><span v-if="quantity">计划数量：<QuantityText :value="quantity.targetQty" /> · 确认投产：<QuantityText :value="quantity.confirmedInputQty" /> · 撤销预留：<QuantityText :value="quantity.reservedInputQty" /> · 可支用投产额度：<QuantityText :value="quantity.productionInputQty" /> · 实际工艺：{{ quantity.routingLabel || '工艺名称未记录' }}</span><el-button :loading="loading" @click="refresh">刷新数量</el-button></div>
  <el-alert title="当前净产出按正式报工与有效不良计算。不良入仓不会增加产出，入库审核后核对完结条件。" type="info" :closable="false" />
  <p v-if="quantity && !quantity.writable" class="secondary">当前不可继续正常报工；历史补录、订正及冲销仍按独立权限与业务约束校验。</p>
  <el-alert v-if="quantity?.boundary" :title="quantity.boundary" type="warning" :closable="false" />
  <el-alert v-if="quantity?.nodes.some(n => n.historicalConflict)" title="部分工序的已报数量超过当前有效输入，请核对报工和不良记录；新增报工仍按当前有效输入校验。" type="warning" :closable="false" />
  <el-alert v-if="!quantity && !loading && error" title="生产数量暂不能可靠计算，派生数量待确认；原始报工可在下方独立查看。" type="warning" :closable="false" />
  <el-alert v-if="!quantity && pathError" :title="'实际节点读取失败：' + pathError" type="error" :closable="false" />
  <el-table v-if="quantity" v-loading="loading" :data="quantity.nodes" row-key="routingNodeId" :current-row-key="nodeId" border highlight-current-row empty-text="暂无已确定的执行路径" @row-click="chooseNode">
   <el-table-column type="expand"><template #default="{row}">
    <div class="node-quality-details">
     <el-alert v-if="row.positiveReportBlockReason" :title="row.positiveReportBlockReason" type="warning" :closable="false" />
     <el-descriptions :column="2" border>
      <el-descriptions-item label="不良申报数量（含待核实和重复申报）"><QuantityText :value="row.defectQty" /></el-descriptions-item>
      <el-descriptions-item label="待核实不良数量"><QuantityText :value="row.unverifiedDefectQty" /></el-descriptions-item>
     </el-descriptions>
    </div>
   </template></el-table-column>
   <el-table-column prop="sequenceNo" label="顺序" width="75" />
   <el-table-column label="工序" min-width="190"><template #default="{row}"><el-button text type="primary" @click.stop="chooseNode(row)">{{ row.name || '工序名称未记录' }}</el-button><span class="secondary">{{ row.code }}</span></template></el-table-column>
   <el-table-column :formatter="quantityColumn" prop="inputQty" label="有效输入" min-width="130" />
   <el-table-column :formatter="quantityColumn" prop="reportedQty" label="累计报工" min-width="130" />
   <el-table-column label="有效不良" min-width="110"><template #default="{row}">{{ row.qualityIntegrated ? displayQuantity(row.netDefectQty) : '未接入' }}</template></el-table-column>
   <el-table-column :formatter="quantityColumn" prop="availableQty" label="剩余可报" min-width="130" />
   <el-table-column label="净产出" min-width="150"><template #default="{row}"><QuantityText :value="row.effectiveOutputQty" /><span v-if="row.positiveReportBlockReason"> · 待核实</span></template></el-table-column>
  </el-table>
  <section v-if="ledgerNode" class="report-ledger">
   <el-form v-if="!quantity" inline><el-form-item label="查看原始报工工序"><el-select :model-value="nodeId" @update:model-value="selectLedgerNode"><el-option v-for="n in ledgerNodes" :key="n.routingNodeId" :value="n.routingNodeId" :label="n.code + ' · ' + (n.name || '工序名称未记录')" /></el-select></el-form-item></el-form>
   <el-alert v-if="ledgerError" :title="ledgerError" type="error" :closable="false" />
   <el-alert v-if="node?.positiveReportBlockReason" :title="node.positiveReportBlockReason" type="warning" :closable="false" /><div class="table-toolbar"><strong>{{ ledgerNode.code }} · {{ ledgerNode.name || '工序名称未记录' }} — 数量流水</strong><el-button v-if="can('supplement')" type="primary" :disabled="!historyWritable || !!node?.positiveReportBlockReason" @click="openCommand('supplement')">管理员历史补录</el-button></div>
   <p class="secondary">数量流水只可追加；订正和冲销均保留原始报工及操作原因，报工只登记事实，入库审核后统一核对收尾条件。</p>
   <p v-if="!can('detail')" class="secondary">暂无查看报工流水的权限。</p>
   <template v-else>
    <el-table v-loading="ledgerLoading" :data="rows" border :empty-text="ledgerError ? '流水读取失败，请刷新重试' : '当前节点暂无数量流水'">
     <el-table-column prop="id" label="流水编号" min-width="120" /><el-table-column label="类型" width="100"><template #default="{row}">{{ row.recordType === 'REPORT' ? '原始报工' : '数量调整' }}</template></el-table-column>
     <el-table-column :formatter="quantityColumn" prop="quantityDelta" label="数量变化" min-width="140" /><el-table-column prop="referenceReportId" label="原始流水" min-width="120" />
     <el-table-column label="实际操作人" min-width="150"><template #default="{row}"><span :title="'用户 ID：' + row.operatorUserId">{{ person(row.operatorName,row.operatorUserId) }}</span></template></el-table-column><el-table-column label="提交人" min-width="150"><template #default="{row}"><span :title="'用户 ID：' + row.recordedBy">{{ person(row.recordedByName,row.recordedBy) }}</span></template></el-table-column>
     <el-table-column label="生产时间" min-width="180"><template #default="{row}">{{ time(row.reportTime) }}</template></el-table-column>
     <el-table-column label="记录时间" min-width="180"><template #default="{row}">{{ time(row.createTime) }}</template></el-table-column><el-table-column prop="reason" label="原因" min-width="200" show-overflow-tooltip />
     <el-table-column label="操作" min-width="240" fixed="right"><template #default="{row}">
      <el-button text type="primary" @click="openHistory(row)">调整历史</el-button>
      <el-button v-if="row.recordType === 'REPORT' && can('adjust')" text type="primary" :disabled="!historyWritable" @click="openCommand('adjust', row)">数量订正</el-button>
      <el-button v-if="row.recordType === 'REPORT' && can('void')" text type="danger" :disabled="!historyWritable" @click="openCommand('void', row)">整笔冲销</el-button>
     </template></el-table-column>
    </el-table>
    <Pagination v-model:page="page" v-model:limit="limit" :total="total" :auto-scroll="false" @pagination="loadLedger" />
   </template>
  </section>
 </section>
 <el-dialog v-model="historyVisible" title="原始报工与调整历史" width="min(1040px, 94vw)" append-to-body destroy-on-close @close="closeHistory">
  <el-alert v-if="historyError" :title="historyError" type="error" :closable="false" />
  <p v-if="detail">原始流水 {{ detail.record.id }} · 原始数量 <QuantityText :value="detail.record.quantityDelta" /> · 当前有效余额 <QuantityText :value="detail.originalEffectiveQty" /> · 操作人 {{ person(detail.record.operatorName,detail.record.operatorUserId) }}</p>
  <el-table v-loading="historyLoading" :data="history" border empty-text="暂无调整记录"><el-table-column prop="id" label="流水编号" /><el-table-column :formatter="quantityColumn" prop="quantityDelta" label="调整数量" /><el-table-column label="订正提交人"><template #default="{row}"><span :title="'用户 ID：' + row.recordedBy">{{ person(row.recordedByName,row.recordedBy) }}</span></template></el-table-column><el-table-column label="订正时间" min-width="180"><template #default="{row}">{{ time(row.createTime) }}</template></el-table-column><el-table-column prop="reason" label="原因" min-width="200" /></el-table>
  <Pagination v-model:page="historyPage" v-model:limit="historyLimit" :total="historyTotal" :auto-scroll="false" @pagination="loadHistory()" />
 </el-dialog>
 <el-dialog :model-value="Boolean(command)" :title="commandTitle" width="min(640px, 94vw)" append-to-body destroy-on-close :before-close="closeCommand" :show-close="!saving" :close-on-click-modal="!saving" :close-on-press-escape="!saving" @update:model-value="setCommandVisible">
  <el-alert v-if="commandError" :title="commandError" type="error" :closable="false" />
  <p>{{ quantity?.executionId }} · {{ node?.code }} · {{ node?.name || '工序名称未记录' }}</p>
  <p v-if="original">原始流水：{{ original.id }}，原始报工量：<QuantityText :value="original.quantityDelta" />。调整继承原操作人员及实际生产时间。</p>
  <p v-if="command === 'void'" class="secondary">将追加一笔负向调整，把原始报工当前有效余额调整为零；上下游数量仍须满足约束。</p>
  <el-form class="report-command" label-position="top" :disabled="saving || !!pending" @submit.prevent="save">
   <el-form-item v-if="command !== 'void'" :label="command === 'supplement' ? '本次加工完成数量' : '数量变化（正数增加，负数减少）'" required><el-input v-model="form.quantity" inputmode="decimal" /></el-form-item>
   <template v-if="command === 'supplement'">
    <el-form-item label="历史实际操作人员" required><el-select v-model="form.operatorUserId" filterable remote :remote-method="loadUsers" :loading="usersLoading" placeholder="输入昵称检索历史人员" aria-label="历史实际操作人员"><el-option v-for="u in users" :key="u.id" :value="u.id" :label="`${u.name}（${u.id}）`" /><template #footer><el-button v-if="usersMore" text :loading="usersLoading" @click="loadUsers(userKeyword, true)">加载更多人员</el-button><span v-else class="secondary">不按当前工序能力或派工名单限制历史补录</span></template></el-select></el-form-item>
    <el-form-item label="实际生产时间" required><el-date-picker v-model="form.reportTime" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" placeholder="选择实际生产时间" /></el-form-item>
    <el-form-item label="工作站编号（可选）"><el-input v-model="form.workstationId" /></el-form-item>
   </template>
   <el-form-item label="操作原因" required><el-input v-model="form.reason" type="textarea" :maxlength="500" show-word-limit /></el-form-item>
  </el-form>
  <template #footer><el-button :disabled="saving" @click="closeCommand()">取消</el-button><el-button type="primary" :loading="saving" @click="save">{{ command === 'void' ? '确认整笔冲销' : '追加数量流水' }}</el-button></template>
 </el-dialog>
</template>
<style scoped>
.report-command :deep(.el-select__input:focus-visible), .report-command :deep(.el-input__inner:focus-visible) { outline: none; }
.report-ledger { margin-top: var(--ui-space-5); }
.node-quality-details { padding: var(--ui-space-4); }
</style>
