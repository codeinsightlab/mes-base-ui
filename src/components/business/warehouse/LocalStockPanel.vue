<script setup lang="ts">
import { usePageMessageBox } from '@/lib/pageMessageBox'

import PageDrawer from '@/components/page/PageDrawer.vue'
import Pagination from '@/components/Pagination/index.vue'

import { menuPathForComponent } from '@/lib/menuWorkspaces'
import { computed, onBeforeUnmount, onDeactivated, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useAuth } from '@/stores/auth'
import { ApiError } from '@/lib/request'
import QuantityInput from '@/components/business/material/QuantityInput.vue'
import QuantityText from '@/components/business/production/QuantityText.vue'
import { formatQuantity } from '@/lib/quantity'
import { firstValidationError, requiredFieldError, textLengthError } from '@/lib/formValidation'
import { logPendingRequest } from '@/lib/requestDiagnostics'
import DateTimeText from '@/components/DateTimeText.vue'
import { loadQuantityRule, normalizedQuantityInput, positiveQuantity } from '@/lib/production/quantityRules'
import { api as unitMeasureApi } from '@/api/basic/unitMeasure'
import { api, type WmInventoryVo } from '@/api/wm/wmInventory'
import { stockDocuments, type Line } from '@/api/wm/stockDocuments'
import { localStock, stockOperations, type StockOperation, type StockCommand, type StockAction } from '@/api/wm/localStock'
const ElMessageBox = usePageMessageBox()

