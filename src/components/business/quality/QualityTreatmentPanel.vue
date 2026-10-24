<script setup lang="ts">
import { usePageMessageBox } from '@/lib/pageMessageBox'

import PageDialog from '@/components/page/PageDialog.vue'
import Pagination from '@/components/Pagination/index.vue'

import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'

import { parseTime } from '@/utils/ruoyi'
import WarehouseSelect from '@/components/business/WarehouseSelect.vue'
import QuantityText from '@/components/business/production/QuantityText.vue'
import { quantityInput } from '@/lib/production/quantity'
import { positiveQuantity, exceedsQuantity, qualityStateLabel, qualityStateTone, qualityReceiptLabel } from '@/lib/quality/presentation'
import { useAuth } from '@/stores/auth'
import { ApiError } from '@/lib/request'
import { qualityTreatment as api, type Treatment, type Disposition, type AssessmentCommand, type Attribution, type Event, treatmentActionLabel } from '@/api/quality/qualityTreatment'
import type { Version } from '@/api/quality/productionDefect'
const ElMessageBox = usePageMessageBox()

const props = defineProps<{ declarationId: string; candidates: Version[]; record?: Version; initialAction?: 'assess' | 'dispose' }>()
const emit = defineEmits<{ changed: []; pending: [value: boolean]; dirty: [value: boolean] }>()
const auth = useAuth()
const current = computed(() => props.record ?? props.candidates.find(d => d.declarationId === props.declarationId))
const allowed = computed(() => auth.hasPermission('business:quality:defect:read', 'factory'))
const writable = computed(() => auth.hasPermission('business:quality:defect:revise', 'factory') && !!view.value && !error.value && !loading.value && view.value.recordAction !== 'VOID' && view.value?.state !== 'UNRESOLVED')
const activeProduction = computed(() => !!current.value && (['READY', 'RUNNING'].includes(current.value.executionStatus ?? '') && ['DRAFT', 'RELEASED'].includes(current.value.workorderStatus ?? '')))
const view = ref<Treatment | null>(null), error = ref(''), loading = ref(false), busy = ref(false)
const events = ref<Event[]>([]), eventTotal = ref(0), eventPage = ref(1), eventLoading = ref(false), eventError = ref('')
let eventAttempt = 0
const actionOpen = ref(false), actionKind = ref<'assess' | 'dispose'>('dispose'), formError = ref(''), restoreError = ref(''), recoveryBlocked = ref(false)
const attribution = ref<Attribution>('INDEPENDENT'), related = ref<string | null>(null), basis = ref('')
const form = reactive({ quantity: '', warehouseId: null as string | null, reason: '' })
type Pending = { kind: 'assess'; command: AssessmentCommand } | { kind: 'dispose'; command: Disposition } | { kind: 'retired-return'; command: { requestId: string }}
const pending = ref<Pending | null>(null)
const canAssess = computed(() => writable.value && activeProduction.value && view.value?.attribution === 'UNVERIFIED')
const canTreat = computed(() => writable.value && activeProduction.value && view.value?.attribution === 'INDEPENDENT' && positiveQuantity(view.value.pendingDispositionQty))
const outstanding = computed(() => view.value && !['VOIDED', 'OVERLAP'].includes(view.value.state) ? view.value.pendingDispositionQty : '0')
const originalForm = ref('')
const snapshot = () => JSON.stringify({ form, attribution: attribution.value, related: related.value, basis: basis.value })
const dirty = computed(() => actionOpen.value && !!originalForm.value && snapshot() !== originalForm.value)
watch(() => pending.value != null && pending.value.kind !== 'retired-return' || busy.value, v => emit('pending', v), { flush: 'sync' })
watch(dirty, v => emit('dirty', v), { flush: 'sync' })
const relatedOptions = computed(() => props.candidates.filter(d => d.declarationId !== props.declarationId && d.executionId === view.value?.executionId && !['UNVERIFIED', 'UNRESOLVED'].includes(d.processingState) && d.recordAction !== 'VOID'))
let generation = 0, attempt = 0, uncertain = false, initialOpened = false
const pendingKey = () => `mes-quality-action:${auth.username}:${auth.factoryId}:${props.declarationId}`
function resetForm() { Object.assign(form, { quantity: '', warehouseId: null, reason: '' }); attribution.value = 'INDEPENDENT'; related.value = null; basis.value = ''; formError.value = '' }
function clear() { generation++; eventAttempt++;events.value = [];eventTotal.value = 0;eventPage.value = 1;eventLoading.value = false;eventError.value = ''; attempt++; view.value = null; error.value = ''; pending.value = null; busy.value = loading.value = false; actionOpen.value = false; recoveryBlocked.value = false; restoreError.value = ''; uncertain = false; initialOpened = false; originalForm.value = ''; resetForm() }
function restore() {
  try {
    const raw = sessionStorage.getItem(pendingKey()); if (!raw) return
    const saved = JSON.parse(raw) as { kind: string;command: { requestId: string;expectedRevision: number;destination?: string;quantity?: string;warehouseId?: string;assessment?: { type: string }}}
    if (!saved || !['assess', 'dispose'].includes(saved.kind) || typeof saved.command?.requestId !== 'string' || !Number.isInteger(saved.command.expectedRevision)) throw new Error('请求格式不完整')
    if (saved.kind === 'dispose' && saved.command.destination === 'RETURN_NODE') { pending.value = { kind: 'retired-return', command: { requestId: saved.command.requestId }}; uncertain = true; return }
    if (saved.kind === 'dispose' && (saved.command.destination !== 'WAREHOUSE' || typeof saved.command.quantity !== 'string' || typeof saved.command.warehouseId !== 'string') || saved.kind === 'assess' && (!saved.command.assessment || !['INDEPENDENT', 'OVERLAP'].includes(saved.command.assessment.type))) throw new Error('请求内容不完整')
    pending.value = saved as Pending; uncertain = true; actionKind.value = saved.kind as 'assess' | 'dispose'; actionOpen.value = true
  } catch { recoveryBlocked.value = true; restoreError.value = '待确认请求无法读取，请保留会话并联系管理员核对，避免重复处理。' }
}
async function load() {
  const scope = generation, ticket = ++attempt; if (!allowed.value) return
  loading.value = true; error.value = ''; view.value = null
  try {
    const data = await api.details(props.declarationId); if (scope !== generation || ticket !== attempt) return
    view.value = data

  } catch(e) { if (scope === generation && ticket === attempt)error.value = e instanceof Error ? e.message : '不良详情读取失败' } finally { if (scope === generation && ticket === attempt)loading.value = false }
  if (scope === generation && ticket === attempt && !initialOpened && props.initialAction && !pending.value && ((props.initialAction === 'assess' && canAssess.value) || (props.initialAction === 'dispose' && canTreat.value))) { initialOpened = true; openAction(props.initialAction) }
}
async function loadEvents() {
  const scope = generation, ticket = ++eventAttempt
  if (!allowed.value) return
  eventLoading.value = true;eventError.value = ''
  try { const page = await api.history(props.declarationId, (eventPage.value - 1) * 20, 20);if (scope !== generation || ticket !== eventAttempt) return;events.value = page.items;eventTotal.value = page.total } catch(e) { if (scope === generation && ticket === eventAttempt) { events.value = [];eventTotal.value = 0;eventError.value = e instanceof Error ? e.message : '处理记录读取失败' } } finally { if (scope === generation && ticket === eventAttempt)eventLoading.value = false }
}
async function checkPending() {
  const intent = pending.value
  if (!intent || intent.kind === 'retired-return' || busy.value || !auth.hasPermission('business:quality:defect:revise', 'factory')) return
  const scope = generation, key = pendingKey();busy.value = true;formError.value = ''
  try {
    await api.check(props.declarationId, intent.kind === 'assess' ? { kind: 'assess', assessment: intent.command } : { kind: 'dispose', disposition: intent.command })
    if (scope !== generation) return
    sessionStorage.removeItem(key);pending.value = null;uncertain = false;actionOpen.value = false;resetForm();emit('changed');void load();void loadEvents()
  } catch(e) { if (scope === generation)formError.value = e instanceof ApiError && e.status === 404 ? '尚未查到原请求；这不能证明此前未提交，请保留原请求核对。' : e instanceof Error ? e.message : '原请求核对失败，原请求仍保留' } finally { if (scope === generation)busy.value = false }
}
watch(() => [props.declarationId, auth.userId, auth.token, auth.factoryId, auth.revision, allowed.value, auth.hasPermission('business:quality:defect:revise', 'factory')], () => { clear();if (allowed.value) { if (auth.hasPermission('business:quality:defect:revise', 'factory'))restore();void load();void loadEvents() } }, { immediate: true, flush: 'sync' })
onBeforeUnmount(() => { clear();emit('dirty', false);emit('pending', false) })
function openAction(kind:'assess' | 'dispose') {
  if (recoveryBlocked.value || pending.value || (kind === 'assess' ? !canAssess.value : !canTreat.value)) return
  resetForm();actionKind.value = kind;actionOpen.value = true
  if (kind === 'dispose' && view.value?.pendingDispositionQty != null)form.quantity = quantityInput(view.value.pendingDispositionQty)
  originalForm.value = snapshot()
}
async function closeAction(done?:() => void) {
  if (busy.value) return
  if (pending.value) { formError.value = '请求结果尚未确认，请使用原请求核对结果。';return }
  if (dirty.value) { try { await ElMessageBox.confirm('是否放弃尚未提交的处理内容？', '关闭确认', { type: 'warning' }) } catch { return } }
  actionOpen.value = false;resetForm();done?.()
}
async function submit() {
  if (pending.value?.kind === 'retired-return') { formError.value = '原返工请求仅可查询历史记录，不再发送';return }
  if (!auth.hasPermission('business:quality:defect:revise', 'factory') || busy.value || recoveryBlocked.value || !pending.value && (!view.value || !writable.value)) return
  if (!pending.value) {
    if (!form.reason.trim()) { formError.value = '请填写处理说明';return }
    if (actionKind.value === 'assess') {
      if (!canAssess.value || !basis.value.trim() || attribution.value === 'OVERLAP' && !related.value) { formError.value = '请完整填写核实结论和说明';return }
      pending.value = { kind: 'assess', command: { requestId: crypto.randomUUID(), expectedRevision: view.value!.revision, reason: form.reason.trim(), assessment: { type: attribution.value, relatedDeclarationId: attribution.value === 'OVERLAP' ? related.value : null, basis: basis.value.trim() }}}
    } else {
      if (!canTreat.value) return
      if (!/^\d{1,14}(?:\.\d{1,2})?$/.test(form.quantity) || !positiveQuantity(form.quantity)) { formError.value = '数量须大于零，最多两位小数';return }
      if (view.value!.pendingDispositionQty == null) { formError.value = '处置数量待确认，暂不能提交处理';return }
      if (exceedsQuantity(form.quantity, view.value!.pendingDispositionQty)) { formError.value = '处理数量不能超过待处理数量';return }
      if (!form.warehouseId) { formError.value = '请选择接收仓库';return }
      pending.value = { kind: 'dispose', command: { requestId: crypto.randomUUID(), expectedRevision: view.value!.revision, destination: 'WAREHOUSE', quantity: form.quantity, warehouseId: form.warehouseId, reason: form.reason.trim() }}
    }
  }
  const storageKey = pendingKey(), scope = generation
  try { sessionStorage.setItem(storageKey, JSON.stringify(pending.value)) } catch { formError.value = '无法保存本次请求，尚未发送。请恢复会话存储后重试。';return }
  busy.value = true;formError.value = ''
  try {
    const result = pending.value.kind === 'assess' ? await api.assess(props.declarationId, pending.value.command) : await api.dispose(props.declarationId, pending.value.command)
    sessionStorage.removeItem(storageKey);if (scope !== generation) return
    view.value = result;pending.value = null;uncertain = false;actionOpen.value = false;resetForm();emit('changed');void loadEvents()
  } catch(e) { if (scope !== generation) return;formError.value = e instanceof Error ? e.message : '处理结果待确认';if (e instanceof ApiError && e.status >= 400 && e.status < 500 && !uncertain) { sessionStorage.removeItem(storageKey);pending.value = null } else uncertain = true } finally { if (scope === generation)busy.value = false }
}
</script>
<template>
  <section class="defect-detail" aria-label="不良详情">
    <el-alert v-if="restoreError" :title="restoreError" type="error" :closable="false" />
    <div v-if="allowed" v-loading="loading" aria-label="质量数量摘要"><el-button :disabled="busy" @click="load">刷新数量摘要</el-button>
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <template v-if="view && allowed">
        <div class="detail-heading"><div><el-tag :type="qualityStateTone(view.state)">{{ qualityStateLabel(view.state) }}</el-tag><p class="detail-subject">{{ current?.defectTypeNameSnapshot || current?.defectReason || '不良记录' }}</p><span class="secondary">{{ current?.workorderCode }}<template v-if="current?.productName"> · {{ current.productName }}</template></span></div><div class="detail-actions"><el-button :disabled="busy" @click="load">刷新</el-button><el-button v-if="canAssess" type="primary" :disabled="!!pending || recoveryBlocked" @click="openAction('assess')">核实申报</el-button><el-button v-if="canTreat" type="primary" :disabled="!!pending || recoveryBlocked" @click="openAction('dispose')">办理入仓</el-button></div></div>
        <p v-if="view.state==='UNRESOLVED'" class="next-step">记录可正常查看；处置数量暂无法确认，相关数量显示为 —，核对后再处理。</p>
        <p v-else-if="view.state==='UNVERIFIED'" class="next-step">先确认是否与已有申报重复，核实后办理正式入仓。</p>
        <p v-else-if="view.state==='RETURNED'" class="next-step">本记录包含历史返回事实，保留原数量含义，不再提供返工新操作。</p>
        <p v-else-if="view.state==='TRANSFERRED'" class="next-step">已创建并审核入库单，转入接收仓库。</p>
        <p v-else-if="view.state==='OVERLAP'" class="next-step">已标记为重复申报，不重复计入不良数量。</p>
        <p class="next-step">入仓状态：{{ qualityReceiptLabel(view.receiptState) }}</p>
        <el-alert v-if="pending?.kind==='retired-return'" title="原返工请求仅保留原身份供查询核对，不再发送或改派，请刷新处理记录。" type="warning" :closable="false" />
        <div class="quantity-summary" aria-label="不良数量去向"><div><span>申报数量</span><strong><QuantityText :value="view.defectQty" /></strong></div><div><span>{{ view.attribution==='UNVERIFIED'?'待核实':'待入仓数量' }}</span><strong><QuantityText :value="outstanding" /></strong></div><div><span>历史已返回</span><strong><QuantityText :value="view.returnedQty" /></strong></div><div><span>已入仓数量</span><strong><QuantityText :value="view.transferredQty" /></strong></div></div>
      </template></div>
    <section v-if="allowed && current" aria-label="不良基本信息">
      <h3>不良信息</h3>
      <el-descriptions :column="2" border><el-descriptions-item label="工单">{{ current?.workorderCode || '—' }}</el-descriptions-item><el-descriptions-item label="产品">{{ current?.productCode }} {{ current?.productName }}</el-descriptions-item><el-descriptions-item label="批次号">{{ current?.batchNo || '未记录' }}</el-descriptions-item><el-descriptions-item label="规格">{{ current?.specification || '—' }}</el-descriptions-item><el-descriptions-item label="申报工序">{{ current?.affectedNodeName || '—' }}</el-descriptions-item><el-descriptions-item label="申报人">{{ current?.reportedByName || '—' }}</el-descriptions-item><el-descriptions-item label="申报时间">{{ parseTime(current?.occurredAt) || '—' }}</el-descriptions-item><el-descriptions-item label="不良原因">{{ current?.defectReason || '—' }}</el-descriptions-item></el-descriptions>
    </section>
    <section v-if="allowed" v-loading="eventLoading" aria-label="处理记录分页">
      <h3>处理记录</h3><el-button @click="loadEvents">重新读取处理记录</el-button>
      <el-alert v-if="eventError" :title="eventError" type="error" :closable="false" />
      <el-empty v-if="!eventLoading && !eventError && !events.length" description="尚无处理记录" :image-size="48" />
      <el-timeline v-if="events.length" class="treatment-records"><el-timeline-item v-for="event in events" :key="event.id" :timestamp="parseTime(event.recordedAt) || ''" placement="top"><div class="record-heading"><strong>{{ treatmentActionLabel(event.actionType) }}</strong><span v-if="event.actionType==='RETURN_NODE'"> <QuantityText :value="event.returnedQty" /></span><span v-if="event.actionType==='TRANSFER_WAREHOUSE'"> <QuantityText :value="event.transferQty" /></span><span class="secondary"> · {{ event.operatorName || '操作人未返回' }}</span></div><p v-if="event.actionType==='ASSESS'">{{ event.attributionType==='INDEPENDENT'?'确认为独立申报':'确认为重复申报' }} · {{ event.basis }}</p><p v-else>{{ event.reason }}</p><p v-if="event.stockDocumentId" class="secondary">入库单 {{ event.stockDocumentId }} · 接收仓库 {{ event.targetWarehouseId }}</p></el-timeline-item></el-timeline>
      <Pagination v-model:page="eventPage" :total="eventTotal" :limit="20" @pagination="loadEvents" />
    </section>
    <section v-if="allowed">
      <details class="audit-records"><summary>操作留痕</summary><el-descriptions :column="1" border><el-descriptions-item label="不良记录编号">{{ declarationId }}</el-descriptions-item><el-descriptions-item label="当前版本">{{ view?.revision ?? current?.revisionNo ?? '—' }}</el-descriptions-item><el-descriptions-item label="执行单元">{{ current?.executionId || view?.executionId || '—' }}</el-descriptions-item></el-descriptions><slot name="versions" /></details>
    </section>
    <section v-if="pending" aria-label="原质量请求恢复">
      <el-alert title="原请求结果待确认，查询失败不会删除原请求。" type="warning" :closable="false" />
      <el-alert v-if="formError" :title="formError" type="error" :closable="false" />
      <el-button :disabled="busy || pending.kind==='retired-return'" @click="checkPending">精确核对原请求</el-button>
      <el-button :disabled="busy || pending.kind==='retired-return'" @click="submit">使用原请求重试</el-button>
    </section>
    <PageDialog v-model="actionOpen" :title="actionKind==='assess'?'核实不良申报':'办理不良入仓'" width="min(540px, 94vw)" append-to-body :before-close="closeAction" destroy-on-close>
      <el-alert v-if="formError" :title="formError" type="error" :closable="false" />
      <p v-if="pending" role="status">上次请求结果待确认，请使用原请求核对，避免重复处理。</p>
      <el-form label-position="top" :disabled="busy || !!pending" @submit.prevent="submit">
        <template v-if="actionKind==='assess'"><el-form-item label="核实结论"><el-radio-group v-model="attribution"><el-radio value="INDEPENDENT">独立申报</el-radio><el-radio value="OVERLAP">重复申报</el-radio></el-radio-group></el-form-item><el-form-item v-if="attribution==='OVERLAP'" label="关联原申报"><el-select v-model="related"><el-option v-for="row in relatedOptions" :key="row.declarationId" :value="row.declarationId" :label="`${row.defectTypeNameSnapshot || row.defectReason} · ${row.defectQty}`" /></el-select></el-form-item><el-form-item label="核实说明" required><el-input v-model="basis" type="textarea" maxlength="500" /></el-form-item></template>
        <template v-else><p>待处理数量：<QuantityText :value="view?.pendingDispositionQty" /></p><el-form-item label="处理数量" required><el-input v-model="form.quantity" inputmode="decimal" /></el-form-item><el-form-item label="接收仓库" required><WarehouseSelect v-model="form.warehouseId" :source="current?.source" :disabled="busy || !!pending" /></el-form-item><p class="secondary">创建正式入库单并审核，审核通过后执行入库。入仓后的流转与处置由仓储办理。</p></template>
        <el-form-item label="处理说明" required><el-input v-model="form.reason" type="textarea" maxlength="500" :rows="2" /></el-form-item>
      </el-form>
      <template #footer><el-button :disabled="busy || !!pending" @click="closeAction()">取消</el-button><el-button type="primary" :loading="busy" :disabled="recoveryBlocked||pending?.kind==='retired-return'" @click="submit">{{ pending?'核对上次结果':actionKind==='assess'?'确认核实':'创建并审核入库' }}</el-button></template>
    </PageDialog>
  </section>
