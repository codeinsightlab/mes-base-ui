<script setup lang="ts">
import QuantityText from '@/components/business/production/QuantityText.vue'
import MaterialIssueVoidAction from '@/components/business/MaterialIssueVoidAction.vue'
import { usePageMessageBox } from '@/lib/pageMessageBox'

import { computed, onBeforeUnmount, ref, watch } from 'vue'

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
const canIssueApprove = computed(() => props.row.documentType !== 'MATERIAL_ISSUE' || auth.runtimeMode === 'LOCAL' && !props.row.materialIssueBasisError && auth.hasPermission('business:mes:material:issue:update', 'factory'))
const canApprove = computed(() => canIssueApprove.value && !!props.row.id
  && (props.row.documentType === 'MATERIAL_ISSUE' || auth.hasPermission(p + ':post', 'factory'))
  && (!!intent.pending.value || props.row.status === 'DRAFT' && auth.runtimeMode === 'LOCAL'))
const canCancel = computed(() => (props.row.documentType !== 'MATERIAL_ISSUE' || auth.runtimeMode === 'LOCAL')
  && (auth.hasPermission(p + ':cancel', 'factory')
    || props.row.documentType === 'MATERIAL_ISSUE' && auth.hasPermission('business:mes:material:issue:update', 'factory')))