const emit = defineEmits<{ changed: [] }>()
const router = useRouter()
const auth = useAuth(), visible = ref(false), stockId = ref(''), stock = ref<WmInventoryVo | null>(null)
const operation = ref<StockOperation | ''>(''), error = ref(''), busy = ref(false), loading = ref(false)
const rows = ref<StockAction[]>([]), total = ref(0), offset = ref(0)
const activeTab = ref('ledger'), stockError = ref(''), actionsError = ref('')
const unitName = ref(''), actionUnitNames = ref<Record<string, string>>({}), unitError = ref('')
const form = reactive({ quantity: '', reason: '', documentId: '', documentLineId: '' })
const issueLines = ref<Line[]>([]), issueLineError = ref(''), issueLinesLoading = ref(false)
const canReadIssueLines = computed(() => auth.hasPermission('business:wm:stock:document:query', 'factory') || auth.hasPermission('business:mes:material:issue:item:list', 'factory'))
const quantityValid = ref(false)
const settlementQuantity = computed(() => {
  if (!stock.value) return null
  if (operation.value === 'loss') return stock.value.quantity
  if (operation.value === 'correction') return '-' + normalizedQuantityInput(stock.value.quantity)
  return null
})
const openingUnavailable = computed(() => !!stock.value && (
  normalizedQuantityInput(stock.value.quantity) !== '0'
  || normalizedQuantityInput(stock.value.availableQuantity ?? stock.value.quantity) !== '0'
  || total.value > 0
))
const pending = ref<{ operation: StockOperation; command: StockCommand } | null>(null)
const granted = computed(() => stockOperations.filter(o => auth.hasPermission('business:wm:stock:' + o.value, 'factory')))
const options = computed(() => (pending.value || auth.runtimeMode === 'LOCAL' && stock.value?.warehouseSource === 'LOCAL' ? granted.value : []).filter(o => o.value !== 'receipt' || pending.value?.operation === 'receipt'))
const inboundPath = computed(() => menuPathForComponent(auth.factoryMenus, 'wm/inboundDocuments/index'))
const outboundPath = computed(() => menuPathForComponent(auth.factoryMenus, 'wm/outboundDocuments/index'))
const readable = computed(() => auth.hasPermission('business:wm:stock:action:list', 'factory'))
let generation = 0, attempt = 0, issueLineAttempt = 0, uncertain = false, lastLedgerOffset = 0
const key = () => `mes-stock-pending:${auth.username}:${auth.factoryId}:${stockId.value}`
function clear() { lastLedgerOffset = 0; activeTab.value = 'ledger'; stockError.value = ''; actionsError.value = ''; issueLines.value = [];issueLineError.value = '';issueLinesLoading.value = false;generation++; attempt++; stock.value = null; rows.value = []; total.value = offset.value = 0; error.value = ''; unitError.value = '';unitName.value = '';actionUnitNames.value = {};operation.value = ''; busy.value = loading.value = false; pending.value = null; quantityValid.value = false; uncertain = false; Object.assign(form, { quantity: '', reason: '', documentId: '', documentLineId: '' }) }
async function load() {
  const scope = generation, ticket = ++attempt, requestedOffset = offset.value; loading.value = true; error.value = ''
  try {
    const [detail, ledger] = await Promise.allSettled([api.detail(stockId.value), readable.value ? localStock.actions(stockId.value, requestedOffset) : Promise.resolve({ items: [], total: 0 })])
    if (scope !== generation || ticket !== attempt) return
    stockError.value = ''; actionsError.value = ''
    if (detail.status === 'fulfilled') stock.value = detail.value
    else {
      stockError.value = detail.reason instanceof Error ? detail.reason.message : '库存余额读取失败'
      if (detail.reason instanceof ApiError && (detail.reason.status === 401 || detail.reason.status === 403)) stock.value = null
    }
    if (ledger.status === 'fulfilled') { rows.value = ledger.value.items; total.value = ledger.value.total; lastLedgerOffset = requestedOffset } else {
      offset.value = lastLedgerOffset
      actionsError.value = ledger.reason instanceof Error ? ledger.reason.message : '库存流水读取失败'
      if (ledger.reason instanceof ApiError && (ledger.reason.status === 401 || ledger.reason.status === 403)) { rows.value = []; total.value = offset.value = lastLedgerOffset = 0 }
    }
    const current = stock.value
    const actions = rows.value
    unitError.value = ''
    let currentUnitId = ''
    try {
      const factoryId = auth.factoryId
      if (!factoryId) throw new Error('工厂上下文不可用')
      if (current) {
        const rule = await loadQuantityRule(current.materialId, factoryId, auth.revision,
          () => factoryId === auth.factoryId && !auth.factorySwitching)
        if (scope !== generation || ticket !== attempt) return
        currentUnitId = rule.unitId ?? ''
        unitName.value = rule.unitName ?? ''
      }
    } catch(reason) {
      if (scope === generation && ticket === attempt) unitError.value = reason instanceof Error ? reason.message : '物料单位读取失败'
    }
    const unitIds = [...new Set(actions.map(row => row.unitId))].filter(id => id !== currentUnitId)
    const namedUnits = await Promise.allSettled(unitIds.map(async id => [id, (await unitMeasureApi.detail(id)).name] as const))
    if (scope !== generation || ticket !== attempt) return
    actionUnitNames.value = Object.fromEntries([
      ...(currentUnitId && unitName.value ? [[currentUnitId, unitName.value] as const] : []),
      ...namedUnits.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])
    ])
    if (namedUnits.some(result => result.status === 'rejected') && !unitError.value) unitError.value = '部分历史流水的单位名称未能读取'
  } catch(e) { if (scope === generation && ticket === attempt) actionsError.value = e instanceof Error ? e.message : '库存读取失败' } finally { if (scope === generation && ticket === attempt) loading.value = false }
}
function open(id: string) {
  clear(); stockId.value = id; visible.value = true
  const saved = sessionStorage.getItem(key())
  if (saved) { try { pending.value = JSON.parse(saved); uncertain = true; operation.value = pending.value!.operation;activeTab.value = 'operations';logPendingRequest('local-stock', pending.value!.command.requestId) } catch { error.value = '原请求无法读取，请核实库存流水后处理'; return } }
  void load()
}
defineExpose({ open })
async function submit() {
  const selectedOperation = operation.value
  if (busy.value || !stock.value || !selectedOperation || !options.value.some(o => o.value === selectedOperation)) return
  if (!pending.value) {
    const quantity = normalizedQuantityInput(form.quantity)
    const nonzero = positiveQuantity(quantity.replace(/^-/, ''))
    const directionValid = selectedOperation === 'correction' ? nonzero : selectedOperation === 'opening' ? /^\d{1,14}(?:\.\d{1,6})?$/.test(quantity) : positiveQuantity(quantity)
    const validationError = firstValidationError([
      requiredFieldError(form.quantity, '数量'),
      quantityValid.value ? null : '数量不符合当前物料单位精度规则',
      directionValid ? null : '数量不符合当前操作方向',
      requiredFieldError(form.reason, '业务原因'),
      textLengthError(form.reason, '业务原因', { max: 500 }),
      selectedOperation === 'return' ? requiredFieldError(form.documentId, '原领料出库单ID') : null
    ])
    if (validationError) { error.value = validationError; return }
    pending.value = { operation: selectedOperation, command: { requestId: crypto.randomUUID(), stockId: stockId.value, quantity, expectedQuantity: stock.value.quantity, expectedAvailable: stock.value.availableQuantity ?? stock.value.quantity, reason: form.reason, documentId: selectedOperation === 'return' ? form.documentId : null, documentLineId: selectedOperation === 'return' ? form.documentLineId || null : null }}
    sessionStorage.setItem(key(), JSON.stringify(pending.value))
  }
  const scope = generation, storageKey = key(); busy.value = true; error.value = ''
  try {
    await localStock.execute(pending.value.operation, pending.value.command)
    if (scope !== generation) return
    sessionStorage.removeItem(storageKey); pending.value = null; uncertain = false; Object.assign(form, { quantity: '', reason: '', documentId: '', documentLineId: '' }); offset.value = 0; activeTab.value = 'ledger'; emit('changed'); await load()
  } catch(e) {
    if (scope !== generation) return
    error.value = e instanceof Error ? e.message : '结果未知，请使用原请求重查'
    if (!uncertain && e instanceof ApiError && e.status >= 400 && e.status < 500) { sessionStorage.removeItem(storageKey); pending.value = null } else { uncertain = true;logPendingRequest('local-stock', pending.value?.command.requestId) }
  } finally { if (scope === generation) busy.value = false }
}
async function readIssueLines() {
  if (!canReadIssueLines.value || !form.documentId || pending.value || issueLinesLoading.value) return
  const scope = generation, documentId = form.documentId, ticket = ++issueLineAttempt
  issueLinesLoading.value = true;issueLineError.value = '';issueLines.value = [];form.documentLineId = ''
  try {
    const lines = await stockDocuments.materialIssueLines(documentId)
    if (scope !== generation || documentId !== form.documentId || ticket !== issueLineAttempt) return
    issueLines.value = lines.filter(line => line.stockId === stockId.value)
    if (issueLines.value.length === 1) form.documentLineId = issueLines.value[0]!.id
    if (!issueLines.value.length) issueLineError.value = '原单据没有当前库存来源的领料明细'
  } catch(e) { if (scope === generation && documentId === form.documentId && ticket === issueLineAttempt) issueLineError.value = e instanceof Error ? e.message : '领料明细读取失败' } finally { if (scope === generation && documentId === form.documentId && ticket === issueLineAttempt) issueLinesLoading.value = false }
}
watch(() => form.documentId, () => { issueLineAttempt++;issueLines.value = [];form.documentLineId = '';issueLineError.value = '';issueLinesLoading.value = false })
async function beforeClose(done: () => void) {
  if (busy.value) return
  const scope = generation
  if (form.quantity || form.reason || form.documentId || pending.value) { try { await ElMessageBox.confirm(pending.value ? '原请求已保留，下次打开可核实。关闭面板？' : '放弃未提交的库存操作？', '关闭确认') } catch { return } }
  if (scope !== generation) return
  clear(); done()
}
async function openInbound() { if (!inboundPath.value) return;const path = inboundPath.value;await beforeClose(() => { visible.value = false;void router.push({ path, query: {}}) }) }
async function openIssues() {
  await beforeClose(() => {
    visible.value = false
    if (outboundPath.value) void router.push({ path: outboundPath.value, query: { documentType: 'MATERIAL_ISSUE' }})
  })
}
watch(() => [auth.factoryId, auth.revision, granted.value.map(o => o.value).join(','), readable.value], () => { clear(); visible.value = false }, { flush: 'sync' })
onBeforeUnmount(clear)
onDeactivated(() => { visible.value = false; clear() })
const actionLabels: Record<string, string> = {
  OPENING: '期初建账', RECEIPT: '原材料入库', ISSUE: '生产领料', RETURN: '生产退料',
  GAIN: '盘盈', LOSS: '盘亏', CORRECTION: '业务纠错', REVERSAL: '原操作撤销',
  PRODUCT_RECEIPT: '成品入库', PRODUCT_REVERSAL: '成品入库撤回',
  PURCHASE_RECEIPT: '采购入库', PRODUCTION_RECEIPT: '生产入库', OUTSOURCE_RECEIPT: '委外入库',
  MATERIAL_RETURN_RECEIPT: '生产退料入库', REWORK_RECEIPT: '返工入库', SALES_RETURN_RECEIPT: '销售退货入库',
  DEFECT_RECEIPT: '不良品入库', SCRAP_RECEIPT: '报废品入库', OTHER_RECEIPT: '其他入库',
  MATERIAL_ISSUE: '材料领用', OTHER_ISSUE: '其他出库', TRANSFER_RECEIPT: '调拨入库', TRANSFER_ISSUE: '调拨出库'
}
const label = (value: string) => actionLabels[value] ?? value
const operationHints: Record<StockOperation, string> = {
  opening: '仅用于尚无余额、也无库存流水的新库存身份。请填写期初数量和建账依据。',
  gain: '填写盘点后需要增加的数量，并记录实物盘点依据。',
  loss: '填写盘点后需要减少的数量，使用正数，并记录实物盘点依据。',
  correction: '填写有符号的调整量：正数增加，负数减少。请说明纠错依据。',
  return: '仅支持未开工且无后续报工、质量和库存收发事实的原领料；退料不改变产品投产额度。',
  receipt: '正在核实先前保留的原材料入库请求。新入库业务请使用入库单。'
}
const operationHelp = computed(() => {
  if (!operation.value) return '先选择需要办理的库存操作，再填写数量和业务依据。'
  return operationHints[operation.value]
})
const quantityLabel = computed(() => {
  if (!operation.value) return '操作数量'
  return operation.value === 'correction' ? '调整量' : operation.value === 'loss' ? '减少数量' : operation.value === 'return' ? '退料数量' : operation.value === 'opening' ? '期初数量' : '增加数量'
})
function deltaLabel(value: string) {
  const text = formatQuantity(value)
  if (/^[1-9]|^0\.[0-9]*[1-9]/.test(text)) return '+' + text
  return text
}
function changePage({ page }: { page: number }) { offset.value = (page - 1) * 20; void load() }
</script>
<template>
  <PageDrawer v-model="visible" title="库存明细" size="min(1120px, 96vw)" :before-close="beforeClose" @closed="clear">
    <div class="stock-panel-toolbar">
      <span class="secondary">查看当前库存与历史变动</span>
      <el-button :loading="loading" :disabled="busy" @click="load">刷新</el-button>
    </div>
    <el-alert v-if="error && !stock" :title="error" type="error" :closable="false" />
    <el-alert v-if="stockError" :title="'库存余额读取失败：' + stockError" type="error" :closable="false"><el-button link @click="load">重试</el-button></el-alert>
    <section v-if="stock" class="stock-overview" aria-label="库存身份与余额">
      <div class="stock-identity">
        <h3>{{ stock.materialName || '物料名称未返回' }}</h3>
        <dl><div><dt>仓库</dt><dd>{{ stock.warehouseName || '仓库名称未返回' }}</dd></div><div><dt>批次</dt><dd>{{ stock.batchNo || '无批次' }}</dd></div><div><dt>库位</dt><dd>{{ stock.binCode || '无库位' }}</dd></div></dl>
      </div>
      <div class="stock-balances">
        <div><span>实存数量</span><strong><QuantityText :value="stock.quantity" /></strong></div>
        <div><span>可用数量</span><strong><QuantityText :value="stock.availableQuantity" /></strong></div>
        <p>基本单位：{{ unitName || '待确认' }}</p>
      </div>
    </section>
    <p v-else-if="loading" role="status">正在读取库存信息…</p>
    <el-alert v-if="unitError" :title="unitError" type="warning" :closable="false" />
    <el-alert v-if="stock && auth.runtimeMode!=='LOCAL' && !pending" title="当前工厂模式不允许新增本地库存动作；历史流水仍可读取" type="info" :closable="false" />
    <el-alert v-if="stock && stock.warehouseSource !== 'LOCAL'" title="外部镜像或未核实来源仅供参考，不允许新增本地库存动作" type="warning" :closable="false" />
    <el-alert v-if="pending && activeTab !== 'operations'" title="有一笔库存操作的结果待核实" type="warning" :closable="false"><el-button link @click="activeTab = 'operations'">查看待核实操作</el-button></el-alert>
    <el-tabs v-model="activeTab" class="stock-tabs">
      <el-tab-pane label="库存流水" name="ledger">
        <div class="stock-section-heading"><h3>库存变动记录</h3><span class="secondary">每次变动的数量及前后余额</span></div>
        <el-alert v-if="actionsError" :title="'库存流水读取失败：' + actionsError" type="error" :closable="false"><el-button link @click="load">重试</el-button></el-alert>
        <el-alert v-if="!readable" title="当前账号未获库存流水查询权限" type="info" :closable="false" />
        <template v-else>
          <el-table v-loading="loading" :data="rows" :empty-text="actionsError ? '流水未能读取，请重试' : '暂无库存流水；历史余额不会自动补记流水'" :aria-busy="loading">
            <el-table-column label="发生时间" width="180"><template #default="{row}"><DateTimeText :value="row.occurredAt" /></template></el-table-column>
            <el-table-column label="变动类型" min-width="120"><template #default="{row}">{{ label(row.actionType) }}</template></el-table-column>
            <el-table-column label="实存变动" min-width="180"><template #default="{row}"><div class="stock-delta">{{ deltaLabel(row.quantityDelta) }} <small>{{ actionUnitNames[row.unitId] || '单位待确认' }}</small></div><div class="stock-transition"><QuantityText :value="row.quantityBefore" /> → <QuantityText :value="row.quantityAfter" /></div></template></el-table-column>
            <el-table-column label="可用变动" min-width="180"><template #default="{row}"><div class="stock-delta">{{ deltaLabel(row.availableDelta) }} <small>{{ actionUnitNames[row.unitId] || '单位待确认' }}</small></div><div class="stock-transition"><QuantityText :value="row.availableBefore" /> → <QuantityText :value="row.availableAfter" /></div></template></el-table-column>
            <el-table-column prop="reason" label="业务原因" min-width="200" show-overflow-tooltip />
            <el-table-column type="expand" width="48"><template #default="{row}"><dl class="action-details"><dt>业务依据</dt><dd>{{ row.reason || '—' }}</dd><dt>批次</dt><dd>{{ row.batchNo || '无批次' }}</dd><dt>库位</dt><dd>{{ row.binCode || '无库位' }}</dd><dt>关联生产码</dt><dd>{{ row.executionCode || '—' }}</dd><dt>关联原操作</dt><dd>{{ row.referenceActionId ? '本记录为原操作的关联变动' : '无' }}</dd></dl></template></el-table-column>
          </el-table>
          <Pagination :total="total" :page="Math.floor(offset / 20) + 1" :limit="20" layout="total, prev, pager, next" :auto-scroll="false" :disabled="loading" @pagination="changePage" />
        </template>
      </el-tab-pane>
      <el-tab-pane v-if="options.length || inboundPath || outboundPath" label="库存操作" name="operations">
        <div v-if="inboundPath || outboundPath" class="stock-document-links"><span>单据业务</span><el-button v-if="inboundPath" :disabled="busy" @click="openInbound">办理入库单</el-button><el-button v-if="outboundPath" :disabled="busy" @click="openIssues">原领料状态及撤销</el-button></div>
        <section v-if="options.length" class="stock-operation-section" aria-label="库存操作">
          <div class="stock-section-heading"><h3>{{ pending ? '核实上次操作' : '库存调整与退料' }}</h3><span class="secondary">数量使用物料基本单位</span></div>
          <el-alert v-if="error" :title="error" type="error" :closable="false" />
          <template v-if="pending">
            <el-alert title="上次操作结果待确认，请按原请求核实；核实前不能修改内容或新建操作。" type="warning" :closable="false" />
            <dl class="action-details pending-summary"><dt>业务动作</dt><dd>{{ stockOperations.find(item => item.value === pending?.operation)?.label }}</dd><dt>数量</dt><dd><QuantityText :value="pending.command.quantity" /> {{ unitName || '单位待确认' }}</dd><dt>业务依据</dt><dd>{{ pending.command.reason }}</dd></dl>
          </template>
          <el-form v-else class="stock-action-form" label-position="top" :disabled="busy">
            <el-form-item label="业务动作" class="form-span"><el-select v-model="operation" placeholder="请选择库存动作"><el-option v-for="o in options" :key="o.value" :value="o.value" :disabled="o.value === 'opening' && openingUnavailable" :label="o.value === 'opening' && openingUnavailable ? o.label + '（已有余额或流水）' : o.label" /></el-select><p class="stock-operation-help">{{ operationHelp }}</p></el-form-item>
            <el-form-item :label="quantityLabel"><QuantityInput v-model="form.quantity" :material-id="stock?.materialId" :remainder-value="settlementQuantity" show-unit required :disabled="busy || !operation" :placeholder="operation === 'correction' ? '正数增加，负数减少' : '填写本次操作数量'" @validity="quantityValid = $event" /></el-form-item>
            <el-form-item v-if="operation === 'return'" label="原领料单" class="form-span"><el-input v-model="form.documentId" placeholder="统一出库单 ID" /><el-button v-if="canReadIssueLines" :loading="issueLinesLoading" @click="readIssueLines">读取原领料明细</el-button></el-form-item>
            <el-form-item v-if="operation === 'return'" label="原领料明细" class="form-span"><el-select v-if="issueLines.length" v-model="form.documentLineId" placeholder="选择当前库存对应的原明细"><el-option v-for="line in issueLines" :key="line.id" :value="line.id" :label="`第 ${line.lineNo} 行 · 批次 ${line.batchNo ?? '未分批'} · 原领用 ${formatQuantity(line.quantity)}`" /></el-select><el-input v-else v-model="form.documentLineId" placeholder="多行单据需填写明细 ID；单行单据可留空" /><el-alert v-if="issueLineError" :title="issueLineError" type="error" :closable="false" /></el-form-item>
            <el-form-item label="业务依据" class="form-span"><el-input v-model="form.reason" type="textarea" :rows="3" maxlength="500" show-word-limit placeholder="填写盘点、期初或调整的具体依据" /></el-form-item>
          </el-form>
          <div class="stock-submit-bar"><el-button type="primary" :loading="busy" :disabled="!stock || !!stockError || loading || (!operation && !pending)" @click="submit">{{ pending ? '核实上次操作结果' : '确认库存动作' }}</el-button></div>
        </section>
      </el-tab-pane>
    </el-tabs>
  </PageDrawer>
