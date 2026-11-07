<script setup lang="ts">
import QuantityText from '@/components/business/production/QuantityText.vue'
import MaterialIssueVoidAction from '@/components/business/MaterialIssueVoidAction.vue'
import { usePageMessageBox } from '@/lib/pageMessageBox'

import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import type { Row } from '@/lib/crud'
import { useAuth } from '@/stores/auth'
import { useClosureCommand } from '@/composables/useClosureCommand'
import { stockDocuments, stockDocumentPermission as p, stockDocumentPurpose, type MaterialIssueBasis, type ProductionInputBasis, type ApprovalIntent, type CancellationBasis, type ProductionBasis } from '@/api/wm/stockDocuments'
const ElMessageBox = usePageMessageBox()

const props = defineProps<{ row: Row;dirty: boolean;refresh: () => Promise<void> }>()
const emit = defineEmits<{ pending: [string | null] }>()
const auth = useAuth(), basis = ref<CancellationBasis | null>(null), production = ref<ProductionBasis | null>(null), inputBasis = ref<ProductionInputBasis | null>(null), error = ref(''), cancelBusy = ref(false)
const intent = useClosureCommand<ApprovalIntent>(() => `stock-document-post:${auth.username}:${auth.factoryId}:${props.row.id}`)
const materialIssueBasis = computed(() => props.row.materialIssueBasis as MaterialIssueBasis | null | undefined)
const canApprove = computed(() => !String(props.row.documentType).startsWith('TRANSFER_') && !materialIssueBasis.value && !props.row.materialIssueBasisError && !!props.row.id
  && auth.hasPermission(p + ':post', 'factory')
  && (!!intent.pending.value || props.row.status === 'DRAFT' && auth.runtimeMode === 'LOCAL'))
const canCancel = computed(() => !String(props.row.documentType).startsWith('TRANSFER_') && auth.runtimeMode === 'LOCAL'
  && auth.hasPermission(p + ':cancel', 'factory'))
watch(() => intent.pending.value, value => emit('pending', value ? String(props.row.id) : null), { immediate: true })
let generation = 0
let basisRead: Promise<void> = Promise.resolve()
function clear() { generation++;basis.value = null;production.value = null;inputBasis.value = null;error.value = '';cancelBusy.value = false;intent.clear() }
async function loadBasis() {
  const g = ++generation;basis.value = null;production.value = null;inputBasis.value = null;error.value = ''
  if (!props.row.id) return
  if (props.row.documentType === 'MATERIAL_ISSUE') {
    if (!auth.hasPermission(p + ':query', 'factory') && !auth.hasPermission('business:mes:material:issue:item:list', 'factory')) return
    try { const r = await stockDocuments.productionInputBasis(String(props.row.id), auth.hasPermission('business:wm:stock:document:query', 'factory') ? false : true);if (g === generation)inputBasis.value = r } catch(e) { if (g === generation)error.value = e instanceof Error ? e.message : '生产投入依据读取失败' }
    return
  }
  if (props.row.sourceExecutionCode) { try { const r = await stockDocuments.productionBasis(String(props.row.sourceExecutionCode));if (g === generation)production.value = r } catch(e) { if (g === generation)error.value = e instanceof Error ? e.message : '生产入库依据读取失败' } return }
  if (!props.row.sourceWorkorderId) return
  try { const r = await stockDocuments.basis(String(props.row.sourceWorkorderId));if (g === generation)basis.value = r } catch(e) { if (g === generation)error.value = e instanceof Error ? e.message : '补入库依据读取失败' }
}
const commandContext = computed(() => JSON.stringify([auth.factoryId, auth.revision, auth.runtimeMode, auth.factoryPermissions.join('|'), props.row.id]))
const basisContext = computed(() => JSON.stringify([props.row.documentType, props.row.revision, props.row.status,
  props.row.documentType === 'MATERIAL_ISSUE' ? null : props.row.sourceExecutionCode,
  props.row.documentType === 'MATERIAL_ISSUE' || props.row.sourceExecutionCode ? null : props.row.sourceWorkorderId]))
