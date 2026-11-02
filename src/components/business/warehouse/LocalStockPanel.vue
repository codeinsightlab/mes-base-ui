<script setup lang="ts">
import { usePageMessageBox } from '@/lib/pageMessageBox'

import PageDrawer from '@/components/page/PageDrawer.vue'

import { menuPathForComponent } from '@/lib/menuWorkspaces'
import { computed, onBeforeUnmount, onDeactivated, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useAuth } from '@/stores/auth'
import { ApiError } from '@/lib/request'
import QuantityInput from '@/components/business/material/QuantityInput.vue'
import QuantityText from '@/components/business/production/QuantityText.vue'
import { formatQuantity } from '@/lib/quantity'
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
let generation = 0, attempt = 0, issueLineAttempt = 0, uncertain = false
const key = () => `mes-stock-pending:${auth.username}:${auth.factoryId}:${stockId.value}`
function clear() { issueLines.value = [];issueLineError.value = '';issueLinesLoading.value = false;generation++; attempt++; stock.value = null; rows.value = []; total.value = offset.value = 0; error.value = ''; unitError.value = '';unitName.value = '';actionUnitNames.value = {};operation.value = ''; busy.value = loading.value = false; pending.value = null; quantityValid.value = false; uncertain = false; Object.assign(form, { quantity: '', reason: '', documentId: '', documentLineId: '' }) }
async function load() {
  const scope = generation, ticket = ++attempt; loading.value = true; error.value = ''
  try {
    const [current, actions] = await Promise.all([api.detail(stockId.value), readable.value ? localStock.actions(stockId.value, offset.value) : Promise.resolve({ items: [], total: 0 })])
    if (scope !== generation || ticket !== attempt) return
    stock.value = current; rows.value = actions.items; total.value = actions.total
    unitError.value = ''
    let currentUnitId = ''
    try {
      const factoryId = auth.factoryId
      if (!factoryId) throw new Error('工厂上下文不可用')
      const rule = await loadQuantityRule(current.materialId, factoryId, auth.revision,
        () => factoryId === auth.factoryId && !auth.factorySwitching)
      if (scope !== generation || ticket !== attempt) return
      currentUnitId = rule.unitId ?? ''
      unitName.value = rule.unitName ?? ''
    } catch (reason) {
      if (scope === generation && ticket === attempt) unitError.value = reason instanceof Error ? reason.message : '物料单位读取失败'
    }
    const unitIds = [...new Set(actions.items.map(row => row.unitId))].filter(id => id !== currentUnitId)
    const namedUnits = await Promise.allSettled(unitIds.map(async id => [id, (await unitMeasureApi.detail(id)).name] as const))
    if (scope !== generation || ticket !== attempt) return
    actionUnitNames.value = Object.fromEntries([
      ...(currentUnitId && unitName.value ? [[currentUnitId, unitName.value] as const] : []),
      ...namedUnits.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])
    ])
    if (namedUnits.some(result => result.status === 'rejected') && !unitError.value) unitError.value = '部分历史流水的单位名称未能读取'
  } catch(e) { if (scope === generation && ticket === attempt) error.value = e instanceof Error ? e.message : '库存读取失败' } finally { if (scope === generation && ticket === attempt) loading.value = false }
}
function open(id: string) {
  clear(); stockId.value = id; visible.value = true
  const saved = sessionStorage.getItem(key())
  if (saved) { try { pending.value = JSON.parse(saved); uncertain = true; operation.value = pending.value!.operation } catch { error.value = '原请求无法读取，请核实库存流水后处理'; return } }
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
    if (!quantityValid.value || !directionValid || !form.reason.trim() || selectedOperation === 'return' && !form.documentId) { error.value = '请填写符合物料单位精度及操作方向的数量、业务原因及原领料出库单ID'; return }
    pending.value = { operation: selectedOperation, command: { requestId: crypto.randomUUID(), stockId: stockId.value, quantity, expectedQuantity: stock.value.quantity, expectedAvailable: stock.value.availableQuantity ?? stock.value.quantity, reason: form.reason, documentId: selectedOperation === 'return' ? form.documentId : null, documentLineId: selectedOperation === 'return' ? form.documentLineId || null : null }}
    sessionStorage.setItem(key(), JSON.stringify(pending.value))
  }
  const scope = generation, storageKey = key(); busy.value = true; error.value = ''
  try {
    await localStock.execute(pending.value.operation, pending.value.command)
    if (scope !== generation) return
    sessionStorage.removeItem(storageKey); pending.value = null; uncertain = false; Object.assign(form, { quantity: '', reason: '', documentId: '', documentLineId: '' }); offset.value = 0; emit('changed'); await load()
  } catch(e) {
    if (scope !== generation) return
    error.value = e instanceof Error ? e.message : '结果未知，请使用原请求重查'
    if (!uncertain && e instanceof ApiError && e.status >= 400 && e.status < 500) { sessionStorage.removeItem(storageKey); pending.value = null } else uncertain = true
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
const label = (value: string) => ({ OPENING: '期初建账', RECEIPT: '历史原材料入库', ISSUE: '生产领料', RETURN: '生产退料', GAIN: '盘盈', LOSS: '盘亏', CORRECTION: '业务纠错', REVERSAL: '原操作撤销', PRODUCT_RECEIPT: '历史成品入库', PRODUCT_REVERSAL: '历史成品入库逆向' }[value] ?? value)
</script>
<template>
  <PageDrawer v-model="visible" title="LOCAL 库存业务与流水" size="min(1120px, 96vw)" :before-close="beforeClose" @closed="clear">
    <el-alert v-if="stock && auth.runtimeMode!=='LOCAL' && !pending" title="当前工厂模式不允许新增LOCAL库存动作；历史流水仍可读取" type="info" :closable="false" />
    <el-alert v-if="stock && stock.warehouseSource !== 'LOCAL'" title="外部镜像或未核实来源仅供参考，不允许新增本地库存动作" type="warning" :closable="false" />
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <div v-loading="loading">
      <section v-if="stock" class="stock-summary" aria-label="库存身份与余额">
        <div class="stock-summary-item"><span>物料</span><strong>{{ stock.materialName || '物料名称未返回' }}</strong></div>
        <div class="stock-summary-item"><span>仓库</span><strong>{{ stock.warehouseName || '仓库名称未返回' }}</strong></div>
        <div class="stock-summary-item"><span>批次 / 库位</span><strong>{{ stock.batchNo || '—' }} / {{ stock.binCode || '—' }}</strong></div>
        <div class="stock-summary-item stock-balance"><span>实存 / 可用</span><strong><QuantityText :value="stock.quantity" /> / <QuantityText :value="stock.availableQuantity ?? stock.quantity" /> <small>{{ unitName || '单位待确认' }}</small></strong></div>
        <div class="stock-summary-id"><span>库存身份</span><code>{{ stock.id }}</code></div>
      </section>
      <el-alert v-if="unitError" :title="unitError" type="warning" :closable="false" />
      <el-alert title="数量使用物料基本单位。业务入库统一使用入库单。退料仅支持未开工且无报工、质量和库存收发事实的原领料；退料不改变产品投产额度。整单撤销请到原领料单核实。" type="info" :closable="false" />
      <el-alert v-if="pending" :title="'原请求已冻结：' + pending.command.requestId + '，请使用原请求核实结果'" type="warning" :closable="false" />
      <el-form v-if="options.length" class="stock-action-form" label-position="top" :disabled="busy || !!pending">
        <el-form-item label="业务动作"><el-select v-model="operation" placeholder="请选择库存动作"><el-option v-for="o in options" :key="o.value" :value="o.value" :disabled="o.value === 'opening' && openingUnavailable" :label="o.value === 'opening' && openingUnavailable ? o.label + '（已有余额或流水）' : o.label" /></el-select></el-form-item>
        <el-form-item label="数量增减量"><QuantityInput v-model="form.quantity" :material-id="stock?.materialId" :remainder-value="settlementQuantity" show-unit required :disabled="busy || !!pending" placeholder="盘亏填写正数；业务纠错使用有符号增减量" @validity="quantityValid = $event" /></el-form-item>
        <el-form-item v-if="operation === 'return'" label="原领料单" class="form-span"><el-input v-model="form.documentId" placeholder="统一出库单 ID" /><el-button v-if="canReadIssueLines" :loading="issueLinesLoading" @click="readIssueLines">读取原领料明细</el-button></el-form-item>
        <el-form-item v-if="operation === 'return'" label="原领料明细" class="form-span">
          <el-select v-if="issueLines.length" v-model="form.documentLineId" placeholder="选择当前库存对应的原明细"><el-option v-for="line in issueLines" :key="line.id" :value="line.id" :label="`第 ${line.lineNo} 行 · 批次 ${line.batchNo ?? '未分批'} · 原领用 ${formatQuantity(line.quantity)}`" /></el-select>
          <el-input v-else v-model="form.documentLineId" placeholder="多行单据需填写明细 ID；单行单据可留空" />
          <el-alert v-if="issueLineError" :title="issueLineError" type="error" :closable="false" />
        </el-form-item>
        <el-form-item label="依据 / 凭据" class="form-span"><el-input v-model="form.reason" type="textarea" maxlength="500" placeholder="期初依据、外部凭据或调整原因" /></el-form-item>
      </el-form>
      <div class="stock-panel-actions">
        <el-button v-if="options.length" type="primary" :loading="busy" :disabled="!stock || loading || !operation && !pending" @click="submit">{{ pending ? '核实原请求' : '确认库存动作' }}</el-button>
        <div class="stock-panel-navigation">
          <el-button :disabled="busy" @click="load">刷新余额与流水</el-button>
          <el-button v-if="inboundPath" :disabled="busy" @click="openInbound">办理入库单</el-button>
          <el-button v-if="outboundPath" :disabled="busy" @click="openIssues">原领料状态及撤销</el-button>
        </div>
      </div>
      <el-alert v-if="!readable" title="当前账号未获库存流水查询权限" type="info" :closable="false" />
      <el-table v-if="readable" :data="rows" empty-text="暂无库存动作；历史余额不会自动补记流水">
        <el-table-column label="动作" min-width="120"><template #default="{row}">{{ label(row.actionType) }}</template></el-table-column>
        <el-table-column label="基本单位" min-width="110"><template #default="{row}">{{ actionUnitNames[row.unitId] || '单位待确认' }}</template></el-table-column>
        <el-table-column label="实存变化" min-width="180"><template #default="{row}"><QuantityText :value="row.quantityDelta" /> {{ actionUnitNames[row.unitId] || '单位待确认' }}<div class="secondary"><QuantityText :value="row.quantityBefore" /> → <QuantityText :value="row.quantityAfter" /></div></template></el-table-column>
        <el-table-column label="可用变化" min-width="180"><template #default="{row}"><QuantityText :value="row.availableDelta" /> {{ actionUnitNames[row.unitId] || '单位待确认' }}<div class="secondary"><QuantityText :value="row.availableBefore" /> → <QuantityText :value="row.availableAfter" /></div></template></el-table-column>
        <el-table-column show-overflow-tooltip prop="batchNo" label="批次" min-width="130" /><el-table-column show-overflow-tooltip prop="binCode" label="库位" min-width="100" />
        <el-table-column show-overflow-tooltip prop="sourceId" label="来源单据" min-width="130" /><el-table-column label="业务时间" min-width="180"><template #default="{row}"><DateTimeText :value="row.occurredAt" /></template></el-table-column>
        <el-table-column type="expand" width="48"><template #default="{row}"><dl class="action-details"><dt>业务依据</dt><dd>{{ row.reason }}</dd><dt>操作者</dt><dd>{{ row.operatorUserId }}</dd><dt>请求 UUID</dt><dd><code>{{ row.id }}</code></dd><dt>原动作</dt><dd><code>{{ row.referenceActionId || '—' }}</code></dd></dl></template></el-table-column>
      </el-table>
      <div v-if="readable" class="table-toolbar"><el-button :disabled="offset === 0 || loading" @click="offset -= 20; load()">上一页</el-button><span>{{ offset + 1 }} / {{ total }}</span><el-button :disabled="offset + 20 >= total || loading" @click="offset += 20; load()">下一页</el-button></div>
    </div>
  </PageDrawer>
</template>
<style scoped>
.stock-summary { display: grid; grid-template-columns: minmax(180px, 1.5fr) minmax(160px, 1fr) minmax(180px, 1.2fr) minmax(210px, 1.2fr); gap: 1px; margin-bottom: 12px; overflow: hidden; border: 1px solid var(--mes-border); border-radius: 8px; background: var(--mes-border); }
.stock-summary-item, .stock-summary-id { display: flex; min-width: 0; flex-direction: column; gap: 6px; padding: 12px 14px; background: var(--ui-surface); }
.stock-summary-item > span, .stock-summary-id > span { color: var(--mes-text-secondary); font-size: 12px; }
.stock-summary-item strong { overflow-wrap: anywhere; color: var(--mes-text-primary); font-size: 14px; font-weight: 600; }
.stock-summary-item small { color: var(--mes-text-secondary); font-size: 12px; font-weight: 500; }
.stock-summary-id { grid-column: 1 / -1; flex-direction: row; align-items: center; justify-content: space-between; }
.stock-summary-id code { color: var(--mes-text-secondary); font-family: var(--ui-font-mono); }
.stock-action-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 16px; }
.stock-action-form :deep(.el-form-item) { margin-bottom: 12px; }
.stock-action-form :deep(.form-span) { grid-column: 1 / -1; }
.stock-panel-actions { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin: 4px 0 12px; }
.stock-panel-navigation { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.action-details { display: grid; grid-template-columns: 110px minmax(0, 1fr); gap: 8px 14px; margin: 0; }
.action-details dt { color: var(--mes-text-secondary); }
.action-details dd { min-width: 0; margin: 0; overflow-wrap: anywhere; }
@media (max-width: 720px) {
  .stock-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .stock-summary-id { grid-column: 1 / -1; }
  .stock-action-form { grid-template-columns: minmax(0, 1fr); }
  .stock-action-form :deep(.form-span) { grid-column: auto; }
  .stock-panel-actions { align-items: stretch; }
  .stock-panel-navigation { width: 100%; }
}
</style>