</template>
<style scoped>
.stock-panel-toolbar, .stock-section-heading, .stock-document-links { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 16px; }
.stock-panel-toolbar { justify-content: space-between; margin-bottom: 16px; }
.stock-overview { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(280px, 1fr); gap: 24px; padding: 0 0 20px; border-bottom: 1px solid var(--mes-border); }
.stock-identity h3 { margin: 0 0 16px; font-size: 16px; line-height: 1.6; overflow-wrap: anywhere; }
.stock-identity dl { display: grid; gap: 8px; margin: 0; }
.stock-identity dl > div { display: grid; grid-template-columns: 40px minmax(0, 1fr); gap: 12px; }
.stock-identity dt, .stock-balances > div > span, .stock-balances p { color: var(--mes-text-secondary); font-size: 12px; }
.stock-identity dd { min-width: 0; margin: 0; overflow-wrap: anywhere; }
.stock-balances { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; align-content: center; padding-left: 24px; border-left: 1px solid var(--mes-border); }
.stock-balances > div { display: flex; min-width: 0; flex-direction: column; gap: 8px; }
.stock-balances strong { font-size: 24px; font-weight: 600; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
.stock-balances p { grid-column: 1 / -1; margin: 0; overflow-wrap: anywhere; }
.stock-tabs { margin-top: 16px; }
.stock-section-heading { margin: 8px 0 16px; }
.stock-section-heading h3 { margin: 0; font-size: 14px; font-weight: 600; }
.stock-delta { font-weight: 600; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
.stock-delta small, .stock-transition { color: var(--mes-text-secondary); font-size: 12px; font-weight: 400; }
.stock-transition { margin-top: 4px; }
.stock-document-links { padding: 4px 0 20px; border-bottom: 1px solid var(--mes-border); }
.stock-document-links > span { color: var(--mes-text-secondary); font-size: 12px; }
.stock-operation-section { padding-top: 12px; }
.stock-action-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 16px; }
.stock-action-form :deep(.form-span) { grid-column: 1 / -1; }
.stock-operation-help { margin: 8px 0 0; color: var(--mes-text-secondary); font-size: 12px; line-height: 1.6; }
.stock-submit-bar { display: flex; padding: 16px 0; border-top: 1px solid var(--mes-border); }
.action-details { display: grid; grid-template-columns: 100px minmax(0, 1fr); gap: 8px 16px; margin: 8px 16px; }
.action-details dt { color: var(--mes-text-secondary); }
.action-details dd { min-width: 0; margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.pending-summary { margin: 20px 0; }
@media (max-width: 720px) {
  .stock-overview { grid-template-columns: minmax(0, 1fr); gap: 20px; }
  .stock-balances { padding: 16px 0 0; border-left: 0; border-top: 1px solid var(--mes-border); }
  .stock-action-form { grid-template-columns: minmax(0, 1fr); }
  .stock-action-form :deep(.form-span) { grid-column: auto; }
}
</style>
