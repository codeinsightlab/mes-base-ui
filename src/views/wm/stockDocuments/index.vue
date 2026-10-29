<script setup lang="ts">
import { menuPathForComponent } from '@/lib/menuWorkspaces'
import PageDialog from '@/components/page/PageDialog.vue'

import QuantityInput from '@/components/business/material/QuantityInput.vue'
import { normalizedQuantityInput, positiveQuantity } from '@/lib/production/quantityRules'
import { displayQuantity } from '@/lib/production/quantity'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import MasterDetailDocument from '@/components/document/MasterDetailDocument.vue'
import MaterialSelect from '@/components/business/MaterialSelect.vue'
import WarehouseSelect from '@/components/business/WarehouseSelect.vue'
import ProductionExecutionSelect from '@/components/business/production/ProductionExecutionSelect.vue'
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router'
import StockSourceSelect from '@/components/business/warehouse/StockSourceSelect.vue'
import StockDocumentActions from '@/components/business/warehouse/StockDocumentActions.vue'
import WorkOrderSelect from '@/components/business/production/WorkOrderSelect.vue'
import RoutingGraphPreview from '@/components/business/RoutingGraphPreview.vue'
import { productionInput as productionInputApi, type Calculation, type Preview } from '@/api/production/productionInput'
import { api as workorders } from '@/api/production/workorder'
import { stockDocumentApis, stockDocumentPermission as p, stockDocuments, type NumberingRuleOption, type StockDocumentDirection, type StockDocumentTypeOption } from '@/api/wm/stockDocuments'
import { useAuth } from '@/stores/auth'
import { request } from '@/lib/request'
import type { StockAction } from '@/api/wm/localStock'
import type { ProductionInputBasis } from '@/api/wm/stockDocuments'
import { ApiError } from '@/lib/request'
import type { Field, Row } from '@/lib/crud'
const route = useRoute(), router = useRouter()
const direction = computed<StockDocumentDirection>(() => route.query.direction === 'IN' ? 'IN' : 'OUT')
const typeOptions = ref<StockDocumentTypeOption[]>([]), typeOptionsError = ref('')
const manualIssueVisible = ref(false), manualWorkorderId = ref<string | null>(null), manualWarehouseId = ref<string | null>(null)
const manualMaterialId = ref<string | null>(null), manualStockId = ref<string | null>(null), manualOutputQty = ref('')
const manualOutputProductId = ref<string | null>(null), manualQuantityValid = ref(false), manualCalculation = ref<Calculation | null>(null)
const manualPreview = ref<Preview | null>(null), manualSelectedNodes = ref<string[]>([]), manualNextNode = ref('')
type ManualIssueRequest = { header: Record<string, unknown>; items: Record<string, unknown>[]; productionIssue: Record<string, unknown> }
const manualNumber = ref<NumberingRuleOption | null>(null), manualPending = ref<ManualIssueRequest | null>(null)
const manualError = ref(''), manualBusy = ref(false)
const manualPathCandidates = computed(() => {
  const graph = manualPreview.value?.definition
  if (!graph) return []
  const last = graph.nodes.find(node => node.id === manualSelectedNodes.value.at(-1))
  return graph.nodes.filter(node => !manualSelectedNodes.value.includes(node.id!)
    && (last ? graph.edges.some(edge => edge.fromNodeCode === last.nodeCode && edge.toNodeCode === node.nodeCode)
      : !graph.edges.some(edge => edge.toNodeCode === node.nodeCode)))
})
const manualPathComplete = computed(() => {
  const graph = manualPreview.value?.definition
  const last = graph?.nodes.find(node => node.id === manualSelectedNodes.value.at(-1))
  return !!graph && !!last && !graph.edges.some(edge => edge.fromNodeCode === last.nodeCode)
    && graph.nodes.filter(node => node.isKey).every(node => manualSelectedNodes.value.includes(node.id!))
})
const pendingDocument = ref<string | null>(null)
const numberingRules = ref<NumberingRuleOption[]>([]), numberingRulesLoading = ref(false), numberingRulesError = ref('')
const selectedNumberRule = ref<NumberingRuleOption | null>(null)
const auth = useAuth(), document = ref<InstanceType<typeof MasterDetailDocument> | null>(null)
const productionInputPath = computed(() => menuPathForComponent(auth.factoryMenus, 'production/productionInput/index'))
const issuePermission = 'business:mes:material:issue'
const canStockList = computed(() => auth.hasPermission(p + ':list', 'factory'))
const canStockQuery = computed(() => auth.hasPermission(p + ':query', 'factory'))
const issueListOnly = computed(() => !canStockList.value && auth.hasPermission(issuePermission + ':list', 'factory'))
const issueQueryOnly = computed(() => !canStockQuery.value && auth.hasPermission(issuePermission + ':query', 'factory'))
const headerPermissions = computed(() => ({
  list: issueListOnly.value ? issuePermission + ':list' : p + ':list',
  query: issueQueryOnly.value ? issuePermission + ':query' : p + ':query'
}))
const { headerApi, itemApi, aggregateApi: baseAggregateApi } = stockDocumentApis({
  issueListOnly: () => issueListOnly.value,
  issueQueryOnly: () => issueQueryOnly.value
}, () => direction.value)
const directDocumentId = ref(''), directLines = ref<Row[]>([]), directBasis = ref<ProductionInputBasis | null>(null)
const lineId = ref(''), selectedLine = ref<Row | null>(null), lineError = ref(''), lineLoading = ref(false)
const canIssueLines = computed(() => canStockQuery.value || auth.hasPermission(issuePermission + ':item:list', 'factory'))
const canIssueLine = computed(() => canStockQuery.value || auth.hasPermission(issuePermission + ':item:query', 'factory'))
let lineAttempt = 0
async function readIssueLine(documentId: unknown) {
  if (!/^[1-9]\d*$/.test(String(documentId ?? '')) || !/^[1-9]\d*$/.test(lineId.value) || !canIssueLine.value) return
  const attempt = ++lineAttempt, factory = auth.factoryId, revision = auth.revision
  selectedLine.value = null; lineError.value = ''; lineLoading.value = true
  try {
    const row = await stockDocuments.materialIssueLine(String(documentId), lineId.value)
    if (attempt === lineAttempt && factory === auth.factoryId && revision === auth.revision) selectedLine.value = row
  } catch(error) {
    if (attempt === lineAttempt) lineError.value = error instanceof Error ? error.message : '明细读取失败'
  } finally { if (attempt === lineAttempt) lineLoading.value = false }
}
async function readDirectLines() {
  if (!/^[1-9]\d*$/.test(directDocumentId.value) || !canIssueLines.value) return
  const attempt = ++lineAttempt, factory = auth.factoryId, revision = auth.revision
  directLines.value = []; directBasis.value = null; lineError.value = ''; lineLoading.value = true
  try {
    const [lines, basis] = await Promise.allSettled([stockDocuments.materialIssueLines(directDocumentId.value), stockDocuments.productionInputBasis(directDocumentId.value, true)])
    if (attempt === lineAttempt && factory === auth.factoryId && revision === auth.revision) {
      if (lines.status === 'fulfilled') directLines.value = lines.value
      else lineError.value = '明细读取失败'
      if (basis.status === 'fulfilled') directBasis.value = basis.value
      else lineError.value = lineError.value ? '明细及投入依据读取失败' : '投入依据读取失败'
    }
  } catch(error) { if (attempt === lineAttempt) lineError.value = error instanceof Error ? error.message : '明细读取失败' } finally { if (attempt === lineAttempt) lineLoading.value = false }
}
const originalLines = new Map<string, Row>()
const quantityValidity = new WeakMap<object, boolean>()
function setQuantityValidity(row: object, valid: boolean) { quantityValidity.set(row, valid) }
function validateItems(items: Row[]) {
  for (const [index, item] of items.entries()) {
    const quantity = normalizedQuantityInput(String(item.quantity ?? ''))
    if (quantityValidity.get(item) !== true || !positiveQuantity(quantity)) return `第${index + 1}行数量无效，请确认物料单位规则并输入正数量`
    item.quantity = quantity
  }
  return null
}
function remember(document: { header: Row; items: Row[] }) {
  originalLines.clear()
  document.items.forEach(row => { if (row.id != null) originalLines.set(String(row.id), { ...row }) })
  return document
}
const aggregateApi = {
  detail: async(id:string) => { lineAttempt++; lineId.value = ''; selectedLine.value = null; lineError.value = ''; lineLoading.value = false; return remember(await baseAggregateApi.detail(id)) },
  create: async(body:unknown) => remember(await baseAggregateApi.create(body)),
  update: async(id:string, body:unknown) => remember(await baseAggregateApi.update(id, body))
}
const initialSearch = computed<Record<string, string>>((): Record<string, string> => ({ direction: direction.value,
  ...(issueListOnly.value && direction.value === 'OUT' ? { documentType: 'MATERIAL_ISSUE' } : {}),
  ...(typeof route.query.documentType === 'string' && typeOptions.value.some(t => t.value === route.query.documentType)
    ? { documentType: route.query.documentType } : {}) }))
