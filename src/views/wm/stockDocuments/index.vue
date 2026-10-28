<script setup lang="ts">
import { menuPathForComponent } from '@/lib/menuWorkspaces'
import PageDialog from '@/components/page/PageDialog.vue'

import QuantityInput from '@/components/business/material/QuantityInput.vue'
import { loadQuantityRule, quantityInputError, normalizedQuantityInput, positiveQuantity } from '@/lib/production/quantityRules'
import { displayQuantity } from '@/lib/production/quantity'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import MasterDetailDocument from '@/components/document/MasterDetailDocument.vue'
import MaterialSelect from '@/components/business/MaterialSelect.vue'
import WarehouseSelect from '@/components/business/WarehouseSelect.vue'
import ProductionExecutionSelect from '@/components/business/production/ProductionExecutionSelect.vue'
import { useRoute } from 'vue-router'
import StockSourceSelect from '@/components/business/warehouse/StockSourceSelect.vue'
import StockDocumentActions from '@/components/business/warehouse/StockDocumentActions.vue'
import { stockDocumentApis, stockDocumentPermission as p, stockDocumentTypes, stockDocuments, type NumberingRuleOption } from '@/api/wm/stockDocuments'
import { useAuth } from '@/stores/auth'
import { request } from '@/lib/request'
import type { StockAction } from '@/api/wm/localStock'
import type { CrudApi, Field, Row } from '@/lib/crud'
const route = useRoute()
const pendingDocument = ref<string | null>(null)
const numberingRules = ref<NumberingRuleOption[]>([]), numberingRulesLoading = ref(false), numberingRulesError = ref('')
const auth = useAuth(), document = ref<InstanceType<typeof MasterDetailDocument> | null>(null)
const productionInputPath = computed(() => menuPathForComponent(auth.factoryMenus, 'production/productionInput/index'))
const { headerApi, itemApi: baseItemApi, clear } = stockDocumentApis(async() => { await document.value?.refresh() })
const originalLines = new Map<string, Row>()
const remember = (row:Row) => { originalLines.set(String(row.id), { ...row });return row }
async function checkedLine(raw:unknown, id?:string) {
  const row = raw as Row, previous = id ? originalLines.get(id) : null
  const value = normalizedQuantityInput(String(row.quantity ?? ''))
  if (previous && previous.materialId===row.materialId && previous.stockId===row.stockId && previous.unitId===row.unitId && normalizedQuantityInput(String(previous.quantity))===value) return row
  const factory = auth.factoryId, revision = auth.revision
  if (!factory || !auth.hasPermission('business:material:query','factory') || !auth.hasPermission('business:unit:measure:query','factory')) throw Error('没有读取物料单位规则的权限')
  const rule = await loadQuantityRule(String(row.materialId), factory, revision, () => factory===auth.factoryId && revision===auth.revision)
  if (factory!==auth.factoryId || revision!==auth.revision) throw Error('工厂上下文已变化，请重新打开明细')
  const error = quantityInputError(value, rule)
  if (error || !positiveQuantity(value)) throw Error(error || '收发数量必须大于零')
  return { ...row, quantity: value }
}
const itemApi:CrudApi = { ...baseItemApi,
  list: async q => { const page = await baseItemApi.list(q);page.items.forEach(remember);return page },
  detail: async id => remember(await baseItemApi.detail!(id)),
  create: async raw => baseItemApi.create(await checkedLine(raw)),
  update: async(id,raw) => baseItemApi.update(id, await checkedLine(raw,id))
}
const action = ref<StockAction | null>(null), actionVisible = ref(false), actionError = ref('')
function openLinkedDocument() { const id = route.query.documentId;if (typeof id === 'string' && /^[1-9]\d*$/.test(id)) void document.value?.open({ id }) }
onMounted(openLinkedDocument)
watch(() => route.query.documentId, openLinkedDocument)
let generation = 0, numberingAttempt = 0
function reset() { originalLines.clear();pendingDocument.value = null;generation++;numberingAttempt++;numberingRules.value = [];numberingRulesLoading.value = false;numberingRulesError.value = '';action.value = null;actionVisible.value = false;actionError.value = '';clear() }
watch(() => [auth.factoryId, auth.revision, auth.factoryPermissions.join('|')], reset)
onBeforeUnmount(reset)
async function showAction(id:unknown) {
  if (!id || !auth.hasPermission('business:wm:stock:action:query', 'factory')) return
  const g = ++generation;action.value = null;actionError.value = '';actionVisible.value = true
  try { const result = await request<StockAction>('/api/wm/wm-stock-action/' + encodeURIComponent(String(id)), { scope: 'factory' });if (g === generation)action.value = result } catch(e) { if (g === generation)actionError.value = e instanceof Error ? e.message : '动作读取失败' }
}
const manualDocumentTypes = stockDocumentTypes.filter(t => !['DEFECT_RECEIPT', 'SCRAP_RECEIPT', 'MATERIAL_ISSUE'].includes(t.value))
const ruleCodeVisibility: Field['showWhen'] = Object.freeze({
  key: 'isNew',
  value: 'Y'
})
function numberingType(documentType: unknown): 'STOCK_IN' | 'STOCK_OUT' | null {
  if (typeof documentType !== 'string') return null
  if (documentType.endsWith('_RECEIPT')) return 'STOCK_IN'
  if (documentType.endsWith('_ISSUE')) return 'STOCK_OUT'
  return null
}
async function loadNumberingRules(documentType: unknown) {
  const type = numberingType(documentType), attempt = ++numberingAttempt, factory = auth.factoryId, revision = auth.revision
  numberingRules.value = [];numberingRulesError.value = ''
  if (!type || !factory || !auth.hasPermission(p + ':create', 'factory')) return
  numberingRulesLoading.value = true
  try {
    const result = await stockDocuments.numberingRules(type)
    if (attempt !== numberingAttempt || factory !== auth.factoryId || revision !== auth.revision) return
    numberingRules.value = result
  } catch(e) { if (attempt === numberingAttempt) numberingRulesError.value = e instanceof Error ? e.message : '编码规则读取失败' } finally { if (attempt === numberingAttempt) numberingRulesLoading.value = false }
}
function documentTypeChanged(draft: Row) { draft.sourceExecutionId = null;draft.ruleCode = null;void loadNumberingRules(draft.documentType) }
const headerFields:Field[] = [
  { key: 'isNew', label: '新建状态', kind: 'text', readonly: true, hidden: true, defaultValue: 'Y' },
  { key: 'ruleCode', label: '编码规则', kind: 'select', showWhen: ruleCodeVisibility },
  { key: 'documentNo', label: '单号', kind: 'text', readonly: true, searchable: true, columnMinWidth: 240 },
  { key: 'documentType', label: '单据类型', kind: 'select', required: true, defaultValue: typeof route.query.executionId === 'string' ? 'PRODUCTION_RECEIPT' : 'OTHER_RECEIPT', searchable: true, options: stockDocumentTypes.map(t => ({ value: t.value, label: t.label })) },
  { key: 'status', label: '状态', kind: 'select', readonly: true, searchable: true, options: [{ value: 'DRAFT', label: '草稿', tone: 'warning' }, { value: 'POSTED', label: '已审核', tone: 'success' }, { value: 'CANCELLED', label: '已作废', tone: 'info' }] },
  { key: 'sourceExecutionId', label: '生产来源执行单元', kind: 'text', defaultValue: typeof route.query.executionId === 'string' ? route.query.executionId : undefined },
  { key: 'sourceMaterialIssueId', label: '正式领料事实ID', kind: 'text', readonly: true, columnMinWidth: 180 },
  { key: 'sourceWorkorderId', label: '工单来源', kind: 'text', readonly: true },
  { key: 'reason', label: '处理原因 / 实物依据', kind: 'textarea', required: true, maxLength: 500 },
  { key: 'remark', label: '备注', kind: 'textarea', maxLength: 500 },
  { key: 'postedBy', label: '审核人ID', kind: 'text', readonly: true },
  { key: 'postRequestId', label: '审核请求UUID', kind: 'text', readonly: true, columnMinWidth: 260 },
  { key: 'postedAt', label: '审核时间', kind: 'datetime', readonly: true, columnMinWidth: 180 }
]
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
    <el-alert title="新建单据只保存草稿，审核通过后才执行库存业务。生产入库请选择生产完工入库类型及执行单元，并核对可入库额度；其他物料入库填写实物依据，不需要生产交接。" type="info" :closable="false" />
    <router-link v-if="productionInputPath && auth.hasPermission('business:mes:material:issue:update','factory') && auth.hasPermission(p+':create','factory') && auth.hasPermission(p+':update','factory')" :to="productionInputPath">按BOM新增生产领料草稿</router-link>
    <MasterDetailDocument
      ref="document"
      item-version-field="revision"
      items-readonly-when-dirty
      title="出入库单"
      :header-api="headerApi"
      :item-api="itemApi"
      :header-fields="headerFields"
      :item-fields="itemFields"
      :header-permission="p"
      :item-permission="p"
      parent-key="documentId"
      :items-readonly="row=>row.documentType==='MATERIAL_ISSUE'"
      :header-readonly="row=>row.status!=='DRAFT'||auth.runtimeMode!=='LOCAL'||pendingDocument===row.id"
      :item-permission-overrides="{list:p+':query',query:p+':query',create:p+':update',update:p+':update',delete:p+':update'}"
    >
      <template #header-actions="{row,refresh,dirty}"><StockDocumentActions :row="row" :refresh="refresh" :dirty="dirty" @pending="id=>pendingDocument=id" /></template>
      <template #field-documentType="{draft,disabled}"><el-select v-model="draft.documentType as string" :disabled="disabled||!!draft.id" @change="()=>documentTypeChanged(draft)"><el-option v-for="type in draft.id?stockDocumentTypes:manualDocumentTypes" :key="type.value" :label="type.label+(type.approvalAvailable?'':'（仅草稿）')" :value="type.value" /></el-select></template>
      <template #field-ruleCode="{draft,disabled}"><div><el-alert v-if="numberingRulesError" :title="numberingRulesError" type="error" :closable="false" /><el-select v-model="draft.ruleCode as string" :disabled="disabled||!!draft.id" :loading="numberingRulesLoading" placeholder="请选择与单据类型匹配的编码规则" @visible-change="(visible: boolean)=>visible&&numberingRules.length===0&&!numberingRulesLoading&&loadNumberingRules(draft.documentType)"><el-option v-for="rule in numberingRules" :key="rule.ruleCode" :value="rule.ruleCode" :label="`${rule.ruleName}（${rule.ruleCode}）`" /></el-select><span class="secondary">单号由服务端生成，规则编码类别由单据类型固定。</span></div></template>
      <template #field-sourceExecutionId="{draft,disabled}"><ProductionExecutionSelect v-model="(draft.sourceExecutionId as string|null)" :statuses="['RUNNING']" :disabled="disabled||!!draft.id||draft.documentType!=='PRODUCTION_RECEIPT'" /></template>
      <template #field-materialId="{draft,disabled}"><MaterialSelect v-model="(draft.materialId as string|null)" :disabled="disabled" @update:model-value="resetIdentity(draft)" /></template>
      <template #field-warehouseId="{draft,disabled}"><WarehouseSelect v-model="(draft.warehouseId as string|null)" source="LOCAL" :disabled="disabled" @update:model-value="resetIdentity(draft)" /></template>
      <template #field-stockId="{draft,disabled}"><StockSourceSelect v-model="(draft.stockId as string|null)" :material-id="(draft.materialId as string|null)" :warehouse-id="(draft.warehouseId as string|null)" :disabled="disabled" receipt @selected="(s,unit)=>{draft.materialId=s.materialId;draft.warehouseId=s.warehouseId;draft.batchNo=s.batchNo;draft.binCode=s.binCode;draft.unitId=unit}" /></template>
      <template #field-quantity="{draft,disabled}"><QuantityInput v-model="draft.quantity as string" :material-id="draft.materialId as string" required positive :disabled="disabled" :unchanged-value="originalLines.get(String(draft.id))?.materialId===draft.materialId ? originalLines.get(String(draft.id))?.quantity as string : null" /></template>
      <template #field-batchNo="{draft}"><el-input :model-value="draft.batchNo" disabled placeholder="来自库存来源" /></template>
      <template #field-binCode="{draft}"><el-input :model-value="draft.binCode" disabled placeholder="来自库存来源" /></template>
      <template #field-unitId="{draft}"><el-input :model-value="draft.unitId" disabled placeholder="物料基本单位" /></template>
      <template #cell-stockActionId="{row}"><el-button v-if="row.stockActionId&&auth.hasPermission('business:wm:stock:action:query','factory')" link type="primary" @click="showAction(row.stockActionId)">{{ row.stockActionId }}</el-button><span v-else>{{ row.stockActionId||'待审核执行' }}</span></template>
    </MasterDetailDocument>
    <PageDialog v-model="actionVisible" title="不可变库存动作" width="720px" @closed="generation++;action=null;actionError=''">
      <el-alert v-if="actionError" :title="actionError" type="error" :closable="false" />
      <el-descriptions v-if="action" :column="2" border><el-descriptions-item label="动作UUID">{{ action.id }}</el-descriptions-item><el-descriptions-item label="审核UUID">{{ action.operationId||'—' }}</el-descriptions-item><el-descriptions-item label="单据明细ID">{{ action.documentLineId||'—' }}</el-descriptions-item><el-descriptions-item label="业务来源">{{ action.sourceType }} / {{ action.sourceId }}</el-descriptions-item><el-descriptions-item label="库存来源">{{ action.stockId }}</el-descriptions-item><el-descriptions-item label="批次 / 库位">{{ action.batchNo }} / {{ action.binCode }}</el-descriptions-item><el-descriptions-item label="变动量">{{ displayQuantity(action.quantityDelta) }}</el-descriptions-item><el-descriptions-item label="前 / 后余额">{{ displayQuantity(action.quantityBefore) }} / {{ displayQuantity(action.quantityAfter) }}</el-descriptions-item><el-descriptions-item label="操作人">{{ action.operatorUserId }}</el-descriptions-item><el-descriptions-item label="原因">{{ action.reason }}</el-descriptions-item></el-descriptions>
    </PageDialog>
  </div>
</template>

<style scoped>
.stock-documents :deep(.page-header) { flex-wrap: wrap; }
.stock-documents :deep(.page-header h1) { white-space: nowrap; }
.stock-documents :deep(.page-header-actions) { flex: 1 1 100%; min-width: 0; max-width: 100%; justify-content: flex-start; }
</style>
