<script setup lang="ts">
import { menuPathForComponent } from '@/lib/menuWorkspaces'
import PageDialog from '@/components/page/PageDialog.vue'

import { normalizedQuantityInput, positiveQuantity } from '@/lib/production/quantityRules'
import { formatQuantity } from '@/lib/quantity'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import StockActionDialog from './StockActionDialog.vue'
import StockDocumentLines from './StockDocumentLines.vue'
import StockDocumentHeader from '@/components/business/warehouse/StockDocumentHeader.vue'
import DocumentFields from '@/components/document/DocumentFields.vue'
import MasterDetailDocument from '@/components/document/MasterDetailDocument.vue'
import SupplierSelect from '@/components/business/SupplierSelect.vue'
import ProductionExecutionSelect from '@/components/business/production/ProductionExecutionSelect.vue'
import { useRoute, useRouter } from 'vue-router'
import StockDocumentActions from '@/components/business/warehouse/StockDocumentActions.vue'
import { stockDocumentApis, stockDocumentPermission as p, stockDocuments, type NumberingRuleOption, type StockDocumentDirection, type StockDocumentTypeOption } from '@/api/wm/stockDocuments'
import { useAuth } from '@/stores/auth'
import type { ProductionInputBasis } from '@/api/wm/stockDocuments'
import { type Field, type Row } from '@/lib/crud'
const route = useRoute(), router = useRouter()
const props = defineProps<{ direction: StockDocumentDirection }>()
const direction = computed(() => props.direction)
const transferPath = computed(() => menuPathForComponent(auth.factoryMenus, 'wm/stockTransfers/index'))
const typeOptions = ref<StockDocumentTypeOption[]>([]), typeOptionsError = ref('')
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
function closeDirectLines(value: boolean) { if (!value) { directDocumentId.value = ''; directLines.value = []; selectedLine.value = null; lineAttempt++ } }
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
  ...(typeof route.query.stockId === 'string' && /^[1-9]\d*$/.test(route.query.stockId) ? { stockId: route.query.stockId } : {}),
  ...(issueListOnly.value && direction.value === 'OUT' ? { documentType: 'MATERIAL_ISSUE' } : {}),
  ...(typeof route.query.documentType === 'string' && typeOptions.value.some(t => t.value === route.query.documentType)
    ? { documentType: route.query.documentType } : {}) }))