</template>
<style scoped>
.detail-heading,.detail-actions{display:flex;align-items:center;gap:12px}.detail-heading{justify-content:space-between;margin-bottom:18px}.detail-subject{font-size:20px;font-weight:600;margin:12px 0 6px}.next-step{color:var(--el-text-color-secondary);line-height:1.7}.quantity-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border:1px solid var(--el-border-color-lighter);border-radius:6px;margin:20px 0 26px}.quantity-summary>div{padding:18px 20px;border-right:1px solid var(--el-border-color-lighter)}.quantity-summary>div:last-child{border-right:0}.quantity-summary>div>span{display:block;color:var(--el-text-color-secondary);font-size:13px}.quantity-summary strong{display:block;font-size:26px;margin-top:8px}.defect-detail h3{font-size:15px;margin:24px 0 16px}.treatment-records{padding-left:8px}.treatment-records p{margin:6px 0;line-height:1.7;overflow-wrap:anywhere}.audit-records{border-top:1px solid var(--el-border-color-lighter);padding-top:16px;margin-top:24px}.audit-records summary{cursor:pointer;color:var(--el-text-color-secondary);margin-bottom:12px}.defect-detail :deep(.el-descriptions__content){overflow-wrap:anywhere}@media(max-width:600px){.detail-heading{align-items:flex-start;flex-direction:column}.quantity-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.quantity-summary>div{padding:14px}.detail-actions{flex-wrap:wrap}}
</style>
