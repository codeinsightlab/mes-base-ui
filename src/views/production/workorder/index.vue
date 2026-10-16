<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { routeLocationKey } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import CodeText from '@/components/CodeText.vue'
import Pagination from '@/components/Pagination/index.vue'
import WorkOrderExecutions from '@/components/business/production/WorkOrderExecutions.vue'
import WorkOrderRoutePreview from '@/components/business/production/WorkOrderRoutePreview.vue'
import { api, type BatchHistory, type Detail, type RoutingOption, type Save } from '@/api/production/workorder'
import { api as materials, type MaterialVo } from '@/api/basic/material'
import { useAuth } from '@/stores/auth'
const route = inject(routeLocationKey, undefined)
const auth = useAuth()
const can = (action: string) => auth.hasPermission('workorder:' + action, 'factory')
const canExecutions = computed(() => auth.hasPermission('business:mes:production:execution:list', 'factory'))
const rows = ref<Awaited<ReturnType<typeof api.list>>['items']>([]), total = ref(0), page = ref(1), pageSize = ref(20)
const code = ref(''), status = ref(''), loading = ref(false), busy = ref(false), error = ref('')
const detailColumns = ref(window.innerWidth < 600 ? 1 : 2)
function resizeDetails() { detailColumns.value = window.innerWidth < 600 ? 1 : 2 }
onMounted(() => { resizeDetails(); window.addEventListener('resize', resizeDetails) })
onBeforeUnmount(() => window.removeEventListener('resize', resizeDetails))
const dialog = ref(false), drawer = ref(false), detail = ref<Detail | null>(null), editId = ref<string | null>(null)
const productOptions = ref<MaterialVo[]>([]), routeOptions = ref<RoutingOption[]>([])
const routesLoading = ref(false)
const blank = (): Save => ({ code: '', productId: '', routingId: '', plannedQty: '', plannedStartAt: null, plannedEndAt: null, externalId: null, externalCode: null, remark: null })
const form = reactive<Save>(blank())
const histories = ref<Record<string, BatchHistory>>({}), historyLoading = ref<Record<string, boolean>>({})
let historyAttempt = 0
let listAttempt = 0, detailAttempt = 0, productAttempt = 0, routeAttempt = 0
function clear() {
  historyAttempt++; histories.value = {}; historyLoading.value = {}
  listAttempt++; detailAttempt++; productAttempt++; routeAttempt++
  rows.value = []; total.value = 0; detail.value = null; productOptions.value = []; routeOptions.value = []
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
  try { const result = await api.list({ code: code.value, status: status.value, offset: (page.value - 1) * pageSize.value, limit: pageSize.value }); if (attempt === listAttempt) { rows.value = result.items; total.value = result.total } }
  catch(e) { if (attempt === listAttempt) error.value = e instanceof Error ? e.message : '读取失败' }
  finally { if (attempt === listAttempt) loading.value = false }
}
async function searchProducts(search: string) {
  const attempt = ++productAttempt
  try { const result = await materials.list({ name: search, status: 'ENABLED', limit: 100 }); if (attempt === productAttempt) productOptions.value = result.items }
  catch(e) { if (attempt === productAttempt) error.value = e instanceof Error ? e.message : '物料读取失败' }
}
function resetRouteOptions() { routeAttempt++; routeOptions.value = []; routesLoading.value = false }
watch(dialog, (visible) => { if (!visible) { productAttempt++; resetRouteOptions() } }, { flush: 'sync' })
async function searchRoutes(search = '', selectOnly = false) {
  const attempt = ++routeAttempt, productId = form.productId
  if (!dialog.value || !productId) { routeOptions.value = []; routesLoading.value = false; return }
  routesLoading.value = true
  try {
    const result = await api.routings(productId, search)
    if (attempt !== routeAttempt || productId !== form.productId) return
    routeOptions.value = result
    if (selectOnly && result.length === 1 && !form.routingId) form.routingId = result[0]!.id
  }
  catch(e) { if (attempt === routeAttempt) error.value = e instanceof Error ? e.message : '工艺版本读取失败' }
  finally { if (attempt === routeAttempt) routesLoading.value = false }
}
function productChanged() { form.routingId = ''; resetRouteOptions(); void searchRoutes('', true) }
function create() { resetRouteOptions(); editId.value = null; Object.assign(form, blank()); error.value = ''; dialog.value = true; void searchProducts('') }
async function open(id: string) {
  if (!can('query')) return
  const attempt = ++detailAttempt
  historyAttempt++; histories.value = {}; historyLoading.value = {}
  drawer.value = true; detail.value = null; busy.value = true; error.value = ''
  try { const value = await api.detail(id); if (attempt === detailAttempt) detail.value = value }
  catch(e) { if (attempt === detailAttempt) error.value = e instanceof Error ? e.message : '详情读取失败' }
  finally { if (attempt === detailAttempt) busy.value = false }
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
    editId.value = id; Object.assign(form, d.workorder, { plannedQty: String(d.workorder.plannedQty) })
    productOptions.value = [{ id: d.workorder.productId, code: d.productCode, name: d.productName } as MaterialVo]
    routeOptions.value = [d.routing]; dialog.value = true
  } catch(e) { if (attempt === detailAttempt) error.value = e instanceof Error ? e.message : '读取失败' }
  finally { if (attempt === detailAttempt) busy.value = false }
}
async function save() {
  if (!can(editId.value ? 'update' : 'create') || busy.value) return
  if (!form.code.trim() || !form.productId || !form.routingId || !/^\d{1,14}(\.\d{1,6})?$/.test(form.plannedQty) || !/[1-9]/.test(form.plannedQty)) { error.value = '请填写工单号、产出物料、已发布默认工艺和正计划数量（最多6位小数）'; return }
  const attempt = detailAttempt
  busy.value = true; error.value = ''
  try {
    if (editId.value) await api.update(editId.value, form); else await api.create(form)
    if (attempt !== detailAttempt) return
    dialog.value = false; ElMessage.success('工单已保存，可独立创建生产执行单元'); await load()
  } catch(e) { if (attempt === detailAttempt) error.value = e instanceof Error ? e.message : '保存失败' }
  finally { if (attempt === detailAttempt) busy.value = false }
}
async function release() {
  if (!detail.value || !can('release') || busy.value) return
  const attempt = detailAttempt, row = detail.value.workorder
  busy.value = true
  try { const d = await api.release(row.id, row.revision); if (attempt === detailAttempt) { detail.value = d; await load() } }
  catch(e) { if (attempt === detailAttempt) error.value = e instanceof Error ? e.message : '下达失败' }
  finally { if (attempt === detailAttempt) busy.value = false }
}
async function remove(row: Detail['workorder']) {
  if (!can('delete')) return
  const attempt = detailAttempt
  try { await ElMessageBox.confirm('确认删除工单 ' + row.code + '？存在执行身份或旧批次历史时不能删除。', '删除确认', { type: 'warning' }) } catch { return }
  if (attempt !== detailAttempt || !can('delete')) return
  try { await api.remove(row.id, row.revision); if (attempt === detailAttempt) await load() }
  catch(e) { if (attempt === detailAttempt) error.value = e instanceof Error ? e.message : '删除失败' }
}
async function loadHistory(id: string) {
  if (!auth.hasPermission('batch:query', 'factory') || historyLoading.value[id]) return
  const attempt = historyAttempt
  historyLoading.value[id] = true
  try { const value = await api.batchHistory(id); if (attempt === historyAttempt) histories.value[id] = value }
  catch(e) { if (attempt === historyAttempt) error.value = e instanceof Error ? e.message : '历史路径读取失败' }
  finally { if (attempt === historyAttempt) historyLoading.value[id] = false }
}
function closeHistory() { detailAttempt++; detail.value = null; busy.value = false; historyAttempt++; histories.value = {}; historyLoading.value = {} }
onMounted(load)
</script>
<template>
  <div class="app-container">
    <PageHeader title="生产工单" description="工单记录生产需求；实际工艺与执行身份由生产执行单元确定。" />
    <el-form class="filter-panel" inline @submit.prevent="load">
      <el-form-item label="工单号"><el-input v-model="code" clearable /></el-form-item>
      <el-form-item label="状态"><el-select v-model="status" clearable style="width:140px"><el-option label="草稿" value="DRAFT" /><el-option label="已下达" value="RELEASED" /></el-select></el-form-item>
      <el-button @click="page=1;load()">查询</el-button>
    </el-form>
    <div class="table-toolbar"><el-button v-if="can('create')" type="primary" @click="create">新增工单</el-button><el-button @click="load">刷新</el-button><span class="secondary">执行目标合计含全部状态，不代表完成量</span></div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-table v-loading="loading" :data="rows" row-key="workorder.id">
      <el-table-column label="工单号" min-width="160"><template #default="{row}"><CodeText :value="row.workorder.code" /><el-tag v-if="row.erpExtraMissing" type="warning" size="small" title="该工单扩展记录缺失，详情和修改仍需通过完整性校验">扩展记录缺失</el-tag></template></el-table-column>
      <el-table-column label="产出物料" min-width="180"><template #default="{row}">{{ row.productCode }} · {{ row.productName }}</template></el-table-column>
      <el-table-column label="计划数量" min-width="130"><template #default="{row}">{{ row.workorder.plannedQty }}</template></el-table-column>
      <el-table-column label="默认工艺" min-width="150"><template #default="{row}">{{ row.routingCode }} / V{{ row.routingVersion }}</template></el-table-column>
      <el-table-column label="执行目标合计" min-width="145"><template #default="{row}">{{ row.allocation.allocatedTargetQty }}</template></el-table-column>
      <el-table-column label="尚未分配" min-width="130"><template #default="{row}">{{ row.allocation.remainingTargetQty }}</template></el-table-column>
      <el-table-column label="超额分配" min-width="130"><template #default="{row}">{{ row.allocation.excessTargetQty }}</template></el-table-column>
      <el-table-column label="状态" width="100"><template #default="{row}"><StatusTag :label="row.workorder.status==='DRAFT'?'草稿':'已下达'" :tone="row.workorder.status==='DRAFT'?'disabled':'success'" /></template></el-table-column>
      <el-table-column label="操作" fixed="right" min-width="190"><template #default="{row}">
        <el-button v-if="can('query')" link type="primary" @click="open(row.workorder.id)">详情 / 执行</el-button>
        <el-button v-if="can('update') && can('query') && row.workorder.status==='DRAFT'" link @click="edit(row.workorder.id)">编辑</el-button>
        <el-button v-if="can('delete') && row.workorder.status==='DRAFT'" link type="danger" @click="remove(row.workorder)">删除</el-button>
      </template></el-table-column>
    </el-table>
    <Pagination :total="total" v-model:page="page" v-model:limit="pageSize" @pagination="load" />
    <el-dialog v-model="dialog" :title="editId?'编辑工单':'新增工单'" width="min(760px,94vw)">
      <el-form label-width="110px">
        <el-form-item label="工单号" required><el-input v-model="form.code" maxlength="64" /></el-form-item>
        <el-form-item label="产出物料" required><el-select v-model="form.productId" filterable remote :remote-method="searchProducts" @change="productChanged"><el-option v-for="p in productOptions" :key="p.id" :value="p.id" :label="p.code+' · '+p.name" /></el-select></el-form-item>
        <el-form-item label="计划数量" required><el-input v-model="form.plannedQty" /></el-form-item>
        <el-form-item label="默认工艺" required><el-select v-model="form.routingId" :disabled="!form.productId" :loading="routesLoading" :placeholder="form.productId ? '搜索该物料适用的已发布工艺' : '请先选择产出物料'" no-data-text="该物料暂无匹配的已发布工艺" filterable remote :remote-method="searchRoutes" @visible-change="(v: boolean)=>v && !routesLoading && searchRoutes()"><el-option v-for="r in routeOptions" :key="r.id" :value="r.id" :label="r.code+' / V'+r.version+' · '+r.name" /></el-select></el-form-item>
        <el-form-item label="计划开始"><el-date-picker v-model="form.plannedStartAt" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" /></el-form-item>
        <el-form-item label="计划结束"><el-date-picker v-model="form.plannedEndAt" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" /></el-form-item>
        <el-form-item label="外部标识"><el-input v-model="form.externalId" maxlength="128" /></el-form-item>
        <el-form-item label="外部单号"><el-input v-model="form.externalCode" maxlength="128" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" maxlength="500" /></el-form-item>
      </el-form>
      <p class="secondary">保存工单不要求分批或执行单元；默认工艺仅可选择产出物料适用的已发布版本，不会覆盖已有执行版本。</p>
      <template #footer><el-button @click="dialog=false">取消</el-button><el-button type="primary" :loading="busy" @click="save">保存</el-button></template>
    </el-dialog>
    <el-drawer @close="closeHistory" v-model="drawer" title="工单需求与生产执行" size="min(1680px,96vw)" destroy-on-close>
      <template v-if="detail">
        <el-descriptions :column="detailColumns" border>
          <el-descriptions-item label="工单">{{ detail.workorder.code }}</el-descriptions-item><el-descriptions-item label="产出物料">{{ detail.productCode }} · {{ detail.productName }}</el-descriptions-item>
          <el-descriptions-item label="默认工艺">{{ detail.routing.code }} / V{{ detail.routing.version }}</el-descriptions-item><el-descriptions-item label="计划数量">{{ detail.allocation.plannedQty }}</el-descriptions-item>
          <el-descriptions-item label="执行目标合计">{{ detail.allocation.allocatedTargetQty }}</el-descriptions-item><el-descriptions-item label="尚未分配">{{ detail.allocation.remainingTargetQty }}</el-descriptions-item>
          <el-descriptions-item label="超额分配">{{ detail.allocation.excessTargetQty }}</el-descriptions-item><el-descriptions-item label="执行单元数">{{ detail.allocation.executionCount }}</el-descriptions-item>
        </el-descriptions>
        <div class="table-toolbar"><span class="secondary">执行目标合计含全部状态，不代表实际完成量。</span><el-button v-if="can('release') && detail.workorder.status==='DRAFT'" type="primary" :loading="busy" @click="release">下达工单</el-button></div>
        <WorkOrderRoutePreview :workorder-id="detail.workorder.id" :routing-id="detail.workorder.routingId" />
        <WorkOrderExecutions v-if="canExecutions" :key="detail.workorder.id" :workorder-id="detail.workorder.id" />
        <el-alert v-else title="当前账号没有生产执行列表权限" type="info" :closable="false" />
        <el-collapse v-if="detail.batches.length"><el-collapse-item title="旧批次与已选路径（历史只读）">
          <el-alert title="保留旧模型数据；已确认出库或路径锁定不代表执行已开工，历史路径不参与新执行准入。" type="info" :closable="false" />
          <el-table :data="detail.batches" row-key="id"><el-table-column label="历史批次号" prop="batchNo" min-width="140" /><el-table-column label="历史计划量" prop="plannedQty" min-width="140" /><el-table-column label="旧路径状态" prop="routeStatus" min-width="130" /><el-table-column label="出库锁定时间" prop="lockedAt" min-width="180" /><el-table-column label="历史所选节点" min-width="200"><template #default="{row}"><template v-if="histories[row.id]">{{ histories[row.id]!.path.map(n=>n.routingNodeId).join(' → ') || '无历史所选节点' }}</template><el-button v-else-if="auth.hasPermission('batch:query', 'factory')" link :loading="historyLoading[row.id]" @click="loadHistory(row.id)">读取历史路径</el-button><span v-else>需要历史批次查询权限</span></template></el-table-column></el-table>
        </el-collapse-item></el-collapse>
      </template><el-empty v-else-if="!busy" description="未读取到工单" />
    </el-drawer>
  </div>
</template>