function reloadBasis() { basisRead = loadBasis();return basisRead }
// One watcher owns basis loading. Hydrating identity and sources in the same update must not issue two GETs.
watch([commandContext, basisContext], ([context], previous) => {
  if (!previous || context !== previous[0]) { clear();if (props.row.id) intent.restore() }
  void reloadBasis()
}, { immediate: true })
async function refreshDocument() {
  const context = commandContext.value, before = generation
  await props.refresh()
  await nextTick()
  if (context !== commandContext.value) return
  // A changed revision/status has already scheduled the read through the watcher.
  if (before === generation) await reloadBasis()
  else await basisRead
}
async function approve() {
  if (!canApprove.value || intent.busy.value) return
  if (props.dirty && !intent.pending.value) { error.value = '请先保存草稿，再审核';return }
  if (!stockDocumentPurpose(props.row.documentType)?.approvalAvailable) { error.value = '来源业务尚未接通，禁止审核；草稿可继续保存';return }
  const g = generation
  try { await ElMessageBox.confirm(`${props.row.direction === 'IN' ? '增加' : '减少'}所选库存。审核通过后，全部明细生效且不可直接修改。`, '审核单据', { type: 'warning', confirmButtonText: '确认审核', cancelButtonText: '取消' }) } catch { return }
  if (g !== generation || !canApprove.value) return
  await intent.run(() => ({ requestId: crypto.randomUUID(), expectedRevision: String(props.row.revision) }), c => props.row.documentType === 'PRODUCTION_RECEIPT' && props.row.sourceExecutionCode ? stockDocuments.approveProduction(String(props.row.id), c) : stockDocuments.approve(String(props.row.id), c, String(props.row.direction) === 'IN' ? 'IN' : 'OUT'), refreshDocument)
}
async function cancel() {
  if (props.row.status !== 'DRAFT' || props.dirty || cancelBusy.value || intent.pending.value || !canCancel.value) return
  const g = generation
  try { await ElMessageBox.confirm('作废草稿不改变库存，确认作废？', '作废草稿', { type: 'warning' }) } catch { return }
  if (g !== generation || !canCancel.value || props.row.status !== 'DRAFT' || props.dirty || intent.pending.value) return
  const context = commandContext.value
  cancelBusy.value = true
  try { await stockDocuments.cancel(String(props.row.id), String(props.row.revision), String(props.row.direction) === 'IN' ? 'IN' : 'OUT');if (g === generation) await refreshDocument() } catch(e) { if (g === generation)error.value = e instanceof Error ? e.message : '作废失败' } finally { if (context === commandContext.value)cancelBusy.value = false }
}
onBeforeUnmount(clear)
</script>
<template>
  <div class="stock-document-actions">
    <el-tag v-if="row.status" :type="row.status==='POSTED'?'success':row.status==='CANCELLED'?'info':'warning'">{{ row.status==='POSTED'?'已审核':row.status==='CANCELLED'?'已作废':'草稿' }}</el-tag>

    <el-button v-if="row.id" :disabled="intent.busy.value||cancelBusy" @click="refreshDocument">刷新单据</el-button>
    <el-button v-if="row.status==='DRAFT'&&canCancel" type="danger" plain :disabled="dirty||!!intent.pending.value" :loading="cancelBusy" @click="cancel">作废草稿</el-button>
    <el-button v-if="canApprove" :disabled="!stockDocumentPurpose(row.documentType)?.approvalAvailable" type="primary" :loading="intent.busy.value" @click="approve">{{ intent.pending.value?'核实上次审核结果':'审核单据' }}</el-button>
    <MaterialIssueVoidAction v-if="row.documentType==='MATERIAL_ISSUE' && (materialIssueBasis || inputBasis)" :row="row" :basis="inputBasis" :refresh="refreshDocument" :dirty="dirty" />
    <router-link v-if="row.sourceWorkorderId" :to="{path:'/production/workorder',query:{workorderId:String(row.sourceWorkorderId)}}">查看关联工单</router-link>
    <p v-if="production">可用产出 {{ production.effective }}，已入库 {{ production.received }}，当前可入库 {{ production.remaining }}。{{ production.blockedReason }}</p>
    <p v-if="basis">补入库依据：已交接 {{ basis.handedOver }}，已实际接收 {{ basis.accepted }}，已人工补入 {{ basis.manuallyReceived }}，本次可补上限 {{ basis.remaining }}。</p>
    <el-alert v-if="row.materialIssueBasisError" :title="String(row.materialIssueBasisError)" type="error" :closable="false" />
    <details v-if="materialIssueBasis || inputBasis || row.sourceDeclarationId" class="document-basis">
      <summary>来源依据</summary>
      <p v-if="inputBasis?.workorderCode">工单：{{ inputBasis.workorderCode }}；确认投入：<QuantityText :value="inputBasis.outputQty" />；领料明细见下表。</p>
      <p v-if="materialIssueBasis">确认投入：<QuantityText :value="materialIssueBasis.outputQty" />；扫码内容：{{ materialIssueBasis.code }}</p>
      <p v-if="inputBasis?.batchNo">材料批次：{{ inputBasis.batchNo }}</p>
      <p v-if="inputBasis?.confirmedAt">投入确认时间：{{ inputBasis.confirmedAt }}</p>
      <p v-if="inputBasis?.stockApplied != null">库存生效：{{ inputBasis.stockApplied ? '已生效' : '未生效' }}</p>
      <p v-if="inputBasis?.pathError" role="alert">{{ inputBasis.pathError }}</p>
      <p v-if="row.sourceDeclarationId">由质量处置生成。</p>
    </details>
    <el-alert v-if="error||intent.error.value" :title="error||intent.error.value" type="error" :closable="false" />
  </div>
</template>
<style scoped>.stock-document-actions{flex:1;min-width:0;max-width:100%;display:flex;align-items:center;flex-wrap:wrap;gap:8px}.document-basis{flex-basis:100%;padding:var(--ui-space-3) 0;border-top:1px solid var(--ui-border-soft)}.document-basis summary{cursor:pointer;color:var(--ui-text-secondary)}.stock-document-actions p{flex-basis:100%;max-width:100%;white-space:normal;overflow-wrap:anywhere;margin:var(--ui-space-1) 0}</style>