const action = ref<StockAction | null>(null), actionVisible = ref(false), actionError = ref('')
let linkAttempt = 0, typeAttempt = 0, manualAttempt = 0
const manualRecoveryKey = () => 'mes-stock-manual-issue-pending:' + auth.username + ':' + auth.factoryId
function clearManualCalculation() { manualAttempt++;manualCalculation.value = null;manualPreview.value = null;manualSelectedNodes.value = [];manualNextNode.value = '';manualError.value = '' }
function restoreManualPending() {
  if (!auth.factoryId) return
  try { const raw = sessionStorage.getItem(manualRecoveryKey());manualPending.value = raw ? JSON.parse(raw) as ManualIssueRequest : null } catch { manualError.value = '待核对的领料请求无法读取；请联系管理员，不要另建同一笔领料。' }
}
async function loadTypes() {
  const attempt = ++typeAttempt, factory = auth.factoryId, revision = auth.revision
  typeOptionsError.value = ''
  try {
    const result = await stockDocuments.types(direction.value)
    if (attempt === typeAttempt && factory === auth.factoryId && revision === auth.revision) typeOptions.value = result
  } catch(error) { if (attempt === typeAttempt) typeOptionsError.value = error instanceof Error ? error.message : '单据类型读取失败' }
}
async function openLinkedDocument() {
  const id = route.query.documentId
  const requestId = route.query.requestId
  const hasDocument = typeof id === 'string' && /^[1-9]\d*$/.test(id)
  if (!hasDocument && (typeof requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId))) return
  const attempt = ++linkAttempt, factory = auth.factoryId, revision = auth.revision
  try {
    const detail = hasDocument
      ? await stockDocuments.detail(id, undefined, issueQueryOnly.value)
      : await stockDocuments.byRequest(requestId as string)
    if (attempt !== linkAttempt || factory !== auth.factoryId || revision !== auth.revision) return
    if (!hasDocument || detail.document.direction !== direction.value) {
      await router.replace({ path: route.path, query: { ...route.query, documentId: detail.document.id, direction: detail.document.direction }})
      return
    }
    await loadTypes()
    if (attempt === linkAttempt && factory === auth.factoryId && revision === auth.revision) void document.value?.open({ id })
  } catch(error) { if (attempt === linkAttempt) lineError.value = error instanceof Error ? error.message : '单据读取失败' }
}
onMounted(() => { void loadTypes();void openLinkedDocument() })
watch(() => route.query.direction, () => { void loadTypes(); if (!route.query.documentId) void document.value?.back() })
watch(() => [route.query.documentId, route.query.requestId], openLinkedDocument)
watch(() => route.query.documentType, () => { if (!route.query.documentId) void document.value?.back() })
let generation = 0, numberingAttempt = 0
function reset() { linkAttempt++;lineAttempt++; directDocumentId.value = ''; directLines.value = []; directBasis.value = null; lineId.value = ''; selectedLine.value = null; lineError.value = ''; lineLoading.value = false; originalLines.clear();pendingDocument.value = null;generation++;numberingAttempt++;numberingRules.value = [];selectedNumberRule.value = null;numberingRulesLoading.value = false;numberingRulesError.value = '';action.value = null;actionVisible.value = false;actionError.value = '' }
watch(() => [auth.factoryId, auth.revision, auth.factoryPermissions.join('|')], () => { reset();clearManualCalculation();manualWorkorderId.value = null;manualWarehouseId.value = null;manualMaterialId.value = null;manualStockId.value = null;manualOutputQty.value = '';manualOutputProductId.value = null;manualNumber.value = null;manualIssueVisible.value = false;restoreManualPending();void loadTypes() })
onBeforeUnmount(reset)
onBeforeUnmount(clearManualCalculation)
async function showAction(id:unknown) {
  if (!id || !auth.hasPermission('business:wm:stock:action:query', 'factory')) return
  const g = ++generation;action.value = null;actionError.value = '';actionVisible.value = true
  try { const result = await request<StockAction>('/api/wm/wm-stock-action/' + encodeURIComponent(String(id)), { scope: 'factory' });if (g === generation)action.value = result } catch(e) { if (g === generation)actionError.value = e instanceof Error ? e.message : '动作读取失败' }
}
const manualDocumentTypes = computed(() => typeOptions.value.filter(t => t.enabled && t.approvalAvailable
  && t.value !== 'MATERIAL_ISSUE'))
