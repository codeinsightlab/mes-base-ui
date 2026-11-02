<script setup lang="ts">
import { menuPathForComponent } from '@/lib/menuWorkspaces'
import PageDialog from '@/components/page/PageDialog.vue'

import { normalizedQuantityInput, positiveQuantity } from '@/lib/production/quantityRules'
import QuantityInput from '@/components/business/material/QuantityInput.vue'
import { formatQuantity } from '@/lib/quantity'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import MasterDetailDocument from '@/components/document/MasterDetailDocument.vue'
import MaterialSelect from '@/components/business/MaterialSelect.vue'
import WarehouseSelect from '@/components/business/WarehouseSelect.vue'
import ProductionExecutionSelect from '@/components/business/production/ProductionExecutionSelect.vue'
import { useRoute, useRouter } from 'vue-router'
import StockSourceSelect from '@/components/business/warehouse/StockSourceSelect.vue'
import StockDocumentActions from '@/components/business/warehouse/StockDocumentActions.vue'
import { stockDocumentApis, stockDocumentPermission as p, stockDocuments, type NumberingRuleOption, type StockDocumentDirection, type StockDocumentTypeOption } from '@/api/wm/stockDocuments'
import { useAuth } from '@/stores/auth'
import { request } from '@/lib/request'
import type { StockAction } from '@/api/wm/localStock'
import type { ProductionInputBasis } from '@/api/wm/stockDocuments'
import type { Field, Row } from '@/lib/crud'
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
  const attempt = ++linkAttempt, factory = auth.factoryId, revision = auth.revision
  try {
    const detail = hasDocument
      ? await stockDocuments.detail(id, direction.value, issueQueryOnly.value)
      : await stockDocuments.byRequest(requestId as string)
    if (attempt !== linkAttempt || factory !== auth.factoryId || revision !== auth.revision) return
    if (!hasDocument || detail.document.direction !== direction.value) {
      await router.replace({ path: route.path, query: { ...route.query, documentId: detail.document.id }})
      return
    }
    await loadTypes()
    if (attempt === linkAttempt && factory === auth.factoryId && revision === auth.revision) void document.value?.open({ id })
  } catch(error) { if (attempt === linkAttempt) lineError.value = error instanceof Error ? error.message : '单据读取失败' }
}
onMounted(() => { void loadTypes();void openLinkedDocument() })
watch(() => props.direction, () => { void loadTypes(); if (!route.query.documentId) void document.value?.back() })
watch(() => [route.query.documentId, route.query.requestId], openLinkedDocument)
watch(() => route.query.documentType, () => { if (!route.query.documentId) void document.value?.back() })
let generation = 0, numberingAttempt = 0
function reset() { linkAttempt++;lineAttempt++; directDocumentId.value = ''; directLines.value = []; directBasis.value = null; lineId.value = ''; selectedLine.value = null; lineError.value = ''; lineLoading.value = false; originalLines.clear();pendingDocument.value = null;generation++;numberingAttempt++;numberingRules.value = [];selectedNumberRule.value = null;numberingRulesLoading.value = false;numberingRulesError.value = '';action.value = null;actionVisible.value = false;actionError.value = '' }
watch(() => [auth.factoryId, auth.revision, auth.factoryPermissions.join('|')], () => { reset();void loadTypes() })
onBeforeUnmount(reset)
async function showAction(id:unknown) {
  if (!id || !auth.hasPermission('business:wm:stock:action:query', 'factory')) return
  const g = ++generation;action.value = null;actionError.value = '';actionVisible.value = true
  try { const result = await request<StockAction>('/api/wm/wm-stock-action/' + encodeURIComponent(String(id)), { scope: 'factory' });if (g === generation)action.value = result } catch(e) { if (g === generation)actionError.value = e instanceof Error ? e.message : '动作读取失败' }
}
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
function documentTypeChanged(draft: Row) { draft.sourceExecutionId = null;draft.ruleCode = null;void loadNumberingRules(draft.documentType, draft) }
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
  { key: 'quantity', label: '本次收发数量', kind: 'decimal', required: true, format: value => formatQuantity(value as string) },
  { key: 'remark', label: '明细 / 实物清点依据', kind: 'textarea', maxLength: 500 },
  { key: 'stockActionId', label: '库存动作', kind: 'text', readonly: true, columnMinWidth: 260 }
]
function resetIdentity(draft:Row) { draft.stockId = null;draft.batchNo = null;draft.binCode = null;draft.unitId = null }
</script>
<template>
  <div class="stock-documents">
    <router-link v-if="transferPath" :to="transferPath">办理库存调拨</router-link>
    <el-alert v-if="typeOptionsError" :title="typeOptionsError" type="error" :closable="false" />
    <el-alert :title="direction==='IN'?'新建入库单先保存草稿，审核通过后才增加库存。未接入来源的类型禁止审核。':'新建出库单先保存草稿，审核通过后才扣减库存。通用出库不产生生产投入；生产领料请使用 MES 扫码入口。'" type="info" :closable="false" />
    <router-link v-if="direction==='OUT' && productionInputPath && auth.hasPermission('business:mes:material:issue:update','factory')" :to="productionInputPath">扫码投产并领料</router-link>
    <section v-if="!canStockList && !canStockQuery && !issueListOnly && !issueQueryOnly && (canIssueLines || canIssueLine)">
      <h3>读取生产领料明细</h3>
      <el-input v-model="directDocumentId" aria-label="领料单据 ID" placeholder="单据 ID" />
      <el-button v-if="canIssueLines" :loading="lineLoading" @click="readDirectLines">读取明细列表</el-button>
      <template v-if="canIssueLine"><el-input v-model="lineId" aria-label="独立领料明细 ID" placeholder="明细 ID" /><el-button :loading="lineLoading" @click="readIssueLine(directDocumentId)">读取指定明细</el-button></template>
      <el-alert v-if="lineError" :title="lineError" type="error" :closable="false" />
      <el-table v-if="directLines.length" :data="directLines"><el-table-column prop="id" label="明细 ID" /><el-table-column prop="materialId" label="物料" /><el-table-column prop="warehouseId" label="仓库" /><el-table-column label="数量"><template #default="{row}">{{ formatQuantity(row.quantity) }}</template></el-table-column></el-table>
      <p v-if="selectedLine">明细 {{ selectedLine.id }}：物料 {{ selectedLine.materialId }}，数量 {{ formatQuantity(selectedLine.quantity) }}</p>
      <p v-if="directBasis">工单 {{ directBasis.workorderCode }}，投入 {{ formatQuantity(directBasis.outputQty) }}，领料 {{ formatQuantity(directBasis.issueQty) }}</p>
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
      :items-readonly="row=>String(row.documentType).startsWith('TRANSFER_')||row.documentType==='MATERIAL_ISSUE'"
      :header-readonly="row=>String(row.documentType).startsWith('TRANSFER_')||row.documentType==='MATERIAL_ISSUE'||row.status!=='DRAFT'||auth.runtimeMode!=='LOCAL'||pendingDocument===row.id"
      :item-permission-overrides="{list:p+':query',query:p+':query',create:p+':update',update:p+':update',delete:p+':update'}"
    >
      <template #header-actions="{row,refresh,dirty}"><router-link v-if="transferPath && (row.documentType==='TRANSFER_RECEIPT' || row.documentType==='TRANSFER_ISSUE')" :to="{path:transferPath,query:{documentId:String(row.id)}}">查看关联调拨</router-link><StockDocumentActions :row="row" :refresh="refresh" :dirty="dirty" @pending="id=>pendingDocument=id" /></template>
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
            <el-table-column label="数量" min-width="160"><template #default="{row}"><QuantityInput v-if="writable" v-model="row.quantity" :material-id="(row.materialId as string | null)" required positive :unchanged-value="originalLines.get(String(row.id))?.materialId===row.materialId && originalLines.get(String(row.id))?.stockId===row.stockId && originalLines.get(String(row.id))?.unitId===row.unitId ? originalLines.get(String(row.id))?.quantity as string : null" @validity="setQuantityValidity(row,$event)" /><span v-else>{{ formatQuantity(row.quantity as string) }}</span></template></el-table-column>
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
          <el-descriptions-item label="数量">{{ formatQuantity(selectedLine.quantity as string) }}</el-descriptions-item>
          <el-descriptions-item label="单位">{{ selectedLine.unitId || '待确认' }}</el-descriptions-item>
        </el-descriptions>
      </template>
    </MasterDetailDocument>

    <PageDialog v-model="actionVisible" title="不可变库存动作" width="720px" @closed="generation++;action=null;actionError=''">
      <el-alert v-if="actionError" :title="actionError" type="error" :closable="false" />
      <el-descriptions v-if="action" :column="2" border><el-descriptions-item label="动作UUID">{{ action.id }}</el-descriptions-item><el-descriptions-item label="审核UUID">{{ action.operationId||'—' }}</el-descriptions-item><el-descriptions-item label="单据明细ID">{{ action.documentLineId||'—' }}</el-descriptions-item><el-descriptions-item label="业务来源">{{ action.sourceType }} / {{ action.sourceId }}</el-descriptions-item><el-descriptions-item label="库存来源">{{ action.stockId }}</el-descriptions-item><el-descriptions-item label="批次 / 库位">{{ action.batchNo }} / {{ action.binCode }}</el-descriptions-item><el-descriptions-item label="变动量">{{ formatQuantity(action.quantityDelta) }}</el-descriptions-item><el-descriptions-item label="前 / 后余额">{{ formatQuantity(action.quantityBefore) }} / {{ formatQuantity(action.quantityAfter) }}</el-descriptions-item><el-descriptions-item label="操作人">{{ action.operatorUserId }}</el-descriptions-item><el-descriptions-item label="原因">{{ action.reason }}</el-descriptions-item></el-descriptions>
    </PageDialog>
  </div>
</template>

<style scoped>
.document-toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.stock-documents :deep(.page-header) { flex-wrap: wrap; }
.stock-documents :deep(.page-header h1) { white-space: nowrap; }
.stock-documents :deep(.page-header-actions) { flex: 1 1 100%; min-width: 0; max-width: 100%; justify-content: flex-start; }
</style>