const actionDialog = ref<InstanceType<typeof StockActionDialog> | null>(null)
let linkAttempt = 0, typeAttempt = 0
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
  if (hasDocument && !canStockQuery.value && !issueQueryOnly.value) {
    directDocumentId.value = id
    if (canIssueLines.value) void readDirectLines()
    const linkedLine = route.query.lineId
    if (canIssueLine.value && typeof linkedLine === 'string' && /^[1-9]\d*$/.test(linkedLine)) {
      lineId.value = linkedLine
      void readIssueLine(id)
    }
    return
  }
  // The document component owns the authoritative detail read, including direction and permission checks.
  if (hasDocument) { await document.value?.open({ id }); return }
  const attempt = ++linkAttempt, factory = auth.factoryId, revision = auth.revision
  try {
    const detail = await stockDocuments.byRequest(requestId as string)
    if (attempt !== linkAttempt || factory !== auth.factoryId || revision !== auth.revision) return
    await router.replace({ path: route.path, query: { ...route.query, documentId: detail.document.id }})
  } catch(error) { if (attempt === linkAttempt) lineError.value = error instanceof Error ? error.message : '单据读取失败' }
}
onMounted(() => { void loadTypes();void openLinkedDocument() })
watch(() => props.direction, () => { void loadTypes(); if (!route.query.documentId) void document.value?.back() })
watch(() => [route.query.documentId, route.query.requestId], openLinkedDocument)
watch(() => route.query.documentType, () => { if (!route.query.documentId) void document.value?.back() })
let numberingAttempt = 0
function reset() { linkAttempt++;lineAttempt++; directDocumentId.value = ''; directLines.value = []; directBasis.value = null; lineId.value = ''; selectedLine.value = null; lineError.value = ''; lineLoading.value = false; originalLines.clear();pendingDocument.value = null;numberingAttempt++;numberingRules.value = [];selectedNumberRule.value = null;numberingRulesLoading.value = false;numberingRulesError.value = '';actionDialog.value?.clear() }
watch(() => auth.factoryId, () => {
  if (route.query.stockId) { const query = { ...route.query }; delete query.stockId; void router.replace({ path: route.path, query }) }
})
watch(() => [auth.factoryId, auth.revision, auth.factoryPermissions.join('|')], () => { reset();void loadTypes() })
onBeforeUnmount(reset)
function showAction(id: unknown) { void actionDialog.value?.open(id) }
const manualDocumentTypes = computed(() => typeOptions.value.filter(t => t.enabled && t.approvalAvailable
  && !t.value.startsWith('TRANSFER_')))
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
function documentTypeChanged(draft: Row) { draft.sourceExecutionCode = null;draft.supplierName = null;draft.supplierId = null;draft.businessDate = draft.documentType === 'PURCHASE_RECEIPT' ? new Date().toLocaleDateString('en-CA') : null;draft.currency = draft.documentType === 'PURCHASE_RECEIPT' ? 'CNY' : null;draft.supplierDocumentNo = null;draft.ruleCode = null;void loadNumberingRules(draft.documentType, draft) }
const documentTitle = computed(() => direction.value === 'IN' ? '入库单' : '出库单')
const headerFields = computed<Field[]>(() => [
  { key: 'isNew', label: '新建状态', kind: 'text', readonly: true, hidden: true, defaultValue: 'Y' },
  { key: 'ruleCode', label: '单据编号', columnVisible: false, defaultValue: typeof route.query.executionCode === 'string' ? 'PRODUCTION_RECEIPT' : direction.value === 'IN' ? 'OTHER_RECEIPT' : 'OTHER_ISSUE', kind: 'select', showWhen: ruleCodeVisibility },
  { key: 'documentNo', label: '单号', kind: 'text', readonly: true, searchable: true, columnMinWidth: 200 },
  { key: 'direction', label: '方向', kind: 'text', readonly: true, defaultValue: direction.value, hidden: true },
  { key: 'documentType', label: '单据类型', kind: 'select', required: true, defaultValue: typeof route.query.executionCode === 'string' ? 'PRODUCTION_RECEIPT' : direction.value === 'IN' ? 'OTHER_RECEIPT' : 'OTHER_ISSUE', searchable: true, options: typeOptions.value.map(t => ({ value: t.value, label: t.label })) },
  { key: 'status', label: '状态', kind: 'select', readonly: true, searchable: true, options: [{ value: 'DRAFT', label: '草稿', tone: 'warning' }, { value: 'POSTED', label: '已审核', tone: 'success' }, { value: 'CANCELLED', label: '已作废', tone: 'info' }] },
  { key: 'sourceExecutionCode', label: '生产来源', kind: 'text', columnVisible: false, showWhen: { key: 'documentType', value: 'PRODUCTION_RECEIPT' }, defaultValue: typeof route.query.executionCode === 'string' ? route.query.executionCode : undefined },
  { key: 'sourceWorkorderId', label: '工单来源', kind: 'text', readonly: true, hidden: true },
  { key: 'supplierId', label: '供应商', kind: 'text', required: true, columnVisible: false, showWhen: { key: 'documentType', value: 'PURCHASE_RECEIPT' }},
  { key: 'supplierName', label: '供应商', columnVisible: direction.value === 'IN', kind: 'text', readonly: true, columnMinWidth: 200, showWhen: { key: 'documentType', value: 'PURCHASE_RECEIPT' }},
  { key: 'businessDate', label: '业务日期', columnVisible: direction.value === 'IN', kind: 'date', required: true, showWhen: { key: 'documentType', value: 'PURCHASE_RECEIPT' }},
  { key: 'currency', label: '币种', columnVisible: false, kind: 'select', required: true, options: [{ value: 'CNY', label: '人民币 CNY' }], showWhen: { key: 'documentType', value: 'PURCHASE_RECEIPT' }},
  { key: 'supplierDocumentNo', label: '送货单号', columnVisible: false, kind: 'text', maxLength: 128, showWhen: { key: 'documentType', value: 'PURCHASE_RECEIPT' }},
  { key: 'reason', label: '收发原因', kind: 'textarea', required: true, maxLength: 500 },
  { key: 'remark', label: '备注', kind: 'textarea', columnVisible: false, maxLength: 500 },
  { key: 'postedBy', label: '审核人', kind: 'text', readonly: true, hidden: true },
  { key: 'postRequestId', label: '审核请求', kind: 'text', readonly: true, hidden: true, columnMinWidth: 260 },
  { key: 'postedAt', label: '审核时间', kind: 'datetime', readonly: true, columnMinWidth: 180 }
])
const itemFields:Field[] = [
  { key: 'lineNo', label: '行号', kind: 'number', readonly: true },
  { key: 'materialId', label: '物料 / 产品', kind: 'text', required: true },
  { key: 'warehouseId', label: '本地仓库', kind: 'text', required: true },
  { key: 'stockId', label: '批次 / 库位', kind: 'text', required: true },
  { key: 'batchNo', label: '批次', kind: 'text' }, { key: 'binCode', label: '库位', kind: 'text' },
  { key: 'unitId', label: '基本单位', kind: 'text', required: true },
  { key: 'quantity', label: '数量', kind: 'decimal', required: true, format: value => formatQuantity(value as string) },
  { key: 'unitPrice', label: '实际成交单价', kind: 'decimal' },
  { key: 'remark', label: '备注', kind: 'textarea', maxLength: 500 },
  { key: 'stockActionId', label: '库存动作', kind: 'text', readonly: true, columnMinWidth: 260 }
]

