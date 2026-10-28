<script setup lang="ts">
import { usePageMessageBox } from '@/lib/pageMessageBox'

import PageDialog from '@/components/page/PageDialog.vue'
import PageDrawer from '@/components/page/PageDrawer.vue'

import QueryForm from '@/components/QueryForm.vue'

import QuantityText from '@/components/business/production/QuantityText.vue'
import QuantityInput from '@/components/business/material/QuantityInput.vue'
import { normalizedQuantityInput, positiveQuantity } from '@/lib/production/quantityRules'
import { quantityColumn } from '@/lib/production/quantity'
import { computed, inject, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { routeLocationKey } from 'vue-router'
import { ElMessage } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import E10SyncPreview from '@/components/business/E10SyncPreview.vue'
import StatusTag from '@/components/StatusTag.vue'
import type { StatusTone } from '@/lib/status'
import CodeText from '@/components/CodeText.vue'
import Pagination from '@/components/Pagination/index.vue'
import { displayQuantity } from './quantity'
import WorkOrderCancellation from '@/components/business/production/WorkOrderCancellation.vue'
import WorkorderMaterialPanel from '@/components/business/production/WorkorderMaterialPanel.vue'
import WorkOrderExecutions from '@/components/business/production/WorkOrderExecutions.vue'
import WorkOrderRoutePreview from '@/components/business/production/WorkOrderRoutePreview.vue'
import { api, type BatchHistory, type Detail, type NumberingRuleOption, type RoutingOption, type Save } from '@/api/production/workorder'
import { api as materials, type MaterialVo } from '@/api/basic/material'
import { useAuth } from '@/stores/auth'
const ElMessageBox = usePageMessageBox()

const route = inject(routeLocationKey, undefined)
const auth = useAuth()
const can = (action: string) => auth.hasPermission('workorder:' + action, 'factory')
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
const productOptions = ref<MaterialVo[]>([]), routeOptions = ref<RoutingOption[]>([])
const numberingRules = ref<NumberingRuleOption[]>([]), numberingRulesLoading = ref(false)
const routesLoading = ref(false)
const originalProductId = ref('')
const originalPlannedQty = ref('')
const plannedQuantityValid = ref(false)
const blank = (): Save => ({ ruleCode: '', productId: '', routingId: '', plannedQty: '', plannedStartAt: null, plannedEndAt: null, externalId: null, externalCode: null, remark: null })
const form = reactive<Save>(blank())
const histories = ref<Record<string, BatchHistory>>({}), historyLoading = ref<Record<string, boolean>>({})
let historyAttempt = 0
let listAttempt = 0, detailAttempt = 0, productAttempt = 0, routeAttempt = 0, numberingAttempt = 0
function clear() {
  historyAttempt++; histories.value = {}; historyLoading.value = {}
  listAttempt++; detailAttempt++; productAttempt++; routeAttempt++; numberingAttempt++
  rows.value = []; total.value = 0; detail.value = null; productOptions.value = []; routeOptions.value = []; numberingRules.value = []; numberingRulesLoading.value = false
  dialog.value = drawer.value = loading.value = busy.value = false; error.value = ''; page.value = 1; editId.value = null; Object.assign(form, blank())
}
watch(() => [auth.revision, auth.factoryId, can('list'), can('query'), can('update'), can('create'), auth.hasPermission('batch:query', 'factory'), canExecutions.value], () => { clear(); if (can('list')) void load() }, { flush: 'sync' })
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
async function searchProducts(search: string) {
  const attempt = ++productAttempt
  try { const result = await materials.list({ name: search, status: 'ENABLED', limit: 100 }); if (attempt === productAttempt) productOptions.value = result.items } catch(e) { if (attempt === productAttempt) error.value = e instanceof Error ? e.message : '物料读取失败' }
}
function resetRouteOptions() { routeAttempt++; routeOptions.value = []; routesLoading.value = false }
watch(dialog, (visible) => { if (!visible) { productAttempt++; numberingAttempt++; numberingRulesLoading.value = false; resetRouteOptions() } }, { flush: 'sync' })
async function searchRoutes(search = '', selectOnly = false) {
  const attempt = ++routeAttempt, productId = form.productId
  if (!dialog.value || !productId) { routeOptions.value = []; routesLoading.value = false; return }
  routesLoading.value = true
  try {
    const result = await api.routings(productId, search)
    if (attempt !== routeAttempt || productId !== form.productId) return
    routeOptions.value = result
    if (selectOnly && result.length === 1 && !form.routingId) form.routingId = result[0]!.id
  } catch(e) { if (attempt === routeAttempt) error.value = e instanceof Error ? e.message : '工艺版本读取失败' } finally { if (attempt === routeAttempt) routesLoading.value = false }
}
function productChanged() { form.routingId = ''; resetRouteOptions(); void searchRoutes('', true) }
async function create() {
  resetRouteOptions(); editId.value = null; plannedQuantityValid.value = false; Object.assign(form, blank()); error.value = ''; numberingRules.value = []; dialog.value = true; void searchProducts('')
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
  historyAttempt++; histories.value = {}; historyLoading.value = {}
  drawer.value = true; detail.value = null; busy.value = true; error.value = ''
  try { const value = await api.detail(id); if (attempt === detailAttempt) detail.value = value } catch(e) { if (attempt === detailAttempt) error.value = e instanceof Error ? e.message : '详情读取失败' } finally { if (attempt === detailAttempt) busy.value = false }
}
watch(() => [route?.query.workorderId, auth.factoryId, auth.revision, can('query')], () => {
  const id = route?.query.workorderId
  if (typeof id === 'string' && /^[1-9][0-9]{0,18}$/.test(id) && auth.factoryId && can('query')) void open(id)
}, { immediate: true })
async function edit(id: string) {
  if (!can('update') || !can('query')) return
  resetRouteOptions(); productAttempt++
  const attempt = ++detailAttempt
  busy.value = true; error.value = ''
  try {
    const d = await api.detail(id)
    if (attempt !== detailAttempt) return
    originalProductId.value = d.workorder.productId; originalPlannedQty.value = String(d.workorder.plannedQty); editId.value = id; plannedQuantityValid.value = false; Object.assign(form, d.workorder, { plannedQty: String(d.workorder.plannedQty) })
    productOptions.value = [{ id: d.workorder.productId, code: d.productCode, name: d.productName } as MaterialVo]
    routeOptions.value = [d.routing]; dialog.value = true
  } catch(e) { if (attempt === detailAttempt) error.value = e instanceof Error ? e.message : '读取失败' } finally { if (attempt === detailAttempt) busy.value = false }
}
async function save() {
  if (!can(editId.value ? 'update' : 'create') || busy.value) return
  if (!editId.value && (!form.ruleCode || !numberingRules.value.some(rule => rule.ruleCode === form.ruleCode))) { error.value = '请选择有效的工单编码规则'; return }
  if (!form.productId || !form.routingId || !plannedQuantityValid.value || !positiveQuantity(normalizedQuantityInput(form.plannedQty))) { error.value = '请填写产出物料、已发布默认工艺和符合单位精度的正计划数量'; return }
  const attempt = detailAttempt
  busy.value = true; error.value = ''
  try {
    const command = { ...form, plannedQty: normalizedQuantityInput(form.plannedQty) }
    if (editId.value) await api.update(editId.value, command); else await api.create(command)
    if (attempt !== detailAttempt) return
    dialog.value = false; ElMessage.success('工单已保存，可独立创建生产执行单元'); await load()
  } catch(e) { if (attempt === detailAttempt) error.value = e instanceof Error ? e.message : '保存失败' } finally { if (attempt === detailAttempt) busy.value = false }
}
async function release() {
  if (!detail.value || !can('release') || busy.value) return
  const attempt = detailAttempt, row = detail.value.workorder
  busy.value = true
  try { const d = await api.release(row.id, row.revision); if (attempt === detailAttempt) { detail.value = d; await load() } } catch(e) { if (attempt === detailAttempt) error.value = e instanceof Error ? e.message : '下达失败' } finally { if (attempt === detailAttempt) busy.value = false }
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
async function loadHistory(id: string) {
  if (!auth.hasPermission('batch:query', 'factory') || historyLoading.value[id]) return
  const attempt = historyAttempt
  historyLoading.value[id] = true
  try { const value = await api.batchHistory(id); if (attempt === historyAttempt) histories.value[id] = value } catch(e) { if (attempt === historyAttempt) error.value = e instanceof Error ? e.message : '历史路径读取失败' } finally { if (attempt === historyAttempt) historyLoading.value[id] = false }
}
function closeHistory() { detailAttempt++; detail.value = null; busy.value = false; historyAttempt++; histories.value = {}; historyLoading.value = {} }
onMounted(load)
</script>
<template>
  <div class="app-container">
    <PageHeader title="生产工单" description="工单记录生产需求；实际工艺与执行身份由生产执行单元确定。" />
    <QueryForm class="filter-panel" inline @submit="page=1;load()">
      <el-form-item label="工单号"><el-input v-model="code" clearable /></el-form-item>
      <el-form-item label="状态"><el-select v-model="status" clearable style="width:140px"><el-option v-for="(state, value) in orderStates" :key="value" :label="state.label" :value="value" /></el-select></el-form-item>
      <el-button native-type="submit">查询</el-button>
    </QueryForm>
    <div class="table-toolbar"><E10SyncPreview kind="workorder" permission="workorder:sync" @completed="load" /><el-button v-if="can('create') && auth.runtimeMode === 'LOCAL'" type="primary" @click="create">新增工单</el-button><el-button @click="load">刷新</el-button><span class="secondary">未分配执行数量＝计划数量－有效执行目标合计，不代表未完成量；数量最多显示两位小数，悬停查看精确值</span></div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-table v-loading="loading" :data="rows" row-key="workorder.id">
      <el-table-column label="工单号" width="160"><template #default="{row}"><CodeText :value="row.workorder.code" /><el-tag v-if="row.erpExtraMissing" type="warning" size="small" title="该工单扩展记录缺失，详情和修改仍需通过完整性校验">扩展记录缺失</el-tag></template></el-table-column>
      <el-table-column label="产出物料" min-width="280"><template #default="{row}">{{ row.productCode }} · {{ row.productName }}</template></el-table-column>
      <el-table-column label="来源" width="90"><template #default="{row}">{{ row.workorder.source==='LOCAL'?'本地':row.workorder.source==='EXTERNAL'?'外部ERP':'历史待核实' }}</template></el-table-column>
      <el-table-column label="计划数量" width="105" align="right"><template #default="{row}"><span class="workorder-quantity" :title="String(row.workorder.plannedQty)">{{ displayQuantity(row.workorder.plannedQty) }}</span></template></el-table-column>
      <el-table-column label="默认工艺" min-width="320"><template #default="{row}">{{ row.routingCode }} / V{{ row.routingVersion }}</template></el-table-column>
      <el-table-column label="执行目标合计" width="120" align="right"><template #default="{row}"><span class="workorder-quantity" :title="String(row.allocation.allocatedTargetQty)">{{ displayQuantity(row.allocation.allocatedTargetQty) }}</span></template></el-table-column>
      <el-table-column label="未分配执行数量" width="135" align="right"><template #default="{row}"><span class="workorder-quantity" :title="String(row.allocation.remainingTargetQty)">{{ displayQuantity(row.allocation.remainingTargetQty) }}</span></template></el-table-column>
      <el-table-column label="状态" width="100"><template #default="{row}"><StatusTag v-bind="orderState(row.workorder.status)" /></template></el-table-column>
      <el-table-column label="创建时间" width="190" show-overflow-tooltip><template #default="{row}">{{ row.workorder.createTime || '—' }}</template></el-table-column>
      <el-table-column label="操作" fixed="right" width="280"><template #default="{row}">
        <WorkOrderCancellation :order="row.workorder" @changed="load" />
        <el-button v-if="can('query')" link type="primary" @click="open(row.workorder.id)">详情 / 执行</el-button>
        <el-button v-if="can('update') && can('query') && row.workorder.status==='DRAFT' && row.workorder.source==='LOCAL' && auth.runtimeMode==='LOCAL'" link @click="edit(row.workorder.id)">编辑</el-button>
        <el-button v-if="can('release') && row.workorder.status==='RELEASED' && row.workorder.source==='LOCAL' && auth.runtimeMode==='LOCAL'" link :disabled="busy" @click="recall(row.workorder)">退回草稿</el-button>
        <el-button v-if="can('delete') && row.workorder.source==='LOCAL' && auth.runtimeMode==='LOCAL'" link type="danger" @click="remove(row.workorder)">删除</el-button>
      </template></el-table-column>
    </el-table>
    <Pagination :total="total" v-model:page="page" v-model:limit="pageSize" @pagination="load" />
    <PageDialog v-model="dialog" :title="editId?'编辑工单':'新增工单'" width="min(760px,94vw)">
      <el-form label-width="110px">
        <el-form-item v-if="!editId" label="工单编码规则" required><el-select v-model="form.ruleCode" :loading="numberingRulesLoading" :disabled="busy" placeholder="选择工单编码规则"><el-option v-for="rule in numberingRules" :key="rule.ruleCode" :value="rule.ruleCode" :label="`${rule.ruleName}（${rule.ruleCode}）`" /></el-select><span class="help-block">单号由服务端按所选规则生成。</span></el-form-item>
        <el-form-item v-else label="工单号"><span>{{ form.code }}</span></el-form-item>
        <el-form-item label="产出物料" required><el-select v-model="form.productId" filterable remote :remote-method="searchProducts" @change="productChanged"><el-option v-for="p in productOptions" :key="p.id" :value="p.id" :label="p.code+' · '+p.name" /></el-select></el-form-item>
        <el-form-item label="计划数量" required><QuantityInput required positive :unchanged-value="editId && form.productId === originalProductId ? originalPlannedQty : null" v-model="form.plannedQty" :material-id="form.productId" :disabled="busy" @validity="plannedQuantityValid = $event" /></el-form-item>
        <el-form-item label="默认工艺" required><el-select v-model="form.routingId" :disabled="!form.productId" :loading="routesLoading" :placeholder="form.productId ? '搜索该物料适用的已发布工艺' : '请先选择产出物料'" no-data-text="该物料暂无匹配的已发布工艺" filterable remote :remote-method="searchRoutes" @visible-change="(v: boolean)=>v && !routesLoading && searchRoutes()"><el-option v-for="r in routeOptions" :key="r.id" :value="r.id" :label="r.code+' / V'+r.version+' · '+r.name" /></el-select></el-form-item>
        <el-form-item label="计划开始"><el-date-picker v-model="form.plannedStartAt" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" /></el-form-item>
        <el-form-item label="计划结束"><el-date-picker v-model="form.plannedEndAt" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" /></el-form-item>
        <el-form-item label="外部标识"><el-input v-model="form.externalId" maxlength="128" readonly /></el-form-item>
        <el-form-item label="外部单号"><el-input v-model="form.externalCode" maxlength="128" readonly /></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" maxlength="500" /></el-form-item>
      </el-form>
      <p class="secondary">仅草稿工单允许编辑。已下达工单需先退回草稿；存在下游记录时不能退回或删除。计划数量不能低于已分配的执行目标数量。</p>
      <template #footer><el-button @click="dialog=false">取消</el-button><el-button type="primary" :loading="busy" @click="save">保存</el-button></template>
    </PageDialog>
    <PageDrawer @close="closeHistory" v-model="drawer" title="工单需求与生产执行" size="min(1680px,96vw)" destroy-on-close>
      <template v-if="detail">
        <WorkOrderCancellation history :order="detail.workorder" @changed="load();open(detail.workorder.id)" />
        <el-descriptions :column="detailColumns" border>
          <el-descriptions-item label="来源">{{ detail.workorder.source || '历史待核实：禁止新交易' }}</el-descriptions-item><el-descriptions-item label="工单">{{ detail.workorder.code }}</el-descriptions-item><el-descriptions-item label="产出物料">{{ detail.productCode }} · {{ detail.productName }}</el-descriptions-item>
          <el-descriptions-item label="默认工艺">{{ detail.routing.code }} / V{{ detail.routing.version }}</el-descriptions-item><el-descriptions-item label="计划数量"><QuantityText :value="detail.allocation.plannedQty" /></el-descriptions-item>
          <el-descriptions-item label="执行目标合计"><QuantityText :value="detail.allocation.allocatedTargetQty" /></el-descriptions-item><el-descriptions-item label="未分配执行数量"><QuantityText :value="detail.allocation.remainingTargetQty" /></el-descriptions-item>
          <el-descriptions-item label="执行单元数">{{ detail.allocation.executionCount }}</el-descriptions-item>
        </el-descriptions>
        <div class="table-toolbar"><span class="secondary">未分配执行数量＝计划数量－有效执行目标合计，不代表未完成量。</span><el-button v-if="can('release') && detail.workorder.status==='DRAFT' && detail.workorder.source==='LOCAL' && auth.runtimeMode==='LOCAL'" type="primary" :loading="busy" @click="release">下达工单</el-button></div>
        <WorkorderMaterialPanel :readonly="!['DRAFT','RELEASED'].includes(detail.workorder.status)" v-if="detail.workorder.status!=='CANCELLED' && detail.workorder.source==='LOCAL' && auth.runtimeMode==='LOCAL'" :key="detail.workorder.id" :workorder-id="detail.workorder.id" :product-id="detail.workorder.productId" />
        <WorkOrderRoutePreview :workorder-id="detail.workorder.id" :product-id="detail.workorder.productId" :routing-id="detail.workorder.routingId" />
        <WorkOrderExecutions v-if="canExecutions" :key="detail.workorder.id" :workorder-id="detail.workorder.id" :product-id="detail.workorder.productId" />
        <el-alert v-else title="当前账号没有生产执行列表权限" type="info" :closable="false" />
        <el-collapse v-if="detail.batches.length"><el-collapse-item title="旧批次与已选路径（历史只读）">
          <el-alert title="保留旧模型数据；已确认出库或路径锁定不代表执行已开工，历史路径不参与新执行准入。" type="info" :closable="false" />
          <el-table :data="detail.batches" row-key="id"><el-table-column label="历史批次号" prop="batchNo" min-width="140" /><el-table-column :formatter="quantityColumn" label="历史计划量" prop="plannedQty" min-width="140" /><el-table-column label="旧路径状态" prop="routeStatus" min-width="130" /><el-table-column label="出库锁定时间" prop="lockedAt" min-width="180" /><el-table-column label="历史所选节点" min-width="200"><template #default="{row}"><template v-if="histories[row.id]">{{ histories[row.id]!.path.map(n=>n.routingNodeId).join(' → ') || '无历史所选节点' }}</template><el-button v-else-if="auth.hasPermission('batch:query', 'factory')" link :loading="historyLoading[row.id]" @click="loadHistory(row.id)">读取历史路径</el-button><span v-else>需要历史批次查询权限</span></template></el-table-column></el-table>
        </el-collapse-item></el-collapse>
      </template><el-empty v-else-if="!busy" description="未读取到工单" />
    </PageDrawer>
  </div>
</template>

<style scoped>
.workorder-quantity { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-variant-numeric: tabular-nums; }
</style>