watch(() => intent.pending.value, value => emit('pending', value ? String(props.row.id) : null), { immediate: true })
let generation = 0
function clear() { generation++;basis.value = null;production.value = null;inputBasis.value = null;error.value = '';cancelBusy.value = false;intent.clear() }
async function loadBasis() {
  const g = ++generation;basis.value = null;production.value = null
  if (props.row.documentType === 'MATERIAL_ISSUE') {
    inputBasis.value = null
    if (!auth.hasPermission(p + ':query', 'factory') && !auth.hasPermission('business:mes:material:issue:item:list', 'factory')) return
    try { const r = await stockDocuments.productionInputBasis(String(props.row.id), auth.hasPermission('business:wm:stock:document:query', 'factory') ? false : true);if (g === generation)inputBasis.value = r } catch(e) { if (g === generation)error.value = e instanceof Error ? e.message : '生产投入依据读取失败' }
    return
  }
  if (props.row.sourceExecutionId) { try { const r = await stockDocuments.productionBasis(String(props.row.sourceExecutionId));if (g === generation)production.value = r } catch(e) { if (g === generation)error.value = e instanceof Error ? e.message : '生产入库依据读取失败' } return }
  if (!props.row.sourceWorkorderId) return
  try { const r = await stockDocuments.basis(String(props.row.sourceWorkorderId));if (g === generation)basis.value = r } catch(e) { if (g === generation)error.value = e instanceof Error ? e.message : '补入库依据读取失败' }
}
watch(() => [auth.factoryId, auth.revision, auth.runtimeMode, auth.factoryPermissions.join('|'), props.row.id], () => { clear();intent.restore();void loadBasis() }, { immediate: true })
watch(() => [props.row.sourceWorkorderId, props.row.sourceExecutionId], () => void loadBasis())
async function approve() {
  if (!canApprove.value || intent.busy.value) return
  if (props.dirty && !intent.pending.value) { error.value = '请先保存主单，再核对并审核';return }
  if (!stockDocumentPurpose(props.row.documentType)?.approvalAvailable) { error.value = '来源业务尚未接通，禁止审核；草稿可继续保存';return }
  const g = generation
  try { await ElMessageBox.confirm(`${props.row.direction === 'IN' ? '增加' : '减少'}所选库存。审核通过后在同一事务执行全部明细；成功后单据与库存事实不可编辑。`, '审核单据', { type: 'warning', confirmButtonText: '确认审核', cancelButtonText: '取消' }) } catch { return }
  if (g !== generation || !canApprove.value) return
  await intent.run(() => ({ requestId: crypto.randomUUID(), expectedRevision: String(props.row.revision) }), c => stockDocuments.approve(String(props.row.id), c, String(props.row.direction) === 'IN' ? 'IN' : 'OUT'), async() => { await props.refresh();await loadBasis() })
}
async function cancel() {
  if (props.row.status !== 'DRAFT' || props.dirty || cancelBusy.value || intent.pending.value || !canCancel.value) return
  const g = generation
  try { await ElMessageBox.confirm('作废草稿不改变库存，确认作废？', '作废草稿', { type: 'warning' }) } catch { return }
  if (g !== generation || !canCancel.value || props.row.status !== 'DRAFT' || props.dirty || intent.pending.value) return
  cancelBusy.value = true
  try { await stockDocuments.cancel(String(props.row.id), String(props.row.revision), String(props.row.direction) === 'IN' ? 'IN' : 'OUT');if (g === generation) await props.refresh() } catch(e) { if (g === generation)error.value = e instanceof Error ? e.message : '作废失败' } finally { if (g === generation)cancelBusy.value = false }
}
onBeforeUnmount(clear)
</script>
<template>
  <div class="stock-document-actions">
    <p v-if="stockDocumentPurpose(row.documentType)">业务来源：{{ stockDocumentPurpose(row.documentType)?.origin }}；关联依据：{{ stockDocumentPurpose(row.documentType)?.basis }}<span v-if="!stockDocumentPurpose(row.documentType)?.approvalAvailable">。来源业务尚未接通，禁止审核。</span></p>
    <el-alert v-if="row.materialIssueBasisError" :title="String(row.materialIssueBasisError)" type="error" :closable="false" />
    <details v-if="materialIssueBasis"><summary>冻结领料依据</summary><p>本次产出投入：<QuantityText :value="materialIssueBasis.outputQty" />（产出基本单位）；工单：{{ materialIssueBasis.workorderId }}</p><p>扫码原文：{{ materialIssueBasis.code }}</p><p>工艺版本ID：{{ materialIssueBasis.routingId }}；实际路径节点：{{ materialIssueBasis.routingNodeIds.join(' → ') }}</p><p>原请求UUID：{{ materialIssueBasis.requestId }}</p></details>
    <details v-if="inputBasis"><summary>生产投入与BOM/路径依据</summary><p>工单 {{ inputBasis.workorderCode }}（{{ inputBasis.workorderId }}），Execution {{ inputBasis.executionId }}；产出投入 {{ inputBasis.outputQty }}，领料量 {{ inputBasis.issueQty }}</p><p>物料 {{ inputBasis.materialCode }}（{{ inputBasis.materialId }}），仓库 {{ inputBasis.warehouseId }}，单位 {{ inputBasis.unitId }}，批次 {{ inputBasis.batchNo }}</p><p v-if="inputBasis.bomId">BOM {{ inputBasis.bomId }}：基础数量 {{ inputBasis.bomBaseQty }}，组件数量 {{ inputBasis.bomComponentQty }}</p><p>路径版本 {{ inputBasis.pathRevision ?? '未记录' }}；实际节点 {{ inputBasis.routingNodeIds?.join(' → ') || '当前无可读取节点' }}</p><p>领料业务时间 {{ inputBasis.businessOccurredAt ?? '未提供' }}；投入确认 {{ inputBasis.confirmedAt ?? '未确认' }}；库存已生效 {{ inputBasis.stockApplied ? '是' : '否' }}；撤销结果 {{ inputBasis.voidResultStatus ?? '无' }}；原请求UUID {{ inputBasis.requestId }}</p><p v-if="inputBasis.pathError">{{ inputBasis.pathError }}</p></details>
    <details v-if="row.sourceDeclarationId"><summary>质量来源</summary><p>不良记录：{{ row.sourceDeclarationId }}</p><p>处置流水：{{ row.sourceTreatmentId }}</p></details>
    <el-tag v-if="row.status" :type="row.status==='POSTED'?'success':row.status==='CANCELLED'?'info':'warning'">{{ row.status==='POSTED'?'已审核':row.status==='CANCELLED'?'已作废':'草稿' }}</el-tag>
    <span v-if="row.documentNo">{{ row.documentNo }}</span>
    <el-button v-if="row.id" :disabled="intent.busy.value||cancelBusy" @click="refresh">刷新单据</el-button>
    <el-button v-if="row.status==='DRAFT'&&canCancel" type="danger" plain :disabled="dirty||!!intent.pending.value" :loading="cancelBusy" @click="cancel">作废草稿</el-button>
    <el-button v-if="canApprove" :disabled="!stockDocumentPurpose(row.documentType)?.approvalAvailable" type="primary" :loading="intent.busy.value" @click="approve">{{ intent.pending.value?'核对原审核请求':'审核单据' }}</el-button>
    <MaterialIssueVoidAction v-if="row.documentType==='MATERIAL_ISSUE'" :row="row" :basis="inputBasis" :refresh="refresh" :dirty="dirty" />
    <router-link v-if="row.sourceWorkorderId" :to="{path:'/production/workorder',query:{workorderId:String(row.sourceWorkorderId)}}">查看关联工单 {{ row.sourceWorkorderId }}</router-link>
    <p v-if="production">生产有效产出 {{ production.effective }}，累计已入库 {{ production.received }}，当前可入库 {{ production.remaining }}。{{ production.blockedReason }}</p>
    <p v-if="basis">历史补录依据：已交接 {{ basis.handedOver }}，已实际接收 {{ basis.accepted }}，已人工补入 {{ basis.manuallyReceived }}，本次可补上限 {{ basis.remaining }}。仍须逐行填写实际清点依据。</p>
    <el-alert v-if="intent.pending.value" :title="'原审核UUID：'+intent.pending.value.requestId+'。结果未知时只核实此请求，不另建意图。'" type="warning" :closable="false" />
    <el-alert v-if="error||intent.error.value" :title="error||intent.error.value" type="error" :closable="false" />
  </div>
</template>
<style scoped>.stock-document-actions{flex:1;min-width:0;max-width:100%;display:flex;align-items:center;flex-wrap:wrap;gap:8px}.stock-document-actions p{flex-basis:100%;max-width:100%;white-space:normal;overflow-wrap:anywhere;margin:var(--ui-space-1) 0}</style>