const ruleCodeVisibility: Field['showWhen'] = Object.freeze({
  key: 'isNew',
  value: 'Y'
})
function numberingType(documentType: unknown): 'STOCK_IN' | 'STOCK_OUT' | null {
  const type = typeOptions.value.find(option => option.value === documentType)
  return type?.direction === 'IN' ? 'STOCK_IN' : type?.direction === 'OUT' ? 'STOCK_OUT' : null
}
async function loadNumberingRules(documentType: unknown, draft?: Row) {
  const type = numberingType(documentType), attempt = ++numberingAttempt, factory = auth.factoryId, revision = auth.revision
  numberingRules.value = [];selectedNumberRule.value = null;numberingRulesError.value = ''
  if (!type || !factory || !auth.hasPermission(p + ':create', 'factory')) return
  numberingRulesLoading.value = true
  try {
    const result = await stockDocuments.numberingRules(direction.value)
    if (attempt !== numberingAttempt || factory !== auth.factoryId || revision !== auth.revision) return
    const rule = result.find(option => option.typeKey === documentType)
    if (!rule?.available || rule.ruleCode !== documentType) {
      numberingRulesError.value = rule?.issue || '当前工厂未启用此单据类型对应的编码规则'
      return
    }
    selectedNumberRule.value = rule
    numberingRules.value = [{ typeKey: rule.typeKey, ruleCode: rule.ruleCode,
      ruleName: rule.ruleName ?? rule.ruleCode, prefix: rule.prefix ?? '',
      preview: rule.preview, available: true, issue: null }]
    if (draft && !draft.id) draft.ruleCode = rule.ruleCode
  } catch(e) { if (attempt === numberingAttempt) numberingRulesError.value = e instanceof Error ? e.message : '编码规则读取失败' } finally { if (attempt === numberingAttempt) numberingRulesLoading.value = false }
}
function openManualIssue() {
  if (direction.value !== 'OUT' || !auth.hasPermission(p + ':create', 'factory') || auth.runtimeMode !== 'LOCAL') return
  restoreManualPending()
  manualError.value = ''
  manualIssueVisible.value = true
  if (manualPending.value) return
  void loadManualIssueRule()
}
async function loadManualIssueRule() {
  const attempt = ++manualAttempt, factory = auth.factoryId, revision = auth.revision
  manualBusy.value = true;manualError.value = '';manualNumber.value = null
  try {
    const options = await stockDocuments.numberingRules('OUT')
    if (attempt !== manualAttempt || factory !== auth.factoryId || revision !== auth.revision) return
    const rule = options.find(option => option.typeKey === 'MATERIAL_ISSUE')
    if (!rule?.available || rule.ruleCode !== 'MATERIAL_ISSUE') throw new Error(rule?.issue || '当前工厂未启用生产领料专属出库编码规则')
    manualNumber.value = rule
  } catch(error) { if (attempt === manualAttempt) manualError.value = error instanceof Error ? error.message : '领料编码规则读取失败' } finally { if (attempt === manualAttempt) manualBusy.value = false }
}
async function chooseManualWorkorder(value: string | null | undefined) {
  const id = value ?? null
  manualWorkorderId.value = id;manualOutputProductId.value = null;manualWarehouseId.value = null;manualMaterialId.value = null;manualStockId.value = null;manualOutputQty.value = '';clearManualCalculation()
  if (!id) return
  const attempt = ++manualAttempt, factory = auth.factoryId, revision = auth.revision
  manualBusy.value = true;manualError.value = ''
  try {
    const detail = await workorders.detail(id)
    if (attempt !== manualAttempt || factory !== auth.factoryId || revision !== auth.revision) return
    if (detail.workorder.source !== 'LOCAL' || detail.workorder.status !== 'RELEASED') throw new Error('仅能选择当前LOCAL已下达工单')
    manualOutputProductId.value = detail.workorder.productId
    manualPreview.value = null
  } catch(error) { if (attempt === manualAttempt) manualError.value = error instanceof Error ? error.message : '工单读取失败' } finally { if (attempt === manualAttempt) manualBusy.value = false }
}
async function calculateManualIssue() {
  if (!manualWorkorderId.value || !manualWarehouseId.value || !manualMaterialId.value || !manualStockId.value
      || !manualQuantityValid.value || !positiveQuantity(normalizedQuantityInput(manualOutputQty.value))
      || manualBusy.value || manualPending.value) return
  clearManualCalculation()
  const attempt = ++manualAttempt, factory = auth.factoryId, revision = auth.revision
  manualBusy.value = true;manualError.value = ''
  try {
    const result = await productionInputApi.manualCalculate({ workorderId: manualWorkorderId.value,
      stockReference: manualStockId.value, outputQty: normalizedQuantityInput(manualOutputQty.value) })
    if (attempt !== manualAttempt || factory !== auth.factoryId || revision !== auth.revision) return
    if (result.calculation.sourceMode !== 'LOCAL_ONLY') throw new Error('当前数据来源不支持LOCAL领料')
    manualCalculation.value = result.calculation
    const preview = await productionInputApi.manualPreview(result.code, manualWorkorderId.value)
    if (attempt !== manualAttempt || factory !== auth.factoryId || revision !== auth.revision) return
    manualPreview.value = preview
    manualSelectedNodes.value = preview.actual ? [...preview.actual.selectedNodeIds] : []
  } catch(error) { if (attempt === manualAttempt) manualError.value = error instanceof Error ? error.message : '领料计算或路径读取失败' } finally { if (attempt === manualAttempt) manualBusy.value = false }
}
watch([manualOutputQty, manualWarehouseId, manualMaterialId, manualStockId], clearManualCalculation)
async function saveManualIssue() {
  if (manualBusy.value || !auth.hasPermission(p + ':create', 'factory') || auth.runtimeMode !== 'LOCAL') return
  let frozen = manualPending.value
  if (!frozen) {
    const calculation = manualCalculation.value, preview = manualPreview.value, rule = manualNumber.value
    if (!calculation || !preview || !manualPathComplete.value || !rule?.available || rule.ruleCode !== 'MATERIAL_ISSUE') return
    frozen = {
      header: { direction: 'OUT', documentType: 'MATERIAL_ISSUE', reason: '正式生产领料出库', remark: null,
        sourceWorkorderId: manualWorkorderId.value, sourceExecutionId: null, ruleCode: 'MATERIAL_ISSUE', expectedRevision: null },
      items: [{ id: null, stockId: calculation.stock.reference, materialId: calculation.stock.materialId,
        warehouseId: calculation.stock.warehouseId, unitId: calculation.stock.unitId, batchNo: calculation.stock.lotCode,
        binCode: calculation.stock.binCode, quantity: calculation.issueQty, remark: null }],
      productionIssue: { requestId: crypto.randomUUID(), outputQty: calculation.outputQty,
        routingId: preview.definition.routing.id, routingNodeIds: [...manualSelectedNodes.value],
        inputKind: 'PRODUCTION_INPUT', calculationKey: calculation.calculationKey }
    }
    manualPending.value = frozen
  }
  const storageKey = manualRecoveryKey(), factory = auth.factoryId, revision = auth.revision
  sessionStorage.setItem(storageKey, JSON.stringify(frozen));manualBusy.value = true;manualError.value = ''
  try {
    const result = await stockDocuments.createAggregate(frozen)
    if (factory !== auth.factoryId || revision !== auth.revision) return
    sessionStorage.removeItem(storageKey);manualPending.value = null;manualIssueVisible.value = false
    await router.replace({ path: route.path, query: { ...route.query, direction: 'OUT', documentId: result.document.id }})
  } catch(error) {
    if (factory !== auth.factoryId || revision !== auth.revision) return
    if (error instanceof ApiError && ['BAD_REQUEST', 'PRODUCTION_INPUT_STALE', 'BUSINESS_SOURCE_CONFLICT'].includes(error.code)) {
      sessionStorage.removeItem(storageKey);manualPending.value = null
    }
    manualError.value = error instanceof Error ? error.message : '保存结果未取得，请使用相同冻结请求重试。'
  } finally { if (factory === auth.factoryId && revision === auth.revision) manualBusy.value = false }
}
function documentTypeChanged(draft: Row) { draft.sourceExecutionId = null;draft.ruleCode = null;void loadNumberingRules(draft.documentType, draft) }
function directionLink(next: StockDocumentDirection) {
  const query: LocationQueryRaw = { ...route.query, direction: next }
  delete query.documentType
  delete query.documentId
  return { path: route.path, query }
}
const documentTitle = computed(() => direction.value === 'IN' ? '入库单' : '出库单')
const headerFields = computed<Field[]>(() => [
  { key: 'isNew', label: '新建状态', kind: 'text', readonly: true, hidden: true, defaultValue: 'Y' },
  { key: 'ruleCode', label: '编码规则', kind: 'select', showWhen: ruleCodeVisibility },
  { key: 'documentNo', label: '单号', kind: 'text', readonly: true, searchable: true, columnMinWidth: 240 },
  { key: 'direction', label: '方向', kind: 'text', readonly: true, defaultValue: direction.value, hidden: true },
  { key: 'documentType', label: '单据类型', kind: 'select', required: true, defaultValue: typeof route.query.executionId === 'string' ? 'PRODUCTION_RECEIPT' : direction.value === 'IN' ? 'OTHER_RECEIPT' : 'OTHER_ISSUE', searchable: true, options: typeOptions.value.map(t => ({ value: t.value, label: t.label })) },
  { key: 'status', label: '状态', kind: 'select', readonly: true, searchable: true, options: [{ value: 'DRAFT', label: '草稿', tone: 'warning' }, { value: 'POSTED', label: '已审核', tone: 'success' }, { value: 'CANCELLED', label: '已作废', tone: 'info' }] },
  { key: 'sourceExecutionId', label: '生产来源执行单元', kind: 'text', defaultValue: typeof route.query.executionId === 'string' ? route.query.executionId : undefined },
  { key: 'sourceWorkorderId', label: '工单来源', kind: 'text', readonly: true },
  { key: 'reason', label: '处理原因 / 实物依据', kind: 'textarea', required: true, maxLength: 500 },
  { key: 'remark', label: '备注', kind: 'textarea', maxLength: 500 },
  { key: 'postedBy', label: '审核人ID', kind: 'text', readonly: true },
  { key: 'postRequestId', label: '审核请求UUID', kind: 'text', readonly: true, columnMinWidth: 260 },
  { key: 'postedAt', label: '审核时间', kind: 'datetime', readonly: true, columnMinWidth: 180 }
])
const itemFields:Field[] = [
  { key: 'lineNo', label: '行号', kind: 'number', readonly: true },
  { key: 'materialId', label: '物料 / 产品', kind: 'text', required: true },
  { key: 'warehouseId', label: 'LOCAL仓库', kind: 'text', required: true },
  { key: 'stockId', label: '确切库存来源', kind: 'text', required: true },
  { key: 'batchNo', label: '批次', kind: 'text' }, { key: 'binCode', label: '库位', kind: 'text' },
  { key: 'unitId', label: '基本单位ID', kind: 'text', required: true },
  { key: 'quantity', label: '本次收发数量', kind: 'decimal', required: true, format: value => displayQuantity(value as string) },
  { key: 'remark', label: '明细 / 实物清点依据', kind: 'textarea', maxLength: 500 },
  { key: 'stockActionId', label: '库存动作', kind: 'text', readonly: true, columnMinWidth: 260 }
]
function resetIdentity(draft:Row) { draft.stockId = null;draft.batchNo = null;draft.binCode = null;draft.unitId = null }
</script>
<template>
  <div class="stock-documents">
    <div class="document-toolbar direction-tabs" role="tablist" aria-label="单据方向">
      <router-link role="tab" :aria-selected="direction==='IN'" :to="directionLink('IN')">入库单</router-link>
      <router-link role="tab" :aria-selected="direction==='OUT'" :to="directionLink('OUT')">出库单</router-link>
    </div>
    <el-alert v-if="typeOptionsError" :title="typeOptionsError" type="error" :closable="false" />
    <el-alert :title="direction==='IN'?'新建入库单先保存草稿，审核通过后才增加库存。未接入来源的类型禁止审核。':'新建出库单先保存草稿，审核通过后才扣减库存。生产领料需依据工单BOM、单位及实际路径。'" type="info" :closable="false" />
    <el-button v-if="direction==='OUT' && auth.runtimeMode==='LOCAL' && auth.hasPermission(p+':create','factory')" type="primary" plain @click="openManualIssue">新增生产领料草稿</el-button>
    <router-link v-if="direction==='OUT' && productionInputPath && auth.hasPermission('business:mes:material:issue:update','factory')" :to="{path:productionInputPath,query:{direction:'OUT'}}">扫码投产并领料</router-link>
    <section v-if="!canStockList && !canStockQuery && !issueListOnly && !issueQueryOnly && (canIssueLines || canIssueLine)">
      <h3>读取生产领料明细</h3>
      <el-input v-model="directDocumentId" aria-label="领料单据 ID" placeholder="单据 ID" />
      <el-button v-if="canIssueLines" :loading="lineLoading" @click="readDirectLines">读取明细列表</el-button>
      <template v-if="canIssueLine"><el-input v-model="lineId" aria-label="独立领料明细 ID" placeholder="明细 ID" /><el-button :loading="lineLoading" @click="readIssueLine(directDocumentId)">读取指定明细</el-button></template>
      <el-alert v-if="lineError" :title="lineError" type="error" :closable="false" />
      <el-table v-if="directLines.length" :data="directLines"><el-table-column prop="id" label="明细 ID" /><el-table-column prop="materialId" label="物料" /><el-table-column prop="warehouseId" label="仓库" /><el-table-column prop="quantity" label="数量" /></el-table>
      <p v-if="selectedLine">明细 {{ selectedLine.id }}：物料 {{ selectedLine.materialId }}，数量 {{ selectedLine.quantity }}</p>
      <p v-if="directBasis">工单 {{ directBasis.workorderCode }}，投入 {{ directBasis.outputQty }}，领料 {{ directBasis.issueQty }}</p>
    </section>
    <MasterDetailDocument
      ref="document"
      :deletable="false"
      revision-field="revision"
      :initial-search="initialSearch"
      :title="documentTitle"
      :header-api="headerApi"
      :item-api="itemApi"
      :aggregate-api="aggregateApi"
      :validate-aggregate-items="validateItems"
      :header-fields="headerFields"
      :item-fields="itemFields"
      :header-permission="p"
      :header-permission-overrides="headerPermissions"
      :item-permission="p"
      parent-key="documentId"
      :items-readonly="row=>row.documentType==='MATERIAL_ISSUE'"
      :header-readonly="row=>row.documentType==='MATERIAL_ISSUE'||row.status!=='DRAFT'||auth.runtimeMode!=='LOCAL'||pendingDocument===row.id"
      :item-permission-overrides="{list:p+':query',query:p+':query',create:p+':update',update:p+':update',delete:p+':update'}"
    >
      <template #header-actions="{row,refresh,dirty}"><StockDocumentActions :row="row" :refresh="refresh" :dirty="dirty" @pending="id=>pendingDocument=id" /></template>
      <template #field-documentType="{draft,disabled}"><el-select v-model="draft.documentType as string" :disabled="disabled||!!draft.id" @change="()=>documentTypeChanged(draft)"><el-option v-for="type in draft.id?typeOptions:manualDocumentTypes" :key="type.value" :label="type.label+(type.approvalAvailable?'':'（仅草稿）')" :value="type.value" :disabled="!type.enabled" /></el-select></template>
      <template #field-ruleCode="{draft,disabled}"><div @vue:mounted="!draft.id && loadNumberingRules(draft.documentType,draft)"><el-alert v-if="numberingRulesError" :title="numberingRulesError" type="error" :closable="false" /><el-select v-model="draft.ruleCode as string" :disabled="disabled||!!draft.id||numberingRules.length!==1" :loading="numberingRulesLoading" placeholder="请选择与单据类型 key 对应的编码规则" @visible-change="(visible: boolean)=>visible&&numberingRules.length===0&&!numberingRulesLoading&&loadNumberingRules(draft.documentType,draft)"><el-option v-for="rule in numberingRules" :key="rule.ruleCode" :value="rule.ruleCode" :label="`${rule.ruleName}（${rule.ruleCode} · ${rule.prefix}）`" /></el-select><span v-if="selectedNumberRule" class="secondary">规则 {{ selectedNumberRule.ruleCode }}；实际前缀 {{ selectedNumberRule.prefix }}；本次预览 {{ selectedNumberRule.preview }}。单号仅在正式保存时取号。</span><span v-else class="secondary">业务类型 key 与规则编码一一对应；不能改选其他类型规则。</span></div></template>
      <template #field-sourceExecutionId="{draft,disabled}"><ProductionExecutionSelect v-model="(draft.sourceExecutionId as string|null)" :statuses="['RUNNING']" :disabled="disabled||!!draft.id||draft.documentType!=='PRODUCTION_RECEIPT'" /></template>
      <template #items="{ header, items, writable, saving, add, remove }">
        <el-alert v-if="header.documentType === 'MATERIAL_ISSUE' && !canIssueLines" title="当前账号没有领料明细列表权限。" type="info" :closable="false" />
        <template v-else>
          <div class="document-toolbar"><el-button type="primary" plain :disabled="!writable" @click="add({materialId:null,warehouseId:null,stockId:null,unitId:null,batchNo:null,binCode:null,quantity:'',remark:''})">添加明细</el-button><span class="secondary">选择明确库存来源，数量使用物料基本单位。</span></div>
          <el-table :data="items" border stripe>
            <el-table-column type="index" label="#" width="60" />
            <el-table-column label="物料 / 产品" min-width="190"><template #default="{row}"><MaterialSelect v-if="writable" v-model="row.materialId" @update:model-value="resetIdentity(row)" /><span v-else>{{ row.materialId || '待确认' }}</span></template></el-table-column>
            <el-table-column label="仓库" min-width="180"><template #default="{row}"><WarehouseSelect v-if="writable" v-model="row.warehouseId" source="LOCAL" @update:model-value="resetIdentity(row)" /><span v-else>{{ row.warehouseId || '待确认' }}</span></template></el-table-column>
            <el-table-column label="库存来源" min-width="200"><template #default="{row}"><StockSourceSelect v-if="writable" v-model="row.stockId" :material-id="(row.materialId as string | null)" :warehouse-id="(row.warehouseId as string | null)" :receipt="header.direction==='IN'" @selected="(s,unit)=>{row.materialId=s.materialId;row.warehouseId=s.warehouseId;row.batchNo=s.batchNo;row.binCode=s.binCode;row.unitId=unit}" /><span v-else>{{ row.stockId || '待确认' }}</span></template></el-table-column>
            <el-table-column label="批次 / 库位" min-width="180"><template #default="{row}">{{ row.batchNo || '—' }} / {{ row.binCode || '—' }}</template></el-table-column>
            <el-table-column label="基本单位" width="120"><template #default="{row}">{{ row.unitId || '待确认' }}</template></el-table-column>
            <el-table-column label="数量" min-width="160"><template #default="{row}"><QuantityInput v-if="writable" v-model="row.quantity" :material-id="(row.materialId as string | null)" required positive :unchanged-value="originalLines.get(String(row.id))?.materialId===row.materialId && originalLines.get(String(row.id))?.stockId===row.stockId && originalLines.get(String(row.id))?.unitId===row.unitId ? originalLines.get(String(row.id))?.quantity as string : null" @validity="setQuantityValidity(row,$event)" /><span v-else>{{ displayQuantity(row.quantity as string) }}</span></template></el-table-column>
            <el-table-column label="备注" min-width="180"><template #default="{row}"><el-input v-if="writable" v-model="row.remark" maxlength="500" /><span v-else>{{ row.remark || '—' }}</span></template></el-table-column>
            <el-table-column label="库存动作" min-width="220"><template #default="{row}"><el-button v-if="row.stockActionId&&auth.hasPermission('business:wm:stock:action:query','factory')" link type="primary" @click="showAction(row.stockActionId)">{{ row.stockActionId }}</el-button><span v-else>{{ row.stockActionId || '—' }}</span></template></el-table-column>
            <el-table-column v-if="writable || header.documentType === 'MATERIAL_ISSUE' && canIssueLine" label="操作" width="100" fixed="right"><template #default="{row,$index}"><el-button v-if="writable" link type="danger" :disabled="saving" @click="remove($index)">移除</el-button><el-button v-else-if="row.id" link type="primary" @click="lineId=String(row.id);readIssueLine(header.id)">查看明细</el-button></template></el-table-column>
          </el-table>
        </template>
        <div v-if="header.documentType === 'MATERIAL_ISSUE' && !canIssueLines && canIssueLine" class="document-toolbar">
          <el-input v-model="lineId" placeholder="输入明细 ID" aria-label="领料明细 ID" />
          <el-button :loading="lineLoading" @click="readIssueLine(header.id)">读取明细</el-button>
        </div>
        <el-alert v-if="lineError" :title="lineError" type="error" :closable="false" />
        <el-descriptions v-if="selectedLine && header.documentType === 'MATERIAL_ISSUE'" :column="2" border>
          <el-descriptions-item label="明细 ID">{{ selectedLine.id }}</el-descriptions-item>
          <el-descriptions-item label="物料">{{ selectedLine.materialId }}</el-descriptions-item>
          <el-descriptions-item label="仓库">{{ selectedLine.warehouseId || '待确认' }}</el-descriptions-item>
          <el-descriptions-item label="批次">{{ selectedLine.batchNo || '—' }}</el-descriptions-item>
          <el-descriptions-item label="数量">{{ displayQuantity(selectedLine.quantity as string) }}</el-descriptions-item>
          <el-descriptions-item label="单位">{{ selectedLine.unitId || '待确认' }}</el-descriptions-item>
        </el-descriptions>
      </template>
    </MasterDetailDocument>
    <PageDialog v-model="manualIssueVisible" title="新增生产领料草稿" width="880px" append-to-body>
      <el-alert title="本入口只保存统一出库单草稿；不审核、不扣库存、不生成生产投入。保存时将冻结同一生产计算、来源、数量和路径请求。" type="info" :closable="false" />
      <el-alert v-if="manualError" :title="manualError" type="error" :closable="false" />
      <div v-if="manualPending" class="panel">
        <p>存在待核对领料请求 {{ manualPending.productionIssue.requestId }}，工单 {{ manualPending.header.sourceWorkorderId }}。</p>
        <p>只能重放冻结的相同聚合请求，不能修改或另建替代请求。</p>
        <el-button type="primary" :loading="manualBusy" @click="saveManualIssue">使用原请求重试</el-button>
      </div>
      <template v-else>
        <el-descriptions v-if="manualNumber" :column="1" border>
          <el-descriptions-item label="出库规则 key">{{ manualNumber.typeKey }} / {{ manualNumber.ruleCode }}</el-descriptions-item>
          <el-descriptions-item label="规则前缀 / 编号预览">{{ manualNumber.prefix }} / {{ manualNumber.preview }}</el-descriptions-item>
        </el-descriptions>
        <el-form label-position="top" class="manual-issue-form">
          <el-form-item label="LOCAL已下达工单" required><WorkOrderSelect :model-value="manualWorkorderId" source="LOCAL" status="RELEASED" :disabled="manualBusy" @update:model-value="chooseManualWorkorder" /></el-form-item>
          <el-form-item label="BOM组件物料" required><MaterialSelect v-model="manualMaterialId" :disabled="manualBusy||!manualWorkorderId" /></el-form-item>
          <el-form-item label="LOCAL仓库" required><WarehouseSelect v-model="manualWarehouseId" source="LOCAL" :disabled="manualBusy||!manualWorkorderId" /></el-form-item>
          <el-form-item label="精确库存来源" required><StockSourceSelect v-model="manualStockId" :material-id="manualMaterialId" :warehouse-id="manualWarehouseId" :disabled="manualBusy||!manualMaterialId||!manualWarehouseId" :receipt="false" /></el-form-item>
          <el-form-item label="本次预计成品产出量" required><QuantityInput v-model="manualOutputQty" :material-id="manualOutputProductId" required positive :disabled="manualBusy||!manualOutputProductId" @validity="manualQuantityValid=$event" /></el-form-item>
        </el-form>
        <el-button :disabled="manualBusy||!manualQuantityValid||!manualStockId||!manualNumber?.available" :loading="manualBusy" @click="calculateManualIssue">计算 BOM 领料量并读取路径</el-button>
        <el-descriptions v-if="manualCalculation" :column="1" border>
          <el-descriptions-item label="工单 / BOM 校验">{{ manualCalculation.order.workorderCode }} · {{ manualCalculation.order.status }}</el-descriptions-item>
          <el-descriptions-item label="产出数量">{{ displayQuantity(manualCalculation.outputQty) }} {{ manualCalculation.order.outputUnitCode }}</el-descriptions-item>
          <el-descriptions-item label="领料数量">{{ displayQuantity(manualCalculation.issueQty) }} {{ manualCalculation.stock.unitCode }}</el-descriptions-item>
          <el-descriptions-item label="库存来源">{{ manualCalculation.stock.warehouseCode }} / {{ manualCalculation.stock.lotCode }} · 可用 {{ displayQuantity(manualCalculation.stock.availableQty) }}</el-descriptions-item>
        </el-descriptions>
        <template v-if="manualPreview">
          <h3>{{ manualPreview.actual ? `既有执行 ${manualPreview.actual.executionId} · ${manualPreview.actual.executionStatus}` : '首次生产领料选择完整工艺路径' }}</h3>
          <p>{{ manualPreview.definition.routing.code }} / V{{ manualPreview.definition.routing.version }} · {{ manualPreview.definition.routing.name }}</p>
          <RoutingGraphPreview :nodes="manualPreview.definition.nodes" :edges="manualPreview.definition.edges" :selected-node-ids="manualSelectedNodes" />
          <el-select v-if="!manualPreview.actual" v-model="manualNextNode" placeholder="选择起点或下一相邻工序" :disabled="manualBusy"><el-option v-for="node in manualPathCandidates" :key="node.id" :value="node.id!" :label="node.nodeCode+' · '+node.operationName" /></el-select>
          <el-button v-if="!manualPreview.actual" :disabled="!manualNextNode||manualBusy" @click="manualSelectedNodes.push(manualNextNode);manualNextNode=''">加入路径</el-button>
          <el-button v-if="!manualPreview.actual" :disabled="!manualSelectedNodes.length||manualBusy" @click="manualSelectedNodes.pop()">撤回末节点</el-button>
          <ol><li v-for="id in manualSelectedNodes" :key="id">{{ manualPreview.definition.nodes.find(node=>node.id===id)?.nodeCode }} · {{ manualPreview.definition.nodes.find(node=>node.id===id)?.operationName }}</li></ol>
        </template>
      </template>
      <template #footer><el-button @click="manualIssueVisible=false">关闭</el-button><el-button v-if="!manualPending" type="primary" :loading="manualBusy" :disabled="manualBusy||!manualCalculation||!manualPathComplete||!manualNumber?.available" @click="saveManualIssue">保存统一领料出库草稿</el-button></template>
    </PageDialog>
    <PageDialog v-model="actionVisible" title="不可变库存动作" width="720px" @closed="generation++;action=null;actionError=''">
      <el-alert v-if="actionError" :title="actionError" type="error" :closable="false" />
      <el-descriptions v-if="action" :column="2" border><el-descriptions-item label="动作UUID">{{ action.id }}</el-descriptions-item><el-descriptions-item label="审核UUID">{{ action.operationId||'—' }}</el-descriptions-item><el-descriptions-item label="单据明细ID">{{ action.documentLineId||'—' }}</el-descriptions-item><el-descriptions-item label="业务来源">{{ action.sourceType }} / {{ action.sourceId }}</el-descriptions-item><el-descriptions-item label="库存来源">{{ action.stockId }}</el-descriptions-item><el-descriptions-item label="批次 / 库位">{{ action.batchNo }} / {{ action.binCode }}</el-descriptions-item><el-descriptions-item label="变动量">{{ displayQuantity(action.quantityDelta) }}</el-descriptions-item><el-descriptions-item label="前 / 后余额">{{ displayQuantity(action.quantityBefore) }} / {{ displayQuantity(action.quantityAfter) }}</el-descriptions-item><el-descriptions-item label="操作人">{{ action.operatorUserId }}</el-descriptions-item><el-descriptions-item label="原因">{{ action.reason }}</el-descriptions-item></el-descriptions>
    </PageDialog>
  </div>
</template>

<style scoped>
.document-toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.stock-documents :deep(.page-header) { flex-wrap: wrap; }
.stock-documents :deep(.page-header h1) { white-space: nowrap; }
.stock-documents :deep(.page-header-actions) { flex: 1 1 100%; min-width: 0; max-width: 100%; justify-content: flex-start; }
</style>