</script>
<template>
  <div class="stock-documents">
    <div class="stock-document-links"><router-link v-if="transferPath" :to="transferPath">库存调拨</router-link><router-link v-if="direction==='OUT' && productionInputPath && auth.hasPermission('business:mes:material:issue:update','factory')" :to="productionInputPath">扫码领料</router-link></div>
    <el-alert v-if="typeOptionsError" :title="typeOptionsError" type="error" :closable="false" />
    <template v-if="!canStockList && !canStockQuery && !issueListOnly && !issueQueryOnly && (canIssueLines || canIssueLine)">
      <p v-if="!directDocumentId" class="secondary">请从生产领料记录打开需要查看的明细。</p>
      <PageDialog :model-value="!!directDocumentId" title="生产领料明细" width="min(1280px, 96vw)" @update:model-value="closeDirectLines">
        <el-alert v-if="lineError" :title="lineError" type="error" :closable="false" />
        <StockDocumentLines v-if="directLines.length" :header="{id:directDocumentId,direction:'OUT',documentType:'MATERIAL_ISSUE'}" :items="directLines" :writable="false" :saving="false" :can-issue-line="canIssueLine" :original-lines="originalLines" @show-action="showAction" @read-line="row=>{lineId=String(row.id);readIssueLine(directDocumentId)}" />
        <p v-if="selectedLine">数量 {{ formatQuantity(selectedLine.quantity as string) }}；批次 {{ selectedLine.batchNo || '无批次' }}；库位 {{ selectedLine.binCode || '无库位' }}</p>
        <p v-if="directBasis">工单 {{ directBasis.workorderCode }}，投入 {{ formatQuantity(directBasis.outputQty) }}</p>
      </PageDialog>
    </template>
    <el-alert v-if="initialSearch.stockId" title="仅显示当前库存（物料、仓库、批次、库位）关联的单据" type="info" :closable="false" />
    <MasterDetailDocument
      ref="document"
      presentation="dialog"
      document-number-key="documentNo"
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
      :items-readonly="row=>String(row.documentType).startsWith('TRANSFER_')||row.documentType==='MATERIAL_ISSUE'"
      :header-readonly="row=>String(row.documentType).startsWith('TRANSFER_')||row.documentType==='MATERIAL_ISSUE'||row.status!=='DRAFT'||auth.runtimeMode!=='LOCAL'||pendingDocument===row.id"
      :item-permission-overrides="{list:p+':query',query:p+':query',create:p+':update',update:p+':update',delete:p+':update'}"
      @back="reset"
    >
      <template #header-actions="{row,refresh,dirty}"><router-link v-if="transferPath && (row.documentType==='TRANSFER_RECEIPT' || row.documentType==='TRANSFER_ISSUE')" :to="{path:transferPath,query:{documentId:String(row.id)}}">查看关联调拨</router-link><StockDocumentActions :row="row" :refresh="refresh" :dirty="dirty" @pending="id=>pendingDocument=id" /></template>
      <template #header-fields="{draft,disabled}">
        <template v-if="disabled">
          <StockDocumentHeader :document="draft" :type-label="typeOptions.find(type=>type.value===draft.documentType)?.label" />
        </template>
        <template v-else>
          <section v-for="group in [{title:'',keys:['documentType','ruleCode','sourceExecutionCode']},{title:'采购信息',keys:['supplierId','businessDate','currency','supplierDocumentNo']},{title:'收发说明',keys:['reason','remark']}] .filter(group=>group.title!=='采购信息'||draft.documentType==='PURCHASE_RECEIPT')" :key="group.title" class="header-field-group">
            <h3 v-if="group.title">{{ group.title }}</h3>
            <DocumentFields :fields="group.keys.flatMap(key=>headerFields.filter(field=>field.key===key))" :draft="draft" :disabled="disabled">
              <template #field-supplierId="{draft,disabled}"><span v-if="disabled">{{ draft.supplierName || '—' }}</span><div v-else><SupplierSelect v-model="draft.supplierId as string | null" status="ENABLED" /></div></template>

              <template #field-documentType="{draft,disabled}"><el-select v-model="draft.documentType as string" :disabled="disabled||!!draft.id" @change="()=>documentTypeChanged(draft)"><el-option v-for="type in draft.id?typeOptions:manualDocumentTypes" :key="type.value" :label="type.label+(type.approvalAvailable?'':'（仅草稿）')" :value="type.value" :disabled="!type.enabled" /></el-select></template>
              <template #field-ruleCode="{draft}"><div @vue:mounted="!draft.id && loadNumberingRules(draft.documentType,draft)"><el-alert v-if="numberingRulesError" :title="numberingRulesError" type="error" :closable="false" /><span class="secondary">{{ numberingRulesLoading ? '读取编号…' : selectedNumberRule?.preview || '保存时自动生成' }}</span></div></template>
              <template #field-sourceExecutionCode="{draft,disabled}"><ProductionExecutionSelect v-model="(draft.sourceExecutionCode as string|null)" :statuses="['RUNNING']" :disabled="disabled||!!draft.id||draft.documentType!=='PRODUCTION_RECEIPT'" /></template>

            </DocumentFields>
          </section>
        </template>
      </template>
      <template #items="{ header, items, writable, saving, add, remove }">
        <el-alert v-if="header.documentType === 'MATERIAL_ISSUE' && !canIssueLines" title="当前账号没有领料明细列表权限。" type="info" :closable="false" />
        <template v-else>
          <div class="document-toolbar"><el-button v-if="writable" type="primary" plain :disabled="saving" @click="add({materialId:null,warehouseId:null,stockId:null,unitId:null,batchNo:null,binCode:null,quantity:'',remark:''})">添加明细</el-button><span class="secondary">{{ items.length }} 条明细<span v-if="header.status==='POSTED'"> · 已审核，库存已更新</span><span v-else-if="writable"> · 保存草稿后审核生效</span></span></div>
          <StockDocumentLines :header="header" :items="items" :writable="writable" :saving="saving" :can-issue-line="canIssueLine" :original-lines="originalLines" @validity="setQuantityValidity" @remove="remove" @show-action="showAction" @read-line="row=>{lineId=String(row.id);readIssueLine(header.id)}" />
        </template>
        <p v-if="header.documentType === 'MATERIAL_ISSUE' && !canIssueLines && canIssueLine" class="secondary">请从领料记录打开指定明细。</p>
        <el-alert v-if="lineError" :title="lineError" type="error" :closable="false" />
        <el-descriptions v-if="selectedLine && header.documentType === 'MATERIAL_ISSUE'" :column="2" border>
          <el-descriptions-item label="批次">{{ selectedLine.batchNo || '—' }}</el-descriptions-item>
          <el-descriptions-item label="数量">{{ formatQuantity(selectedLine.quantity as string) }}</el-descriptions-item>
        </el-descriptions>
      </template>
    </MasterDetailDocument>

    <StockActionDialog ref="actionDialog" />
  </div>
</template>

<style scoped>
.document-toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.stock-document-links { display: flex; justify-content: flex-end; gap: var(--ui-space-4); padding: 0 var(--ui-space-4); }
.header-field-group + .header-field-group { border-top: 1px solid var(--ui-border-soft); margin-top: var(--ui-space-4); padding-top: var(--ui-space-4); }
.header-field-group h3 { font-size: 14px; font-weight: 500; margin: 0 0 var(--ui-space-3); }
.stock-documents :deep(.page-header) { flex-wrap: wrap; }
.stock-documents :deep(.page-header h1) { white-space: nowrap; }
.stock-documents :deep(.page-header-actions) { flex: 1 1 100%; min-width: 0; max-width: 100%; justify-content: flex-start; }
</style>
