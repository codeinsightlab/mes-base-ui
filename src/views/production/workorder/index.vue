<script setup lang="ts">
import { usePageMessageBox } from '@/lib/pageMessageBox'

import PageDialog from '@/components/page/PageDialog.vue'
import PageDrawer from '@/components/page/PageDrawer.vue'

import QueryForm from '@/components/QueryForm.vue'

import QuantityText from '@/components/business/production/QuantityText.vue'
import QuantityInput from '@/components/business/material/QuantityInput.vue'
import { normalizedQuantityInput, positiveQuantity } from '@/lib/production/quantityRules'
import { computed, inject, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { routeLocationKey } from 'vue-router'
import { ElMessage } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import E10SyncPreview from '@/components/business/E10SyncPreview.vue'
import StatusTag from '@/components/StatusTag.vue'
import type { StatusTone } from '@/lib/status'
import CodeText from '@/components/CodeText.vue'
import Pagination from '@/components/Pagination/index.vue'
import { businessSourceLabel } from '@/lib/businessSource'
import { formatQuantity } from '@/lib/quantity'
import WorkorderCombinationPrint from '@/components/business/production/WorkorderCombinationPrint.vue'
import WorkOrderCancellation from '@/components/business/production/WorkOrderCancellation.vue'
import WorkorderMaterialPanel from '@/components/business/production/WorkorderMaterialPanel.vue'
import WorkorderMaterialEditor from '@/components/business/production/WorkorderMaterialEditor.vue'
import SearchSelect from '@/components/SearchSelect.vue'
import { useRemoteOptions } from '@/composables/useRemoteOptions'
import MaterialSelect from '@/components/business/MaterialSelect.vue'
import { emptyMaterialDemand, materialDemandDraft, workorderMaterial } from '@/api/production/workorderMaterial'
import WorkOrderExecutions from '@/components/business/production/WorkOrderExecutions.vue'
import WorkOrderRoutePreview from '@/components/business/production/WorkOrderRoutePreview.vue'
import WorkOrderBomBuildDialog from '@/components/business/production/WorkOrderBomBuildDialog.vue'
import { api, type Detail, type NumberingRuleOption, type RoutingOption, type Save } from '@/api/production/workorder'
import { inputPermission } from '@/api/production/productionInput'
import { useAuth } from '@/stores/auth'
const ElMessageBox = usePageMessageBox()

const route = inject(routeLocationKey, undefined)
const auth = useAuth()
const can = (action: string) => auth.hasPermission('workorder:' + action, 'factory')
function canMore(row: Detail['workorder']) {
  return row.source === 'LOCAL' && (auth.hasPermission(inputPermission, 'factory')
    || auth.runtimeMode === 'LOCAL' && (can('delete') || can('release') && row.status === 'RELEASED'))
}
const orderStates: Record<string, { label: string; tone: StatusTone }> = {
  DRAFT: { label: '草稿', tone: 'disabled' },
  COMPLETED: { label: '已完工', tone: 'success' },
  RELEASED: { label: '已下达', tone: 'running' },
  CANCELLED: { label: '已作废', tone: 'error' }
}
const orderState = (value: string) => orderStates[value] ?? { label: value || '未知状态', tone: 'warning' as const }
const canExecutions = computed(() => auth.hasPermission('business:mes:production:execution:list', 'factory'))
const rows = ref<Awaited<ReturnType<typeof api.list>>['items']>([]), total = ref(0), page = ref(1), pageSize = ref(20)
const code = ref(''), status = ref(''), loading = ref(false), busy = ref(false), error = ref('')
const detailColumns = ref(window.innerWidth < 600 ? 1 : 2)
function resizeDetails() { detailColumns.value = window.innerWidth < 600 ? 1 : 2 }
onMounted(() => { resizeDetails(); window.addEventListener('resize', resizeDetails) })
onBeforeUnmount(() => window.removeEventListener('resize', resizeDetails))
const dialog = ref(false), drawer = ref(false), detail = ref<Detail | null>(null), editId = ref<string | null>(null)
const bomBuildDialog = ref(false)
const routeSnapshot = ref<RoutingOption | null>(null)
const numberingRules = ref<NumberingRuleOption[]>([]), numberingRulesLoading = ref(false)
const hasPublishedRoutes = ref<boolean | null>(null)
const originalProductId = ref('')
const originalPlannedQty = ref('')
const plannedQuantityValid = ref(false)
const blank = (): Save => ({ ruleCode: '', productId: '', routingId: '', plannedQty: '', plannedStartAt: null, plannedEndAt: null, externalId: null, externalCode: null, remark: null, material: emptyMaterialDemand() })
const form = reactive<Save>(blank())
const materialEditor = ref<InstanceType<typeof WorkorderMaterialEditor> | null>(null)
const confirmingSave = ref(false)
let listAttempt = 0, detailAttempt = 0, routeAttempt = 0, numberingAttempt = 0
function clear() {
  listAttempt++; detailAttempt++; routeAttempt++; numberingAttempt++
  rows.value = []; total.value = 0; detail.value = null; routeSearch.reset(); routeSnapshot.value = null; numberingRules.value = []; numberingRulesLoading.value = false
  dialog.value = drawer.value = loading.value = busy.value = false; error.value = ''; page.value = 1; editId.value = null; Object.assign(form, blank())
}
watch(() => [auth.revision, auth.factoryId, can('list'), can('query'), can('update'), can('create'), canExecutions.value], () => { clear(); if (can('list')) void load() }, { flush: 'sync' })
function refreshAfterIssueVoid(event: Event) {
  if (!(event instanceof CustomEvent) || event.detail?.factoryId !== auth.factoryId) return
  if (can('list')) void load()
  if (drawer.value && detail.value?.workorder.id === event.detail.workorderId && can('query')) void open(event.detail.workorderId)
}
onMounted(() => window.addEventListener('mes:workorder-changed', refreshAfterIssueVoid))
onBeforeUnmount(() => { window.removeEventListener('mes:workorder-changed', refreshAfterIssueVoid); clear() })
async function load() {
  if (!can('list')) return
  const attempt = ++listAttempt
  loading.value = true; error.value = ''
  try { const result = await api.list({ code: code.value, status: status.value, offset: (page.value - 1) * pageSize.value, limit: pageSize.value }); if (attempt === listAttempt) { rows.value = result.items; total.value = result.total } } catch(e) { if (attempt === listAttempt) error.value = e instanceof Error ? e.message : '读取失败' } finally { if (attempt === listAttempt) loading.value = false }
}
function resetRouteOptions() { hasPublishedRoutes.value = null; routeAttempt++; routeSearch.reset(); routeSnapshot.value = null }
watch(dialog, (visible) => { if (!visible) { numberingAttempt++; numberingRulesLoading.value = false; resetRouteOptions() } }, { flush: 'sync' })
let selectSingleRoute = false
const routeSearch = useRemoteOptions<RoutingOption>({
  modelValue: () => form.routingId,
  enabled: () => dialog.value && !!form.productId && !!auth.factoryId && !auth.factorySwitching && (can('create') || can('update')),
  // Product changes own the initial query; opening the control reuses that result.
  disabled: () => false,
  search: async({ keyword }) => {
    const attempt = ++routeAttempt, productId = form.productId, selectOnly = selectSingleRoute
    selectSingleRoute = false
    const result = await api.routings(productId, keyword)
    if (attempt === routeAttempt && productId === form.productId && dialog.value) {
      if (!keyword) hasPublishedRoutes.value = result.length > 0
      if (selectOnly && result.length === 1 && !form.routingId) { routeSnapshot.value = result[0]!; form.routingId = result[0]!.id }
    }
    return { items: result.map(row => ({ value: row.id, label: `${row.code} / V${row.version} · ${row.name}`, data: row })), total: result.length, nextOffset: result.length }
  }
})
const routeOptions = computed(() => routeSearch.items.value.map(option => option.data!))
const routesLoading = routeSearch.loading
const selectedRoute = computed(() => {
  if (routeSearch.selected.value) return routeSearch.selected.value
  const row = routeOptions.value.find(option => option.id === form.routingId) ?? routeSnapshot.value
  if (!row || row.id !== form.routingId) return null
  return { value: row.id, label: `${row.code} / V${row.version} · ${row.name}` }
})
async function searchRoutes(search = '', selectOnly = false) {
  selectSingleRoute = selectOnly
  await routeSearch.search(search)
}
async function productChanged(value: string) {
  if (value === form.productId) return
  const current = detailAttempt
  if (materialEditor.value && !await materialEditor.value.confirmReset()) return
  if (current !== detailAttempt || !dialog.value) return
  const materialRevision = form.material.expectedRevision
  form.productId = value; form.routingId = ''; form.material = { ...emptyMaterialDemand(), expectedRevision: materialRevision, adjustmentsConfirmed: true }
  resetRouteOptions(); void searchRoutes('', true)
}
async function create() {
  resetRouteOptions(); editId.value = null; plannedQuantityValid.value = false; Object.assign(form, blank()); error.value = ''; numberingRules.value = []; dialog.value = true
  const attempt = ++numberingAttempt, factory = auth.factoryId, revision = auth.revision
  if (!factory || !can('create')) return
  numberingRulesLoading.value = true
  try {
    const result = await api.numberingRules()
    if (attempt !== numberingAttempt || factory !== auth.factoryId || revision !== auth.revision) return
    numberingRules.value = result
  } catch(e) { if (attempt === numberingAttempt) error.value = e instanceof Error ? e.message : '工单编码规则读取失败' } finally { if (attempt === numberingAttempt) numberingRulesLoading.value = false }
}
async function open(id: string) {
  if (!can('query')) return
  const attempt = ++detailAttempt
  drawer.value = true; detail.value = null; busy.value = true; error.value = ''
  try { const value = await api.detail(id); if (attempt === detailAttempt) detail.value = value } catch(e) { if (attempt === detailAttempt) error.value = e instanceof Error ? e.message : '详情读取失败' } finally { if (attempt === detailAttempt) busy.value = false }
}
watch(() => [route?.query.workorderId, auth.factoryId, auth.revision, can('query')], () => {
  const id = route?.query.workorderId
  if (typeof id === 'string' && /^[1-9][0-9]{0,18}$/.test(id) && auth.factoryId && can('query')) void open(id)
}, { immediate: true })
async function edit(id: string) {
  if (!can('update') || !can('query') || !can('material:update')) return
  resetRouteOptions()
  const attempt = ++detailAttempt
  busy.value = true; error.value = ''
  try {
    const [d, demand] = await Promise.all([api.detail(id), workorderMaterial.get(id)])
    if (attempt !== detailAttempt) return
    originalProductId.value = d.workorder.productId; originalPlannedQty.value = String(d.workorder.plannedQty); editId.value = id; plannedQuantityValid.value = false; Object.assign(form, d.workorder, { plannedQty: String(d.workorder.plannedQty), material: materialDemandDraft(demand) })
    routeSnapshot.value = d.routing; hasPublishedRoutes.value = d.routing !== null; dialog.value = true
  } catch(e) { if (attempt === detailAttempt) error.value = e instanceof Error ? e.message : '读取失败' } finally { if (attempt === detailAttempt) busy.value = false }
}
async function save() {
  if (!can(editId.value ? 'update' : 'create') || busy.value || confirmingSave.value) return
  if (!editId.value && (!form.ruleCode || !numberingRules.value.some(rule => rule.ruleCode === form.ruleCode))) { error.value = '请选择有效的工单编码规则'; return }
  if (!form.productId || hasPublishedRoutes.value === null || (hasPublishedRoutes.value && !form.routingId) || !plannedQuantityValid.value || !positiveQuantity(normalizedQuantityInput(form.plannedQty))) { error.value = '请核对产出物料及适用工艺，填写符合单位精度的正计划数量'; return }
  const attempt = detailAttempt
  confirmingSave.value = true
  let valid: boolean
  try { valid = !!materialEditor.value && await materialEditor.value.validateAndConfirm() } finally { confirmingSave.value = false }
  if (!valid) return
  if (attempt !== detailAttempt || !dialog.value || !can(editId.value ? 'update' : 'create')) return
  busy.value = true; error.value = ''
  try {
    const command = { ...form, plannedQty: normalizedQuantityInput(form.plannedQty) }
    if (editId.value) await api.update(editId.value, command); else await api.create(command)
    if (attempt !== detailAttempt) return
    dialog.value = false; ElMessage.success('工单已保存'); await load()
  } catch(e) { if (attempt === detailAttempt) error.value = e instanceof Error ? e.message : '保存失败' } finally { if (attempt === detailAttempt) busy.value = false }
}
async function release(row: Detail['workorder']) {
  if (!can('release') || busy.value || row.status !== 'DRAFT' || row.source !== 'LOCAL' || auth.runtimeMode !== 'LOCAL') return
  const attempt = detailAttempt
  busy.value = true; error.value = ''
  try { const d = await api.release(row.id, row.revision); if (attempt === detailAttempt) { if (detail.value?.workorder.id === row.id) detail.value = d; ElMessage.success('工单已下达'); await load() } } catch(e) { if (attempt === detailAttempt) error.value = e instanceof Error ? e.message : '下达失败' } finally { if (attempt === detailAttempt) busy.value = false }
}
async function recall(row: Detail['workorder']) {
  if (!can('release') || busy.value) return
  const attempt = detailAttempt
  try { await ElMessageBox.confirm('确认将工单 ' + row.code + ' 退回草稿？存在下游记录时不能退回。', '退回草稿', { type: 'warning' }) } catch { return }
  if (attempt !== detailAttempt || !can('release')) return
  busy.value = true; error.value = ''
  try {
    const result = await api.recall(row.id, row.revision)
    if (attempt !== detailAttempt) return
    if (detail.value?.workorder.id === row.id) detail.value = result
    ElMessage.success('工单已退回草稿'); await load()
  } catch(e) { if (attempt === detailAttempt) error.value = e instanceof Error ? e.message : '退回失败' } finally { if (attempt === detailAttempt) busy.value = false }
}
async function remove(row: Detail['workorder']) {
  if (!can('delete')) return
  const attempt = detailAttempt
  try { await ElMessageBox.confirm('确认删除工单 ' + row.code + '？存在执行、领料、仓储单据或其他下游记录时不能删除。', '删除确认', { type: 'warning' }) } catch { return }
  if (attempt !== detailAttempt || !can('delete')) return
  try { await api.remove(row.id, row.revision); if (attempt === detailAttempt) await load() } catch(e) { if (attempt === detailAttempt) error.value = e instanceof Error ? e.message : '删除失败' }
}
function closeDetail() { detailAttempt++; detail.value = null; busy.value = false }
onMounted(load)
</script>
<template>
  <div class="app-container">
    <PageHeader title="生产工单" />
    <QueryForm class="filter-panel" inline @submit="page=1;load()">
      <el-form-item label="工单号"><el-input v-model="code" clearable /></el-form-item>
      <el-form-item label="状态"><el-select v-model="status" clearable style="width:140px"><el-option v-for="(state, value) in orderStates" :key="value" :label="state.label" :value="value" /></el-select></el-form-item>
      <el-button native-type="submit">查询</el-button>
    </QueryForm>
    <div class="table-toolbar"><E10SyncPreview kind="workorder" permission="workorder:sync" @completed="load" /><el-button v-if="can('create') && auth.runtimeMode === 'LOCAL'" @click="bomBuildDialog=true">BOM展阶创建工单</el-button><el-button v-if="can('create') && auth.runtimeMode === 'LOCAL'" type="primary" @click="create">新增工单</el-button><el-button @click="load">刷新</el-button></div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-table v-loading="loading" :data="rows" row-key="workorder.id">
      <el-table-column label="工单号" width="160"><template #default="{row}"><CodeText :value="row.workorder.code" /><el-tag v-if="row.erpExtraMissing" type="warning" size="small" title="该工单扩展记录缺失，详情和修改仍需通过完整性校验">扩展记录缺失</el-tag></template></el-table-column>
      <el-table-column label="产出物料" min-width="280"><template #default="{row}">{{ row.productCode }} · {{ row.productName }}</template></el-table-column>
      <el-table-column label="来源" width="90"><template #default="{row}">{{ businessSourceLabel(row.workorder.source) }}</template></el-table-column>
      <el-table-column label="计划数量" width="105" align="right"><template #default="{row}"><span class="workorder-quantity" :title="String(row.workorder.plannedQty)">{{ formatQuantity(row.workorder.plannedQty) }}</span></template></el-table-column>
      <el-table-column label="默认工艺" min-width="220" show-overflow-tooltip><template #default="{row}">{{ row.workorder.routingId ? row.routingCode + ' / V' + row.routingVersion : '无工艺，直接入库' }}</template></el-table-column>
      <el-table-column label="执行目标合计" width="120" align="right"><template #default="{row}"><span class="workorder-quantity" :title="String(row.allocation.allocatedTargetQty)">{{ formatQuantity(row.allocation.allocatedTargetQty) }}</span></template></el-table-column>
      <el-table-column label="未分配执行数量" width="145" align="right"><template #header><el-tooltip content="未分配执行数量＝计划数量－有效执行目标合计，不代表未完成量。"><span>未分配执行数量 ⓘ</span></el-tooltip></template><template #default="{row}"><span class="workorder-quantity" :title="String(row.allocation.remainingTargetQty)">{{ formatQuantity(row.allocation.remainingTargetQty) }}</span></template></el-table-column>
      <el-table-column label="状态" width="100"><template #default="{row}"><StatusTag v-bind="orderState(row.workorder.status)" /></template></el-table-column>
      <el-table-column label="创建时间" width="190" show-overflow-tooltip><template #default="{row}">{{ row.workorder.createTime || '—' }}</template></el-table-column>
      <el-table-column label="操作" fixed="right" width="300"><template #default="{row}">
        <div class="workorder-actions">
          <el-button v-if="can('query')" link type="primary" @click="open(row.workorder.id)">详情 / 执行</el-button>
          <el-button v-if="can('release') && row.workorder.status==='DRAFT' && row.workorder.source==='LOCAL' && auth.runtimeMode==='LOCAL'" link type="primary" :disabled="busy" @click="release(row.workorder)">下达工单</el-button>
          <el-button v-if="can('update') && can('query') && can('material:update') && row.workorder.status==='DRAFT' && row.workorder.source==='LOCAL' && auth.runtimeMode==='LOCAL'" link @click="edit(row.workorder.id)">编辑</el-button>
          <WorkorderCombinationPrint :order="row.workorder"><template #trigger="{ open: openPrint }">
            <el-dropdown v-if="canMore(row.workorder)" trigger="click">
              <el-button link aria-label="更多工单操作">更多 ▾</el-button>
              <template #dropdown><el-dropdown-menu>
                <el-dropdown-item v-if="auth.hasPermission(inputPermission, 'factory') && row.workorder.source==='LOCAL'" @click="openPrint">材料组合码</el-dropdown-item>
                <el-dropdown-item v-if="can('release') && row.workorder.status==='RELEASED' && row.workorder.source==='LOCAL' && auth.runtimeMode==='LOCAL'" :disabled="busy" @click="recall(row.workorder)">退回草稿</el-dropdown-item>
                <el-dropdown-item v-if="can('delete') && row.workorder.source==='LOCAL' && auth.runtimeMode==='LOCAL'" divided @click="remove(row.workorder)"><span class="danger-text">删除工单</span></el-dropdown-item>
              </el-dropdown-menu></template>
            </el-dropdown>
          </template></WorkorderCombinationPrint>
        </div>
      </template></el-table-column>
    </el-table>
    <Pagination v-model:page="page" v-model:limit="pageSize" :total="total" @pagination="load" />
    <WorkOrderBomBuildDialog v-model="bomBuildDialog" @completed="load" />
    <PageDialog v-model="dialog" :title="editId?'编辑工单':'新增工单'" width="min(1220px,96vw)">
      <el-form label-width="110px">
        <el-form-item v-if="!editId" label="工单编码规则" required><el-select v-model="form.ruleCode" :loading="numberingRulesLoading" :disabled="busy" placeholder="选择工单编码规则"><el-option v-for="rule in numberingRules" :key="rule.ruleCode" :value="rule.ruleCode" :label="`${rule.ruleName}（${rule.ruleCode}）`" /></el-select><span class="help-block">单号由服务端按所选规则生成。</span></el-form-item>
        <el-form-item v-else label="工单号"><span>{{ form.code }}</span></el-form-item>
        <el-form-item label="产出物料" required><MaterialSelect :model-value="form.productId || null" status="ENABLED" @update:model-value="productChanged($event || '')" /></el-form-item>
        <el-form-item label="计划数量" required><QuantityInput v-model="form.plannedQty" required positive :unchanged-value="editId && form.productId === originalProductId ? originalPlannedQty : null" :material-id="form.productId" :disabled="busy" @validity="plannedQuantityValid = $event" /></el-form-item>
        <el-form-item label="默认工艺" :required="hasPublishedRoutes !== false"><SearchSelect v-model="form.routingId" :disabled="!form.productId" :options="routeSearch.items.value" :selected-option="selectedRoute" :loading="routesLoading" :error="routeSearch.error.value" :placeholder="form.productId ? '搜索该物料适用的已发布工艺' : '请先选择产出物料'" @search="routeSearch.scheduleSearch" @open="routeSearch.open" @retry="routeSearch.retry" /></el-form-item>
        <p v-if="hasPublishedRoutes === false" class="help-block">当前产品无已发布适用工艺，领料后直接办理成品入库，无需报工。</p>
        <el-form-item label="计划开始"><el-date-picker v-model="form.plannedStartAt" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" /></el-form-item>
        <el-form-item label="计划结束"><el-date-picker v-model="form.plannedEndAt" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" /></el-form-item>
        <el-form-item label="外部标识"><el-input v-model="form.externalId" maxlength="128" readonly /></el-form-item>
        <el-form-item label="外部单号"><el-input v-model="form.externalCode" maxlength="128" readonly /></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" maxlength="500" /></el-form-item>
      </el-form>
      <WorkorderMaterialEditor v-if="dialog" ref="materialEditor" v-model="form.material" :product-id="form.productId" :planned-qty="form.plannedQty" :disabled="busy" />
      <p class="secondary">仅草稿工单允许编辑。已下达工单需先退回草稿；存在下游记录时不能退回或删除。计划数量不能低于已分配的执行目标数量。</p>
      <template #footer><el-button @click="dialog=false">取消</el-button><el-button type="primary" :loading="busy" @click="save">保存</el-button></template>
    </PageDialog>
    <PageDrawer v-model="drawer" title="工单需求与生产执行" size="min(1680px,96vw)" destroy-on-close @close="closeDetail">
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <template v-if="detail">
        <div v-loading="busy" class="workorder-detail">
          <WorkOrderCancellation history readonly :order="detail.workorder" />
          <section class="panel detail-section">
            <div class="detail-heading"><h3>{{ detail.workorder.code }}</h3><StatusTag v-bind="orderState(detail.workorder.status)" /></div>
            <el-descriptions :column="detailColumns" border>
              <el-descriptions-item label="来源">{{ businessSourceLabel(detail.workorder.source) }}</el-descriptions-item><el-descriptions-item label="工单">{{ detail.workorder.code }}</el-descriptions-item><el-descriptions-item label="产出物料">{{ detail.productCode }} · {{ detail.productName }}</el-descriptions-item>
              <el-descriptions-item label="默认工艺">{{ detail.routing ? detail.routing.code + ' / V' + detail.routing.version : '无工艺，直接入库' }}</el-descriptions-item><el-descriptions-item label="计划数量"><QuantityText :value="detail.allocation.plannedQty" /></el-descriptions-item>
              <el-descriptions-item v-if="detail.workorder.bomBuildId" label="创建方式">BOM展阶创建 · {{ detail.workorder.bomBuildParentWorkorderId ? '子件工单' : '顶层工单' }}<el-button v-if="detail.workorder.bomBuildParentWorkorderId && can('query')" link type="primary" @click="open(detail.workorder.bomBuildParentWorkorderId)">查看父工单</el-button></el-descriptions-item>
              <el-descriptions-item label="执行目标合计"><QuantityText :value="detail.allocation.allocatedTargetQty" /></el-descriptions-item><el-descriptions-item label="未分配执行数量"><QuantityText :value="detail.allocation.remainingTargetQty" /></el-descriptions-item>
              <el-descriptions-item label="执行单元数">{{ detail.allocation.executionCount }}</el-descriptions-item>
            </el-descriptions>
            <p class="secondary">未分配执行数量＝计划数量－有效执行目标合计，不代表未完成量。</p>
          </section>
          <WorkorderMaterialPanel v-if="detail.workorder.status!=='CANCELLED' && detail.workorder.source==='LOCAL' && auth.runtimeMode==='LOCAL'" :key="detail.workorder.id" :planned-qty="String(detail.workorder.plannedQty)" :product-code="detail.productCode" :product-name="detail.productName" :readonly="!['DRAFT','RELEASED'].includes(detail.workorder.status)" :workorder-id="detail.workorder.id" :product-id="detail.workorder.productId" @changed="load();open(detail.workorder.id)" />
          <section v-if="detail.routing" class="panel detail-section"><WorkOrderRoutePreview :workorder-id="detail.workorder.id" :product-id="detail.workorder.productId" :routing-id="detail.routing.id" /></section>
          <section class="panel detail-section"><WorkOrderExecutions v-if="canExecutions" :key="detail.workorder.id" :workorder-id="detail.workorder.id" :product-id="detail.workorder.productId" />
            <el-alert v-else title="当前账号没有生产执行列表权限" type="info" :closable="false" /></section>
        </div>
      </template><el-empty v-else-if="!busy" description="未读取到工单" />
    </PageDrawer>
  </div>
</template>

<style scoped>
.workorder-actions { display: flex; align-items: center; gap: var(--ui-space-3); white-space: nowrap; }
.workorder-actions :deep(.el-button + .el-button) { margin-left: 0; }
.danger-text { color: var(--mes-status-danger); }
.workorder-detail { display: flex; flex-direction: column; gap: var(--ui-space-6); }
.detail-section { padding: var(--ui-space-5); }
.detail-heading { display: flex; align-items: center; justify-content: space-between; gap: var(--ui-space-3); margin-bottom: var(--ui-space-4); }
.detail-heading h3 { margin: 0; }
.workorder-quantity { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-variant-numeric: tabular-nums; }
</style>
