<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuth } from '@/stores/auth'
import Pagination from '@/components/Pagination/index.vue'
import { productionReport as api, reportPermissions, type ExecutionQuantity, type NodeQuantity, type Ledger, type Detail, type HistoricalUser } from '@/api/production/productionReport'
const props = defineProps<{ executionId: string }>()
const emit = defineEmits<{ changed: [] }>()
const auth = useAuth(), visible = ref(false), loading = ref(false), error = ref('')
const quantity = ref<ExecutionQuantity | null>(null), nodeId = ref(''), rows = ref<Ledger[]>([]), total = ref(0), page = ref(1), limit = ref(20), ledgerLoading = ref(false)
const node = computed(() => quantity.value?.nodes.find(n => n.routingNodeId === nodeId.value))
const can = (action: keyof typeof reportPermissions) => auth.hasPermission(reportPermissions[action], 'factory')
const command = ref<'supplement' | 'adjust' | 'void' | null>(null), original = ref<Ledger | null>(null), saving = ref(false), commandError = ref('')
const form = reactive({ quantity: '', operatorUserId: '', reportTime: '', workstationId: '', reason: '' })
const users = ref<HistoricalUser[]>([]), userKeyword = ref(''), usersLoading = ref(false), userOffset = ref(0), usersMore = ref(false)
const historyVisible = ref(false), detail = ref<Detail | null>(null), history = ref<Ledger[]>([]), historyPage = ref(1), historyLimit = ref(20), historyTotal = ref(0), historyLoading = ref(false), historyError = ref('')
let generation = 0, ledgerSequence = 0, userSequence = 0, historySequence = 0
const commandTitle = computed(() => command.value === 'supplement' ? '管理员历史补录' : command.value === 'adjust' ? '管理员数量订正' : '原始报工整笔冲销')
function setCommandVisible(value: boolean) { if (!value) clearCommand() }
function clearCommand() { userSequence++; command.value = null; original.value = null; users.value = []; usersLoading.value = false; saving.value = false; commandError.value = ''; Object.assign(form, { quantity: '', operatorUserId: '', reportTime: '', workstationId: '', reason: '' }) }
function clear() { generation++; ledgerSequence++; historySequence++; visible.value = false; quantity.value = null; rows.value = []; nodeId.value = ''; total.value = 0; page.value = 1; loading.value = false; ledgerLoading.value = false; error.value = ''; clearCommand(); historyVisible.value = false; detail.value = null; history.value = []; historyLoading.value = false }
watch(() => props.executionId, () => { clear(); if (props.executionId && can('quantity')) { visible.value = true; void refresh() } }, { flush: 'sync', immediate: true })
watch(() => [auth.factoryId, auth.revision, auth.factoryPermissions.join('|')], clear, { flush: 'sync' })
onBeforeUnmount(clear)
async function refresh() {
 const ticket = ++generation; loading.value = true; error.value = ''
 try { const result = await api.quantities(props.executionId); if (ticket !== generation || !visible.value) return; quantity.value = result; if (!result.nodes.some(n => n.routingNodeId === nodeId.value)) nodeId.value = result.nodes[0]?.routingNodeId ?? ''; await loadLedger() }
 catch(e) { if (ticket === generation) error.value = e instanceof Error ? e.message : '数量读取失败' }
 finally { if (ticket === generation) loading.value = false }
}
async function chooseNode(row: NodeQuantity) { nodeId.value = row.routingNodeId; page.value = 1; await loadLedger() }
async function loadLedger() {
 const ticket = ++ledgerSequence; rows.value = []; total.value = 0
 if (!visible.value || !nodeId.value || !can('detail')) return
 ledgerLoading.value = true
 try { const result = await api.page(props.executionId, nodeId.value, (page.value - 1) * limit.value, limit.value); if (ticket !== ledgerSequence) return; rows.value = result.items; total.value = result.total }
 catch(e) { if (ticket === ledgerSequence) error.value = e instanceof Error ? e.message : '流水读取失败' }
 finally { if (ticket === ledgerSequence) ledgerLoading.value = false }
}
async function openCommand(mode: 'supplement' | 'adjust' | 'void', row?: Ledger) {
 if (!can(mode) || !quantity.value?.writable || !node.value || row && row.recordType !== 'REPORT') return
 clearCommand(); command.value = mode; original.value = row ?? null
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
 if (!mode || saving.value || !can(mode) || !quantity.value?.writable || !node.value) return
 if (!form.reason.trim() || form.reason.length > 500) { commandError.value = '请填写操作原因（最多500字）'; return }
 if (mode !== 'void' && (!/^[+-]?\d{1,14}(\.\d{1,6})?$/.test(form.quantity) || !/[1-9]/.test(form.quantity) || mode === 'supplement' && form.quantity.startsWith('-'))) { commandError.value = '请输入非零数量，最多14位整数和6位小数；补录必须为正数'; return }
 if (mode === 'supplement' && (!form.operatorUserId || !form.reportTime)) { commandError.value = '请选择历史操作人员并填写实际生产时间'; return }
 if (form.workstationId && !/^[1-9]\d*$/.test(form.workstationId)) { commandError.value = '工作站编号应为正整数'; return }
 const ticket = generation; saving.value = true; commandError.value = ''
 try {
  if (mode === 'supplement') await api.supplement({ executionId: props.executionId, routingNodeId: node.value.routingNodeId, quantity: form.quantity, operatorUserId: form.operatorUserId, reportTime: form.reportTime, workstationId: form.workstationId || null, reason: form.reason.trim() })
  else if (mode === 'adjust') await api.adjust(original.value!.id, form.quantity, form.reason.trim())
  else await api.void(original.value!.id, form.reason.trim())
  if (ticket !== generation) return
  clearCommand(); ElMessage.success('数量流水已追加'); await refresh(); emit('changed')
 } catch(e) { if (ticket === generation) commandError.value = e instanceof Error ? e.message : '提交失败' }
 finally { if (ticket === generation) saving.value = false }
}
async function closeCommand(done: () => void = clearCommand) {
 if (saving.value) return
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
  <div class="table-toolbar"><strong>{{ quantity?.executionNo || '执行 ' + executionId }}</strong><span v-if="quantity">目标数量：{{ quantity.targetQty }} · 实际工艺：{{ quantity.routingLabel || '工艺名称未记录' }}</span><el-button :loading="loading" @click="refresh">刷新数量</el-button></div>
  <el-alert title="暂未接入质量扣减，当前可报数量按报工数据计算。" type="info" :closable="false" />
  <el-alert v-if="quantity?.boundary" :title="quantity.boundary" type="warning" :closable="false" />
  <el-table v-loading="loading" :data="quantity?.nodes || []" row-key="routingNodeId" :current-row-key="nodeId" max-height="280" border highlight-current-row empty-text="暂无已确定的执行路径" @row-click="chooseNode">
   <el-table-column prop="sequenceNo" label="路径顺序" width="90" />
   <el-table-column label="实际路径节点" min-width="190"><template #default="{row}"><el-button text type="primary" @click.stop="chooseNode(row)">{{ row.code }} · {{ row.name || '工序名称未记录' }}</el-button></template></el-table-column>
   <el-table-column prop="inputQty" label="上游输入" min-width="140" /><el-table-column prop="reportedQty" label="累计有效报工" min-width="140" /><el-table-column prop="availableQty" label="剩余可报" min-width="140" />
   <el-table-column label="质量扣减" min-width="110"><template #default="{row}">{{ row.qualityIntegrated ? row.defectQty : '未接入' }}</template></el-table-column>
   <el-table-column prop="effectiveOutputQty" label="可流转数量（未扣质量）" min-width="190" />
  </el-table>
  <section v-if="node" class="report-ledger">
   <div class="table-toolbar"><strong>{{ node.code }} · {{ node.name || '工序名称未记录' }} — 数量流水</strong><el-button v-if="can('supplement')" type="primary" :disabled="!quantity?.writable" @click="openCommand('supplement')">管理员历史补录</el-button></div>
   <p class="secondary">数量流水只可追加；订正和冲销均保留原始报工及操作原因，不自动完工。</p>
   <p v-if="!can('detail')" class="secondary">暂无查看报工流水的权限。</p>
   <template v-else>
    <el-table v-loading="ledgerLoading" :data="rows" border :empty-text="error ? '流水读取失败，请刷新重试' : '当前节点暂无数量流水'">
     <el-table-column prop="id" label="流水编号" min-width="120" /><el-table-column label="类型" width="100"><template #default="{row}">{{ row.recordType === 'REPORT' ? '原始报工' : '数量调整' }}</template></el-table-column>
     <el-table-column prop="quantityDelta" label="数量变化" min-width="140" /><el-table-column prop="referenceReportId" label="原始流水" min-width="120" />
     <el-table-column label="实际操作人" min-width="150"><template #default="{row}"><span :title="'用户 ID：' + row.operatorUserId">{{ person(row.operatorName,row.operatorUserId) }}</span></template></el-table-column><el-table-column label="提交人" min-width="150"><template #default="{row}"><span :title="'用户 ID：' + row.recordedBy">{{ person(row.recordedByName,row.recordedBy) }}</span></template></el-table-column>
     <el-table-column label="生产时间" min-width="180"><template #default="{row}">{{ time(row.reportTime) }}</template></el-table-column>
     <el-table-column label="记录时间" min-width="180"><template #default="{row}">{{ time(row.createTime) }}</template></el-table-column><el-table-column prop="reason" label="原因" min-width="200" show-overflow-tooltip />
     <el-table-column label="操作" min-width="240" fixed="right"><template #default="{row}">
      <el-button text type="primary" @click="openHistory(row)">调整历史</el-button>
      <el-button v-if="row.recordType === 'REPORT' && can('adjust')" text type="primary" :disabled="!quantity?.writable" @click="openCommand('adjust', row)">数量订正</el-button>
      <el-button v-if="row.recordType === 'REPORT' && can('void')" text type="danger" :disabled="!quantity?.writable" @click="openCommand('void', row)">整笔冲销</el-button>
     </template></el-table-column>
    </el-table>
    <Pagination v-model:page="page" v-model:limit="limit" :total="total" :auto-scroll="false" @pagination="loadLedger" />
   </template>
  </section>
 </section>
 <el-dialog v-model="historyVisible" title="原始报工与调整历史" width="min(1040px, 94vw)" append-to-body destroy-on-close @close="closeHistory">
  <el-alert v-if="historyError" :title="historyError" type="error" :closable="false" />
  <p v-if="detail">原始流水 {{ detail.record.id }} · 原始数量 {{ detail.record.quantityDelta }} · 当前有效余额 {{ detail.originalEffectiveQty }} · 操作人 {{ person(detail.record.operatorName,detail.record.operatorUserId) }}</p>
  <el-table v-loading="historyLoading" :data="history" border empty-text="暂无调整记录"><el-table-column prop="id" label="流水编号" /><el-table-column prop="quantityDelta" label="调整数量" /><el-table-column label="订正提交人"><template #default="{row}"><span :title="'用户 ID：' + row.recordedBy">{{ person(row.recordedByName,row.recordedBy) }}</span></template></el-table-column><el-table-column label="订正时间" min-width="180"><template #default="{row}">{{ time(row.createTime) }}</template></el-table-column><el-table-column prop="reason" label="原因" min-width="200" /></el-table>
  <Pagination v-model:page="historyPage" v-model:limit="historyLimit" :total="historyTotal" :auto-scroll="false" @pagination="loadHistory()" />
 </el-dialog>
 <el-dialog :model-value="Boolean(command)" :title="commandTitle" width="min(640px, 94vw)" append-to-body destroy-on-close :before-close="closeCommand" :show-close="!saving" :close-on-click-modal="!saving" :close-on-press-escape="!saving" @update:model-value="setCommandVisible">
  <el-alert v-if="commandError" :title="commandError" type="error" :closable="false" />
  <p>{{ quantity?.executionNo }} · {{ node?.code }} · {{ node?.name || '工序名称未记录' }}</p>
  <p v-if="original">原始流水：{{ original.id }}，原始报工量：{{ original.quantityDelta }}。调整继承原操作人员及实际生产时间。</p>
  <p v-if="command === 'void'" class="secondary">将追加一笔负向调整，把原始报工当前有效余额调整为零；上下游数量仍须满足约束。</p>
  <el-form class="report-command" label-position="top" :disabled="saving" @submit.prevent="save">
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
</style>
