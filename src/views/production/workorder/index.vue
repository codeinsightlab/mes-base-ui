<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import CodeText from '@/components/CodeText.vue'
import Pagination from '@/components/Pagination/index.vue'
import RoutingGraphPreview from '@/components/business/RoutingGraphPreview.vue'
import { api, type Batch, type Detail, type RoutingOption, type Save } from '@/api/production/workorder'
import { api as materials, type MaterialVo } from '@/api/basic/material'
import type { RoutingDetail } from '@/api/production/routing'
import { nextNodes, completePath, validAllocation } from '@/lib/production/batchPath'
import { useAuth } from '@/stores/auth'
const auth = useAuth()
const can = (action: string) => auth.hasPermission('workorder:' + action, 'factory')
const canSelect = computed(() => auth.hasPermission('batch:selectRoute', 'factory'))
const rows = ref<{ workorder: Detail['workorder']; batchCount: number; productCode: string; productName: string; routingCode: string; routingVersion: number }[]>([]), total = ref(0), page = ref(1), pageSize = ref(20)
const code = ref(''), status = ref(''), loading = ref(false), busy = ref(false), error = ref('')
const dialog = ref(false), drawer = ref(false), detail = ref<Detail | null>(null), editId = ref<string | null>(null)
const productOptions = ref<MaterialVo[]>([]), routeOptions = ref<RoutingOption[]>([]), graph = ref<RoutingDetail | null>(null)
const selectedBatch = ref<Batch | null>(null), nodeIds = ref<string[]>([])
const blank = (): Save => ({ code: '', productId: '', routingId: '', plannedQty: '', plannedStartAt: null, plannedEndAt: null, externalId: null, externalCode: null, remark: null, batches: [{ batchNo: '', plannedQty: '', remark: null }] })
const form = reactive<Save>(blank())
const next = computed(() => graph.value ? nextNodes(graph.value, nodeIds.value) : [])
const complete = computed(() => graph.value && completePath(graph.value, nodeIds.value))
const routeEditable = computed(() => canSelect.value && detail.value?.workorder.status === 'RELEASED' && selectedBatch.value && ['UNSELECTED', 'SELECTED'].includes(selectedBatch.value.routeStatus))
const label: Record<string, string> = { DRAFT: '草稿', RELEASED: '已下达', PLANNED: '待领料', ISSUED: '已确认出库', UNSELECTED: '未选路径', SELECTED: '已选路径', PENDING: '出库处理中', UNKNOWN: '出库待核实', LOCKED: '路径已锁定' }
let listAttempt = 0, detailAttempt = 0, productAttempt = 0, routeAttempt = 0
function clear() {
  listAttempt++; detailAttempt++; productAttempt++; routeAttempt++
  rows.value = []; total.value = 0; detail.value = null; graph.value = null; selectedBatch.value = null; nodeIds.value = []
  productOptions.value = []; routeOptions.value = []; dialog.value = drawer.value = loading.value = busy.value = false
  error.value = ''; page.value = 1; editId.value = null; Object.assign(form, blank())
}
watch(() => [auth.revision, auth.factoryId, can('list'), can('query'), can('update'), canSelect.value], () => { clear(); if (can('list')) void load() }, { flush: 'sync' })
onBeforeUnmount(clear)
async function load() {
  if (!can('list')) return
  const attempt = ++listAttempt, revision = auth.revision
  loading.value = true; error.value = ''
  try {
    const result = await api.list({ code: code.value, status: status.value, offset: (page.value - 1) * pageSize.value, limit: pageSize.value })
    if (attempt !== listAttempt || revision !== auth.revision) return
    rows.value = result.items; total.value = result.total
  } catch(e) { if (attempt === listAttempt && revision === auth.revision) error.value = e instanceof Error ? e.message : '读取失败' } finally { if (attempt === listAttempt && revision === auth.revision) loading.value = false }
}
async function searchProducts(search: string) {
  const attempt = ++productAttempt, revision = auth.revision
  try {
    const result = await materials.list({ name: search, materialType: 'PRODUCT', status: 'ENABLED', limit: 100 })
    if (attempt === productAttempt && revision === auth.revision) productOptions.value = result.items
  } catch(e) { if (attempt === productAttempt && revision === auth.revision) error.value = e instanceof Error ? e.message : '产品读取失败' }
}
async function searchRoutes(search = '') {
  const attempt = ++routeAttempt, revision = auth.revision
  if (!form.productId) { routeOptions.value = []; return }
  try {
    const result = await api.routings(form.productId, search)
    if (attempt === routeAttempt && revision === auth.revision) routeOptions.value = result
  } catch(e) { if (attempt === routeAttempt && revision === auth.revision) error.value = e instanceof Error ? e.message : '工艺版本读取失败' }
}
function productChanged() { form.routingId = ''; void searchRoutes() }
function create() { editId.value = null; Object.assign(form, blank()); error.value = ''; dialog.value = true; void searchProducts('') }
async function open(id: string) {
  const attempt = ++detailAttempt, revision = auth.revision
  drawer.value = true; detail.value = null; graph.value = null; selectedBatch.value = null; busy.value = true; error.value = ''
  try {
    const value = await api.detail(id)
    const g = await api.graph(id)
    if (attempt !== detailAttempt || revision !== auth.revision) return
    detail.value = value; graph.value = g
  } catch(e) { if (attempt === detailAttempt && revision === auth.revision) error.value = e instanceof Error ? e.message : '详情读取失败' } finally { if (attempt === detailAttempt && revision === auth.revision) busy.value = false }
}
async function edit(id: string) {
  const attempt = ++detailAttempt, revision = auth.revision
  busy.value = true; error.value = ''
  try {
    const d = await api.detail(id)
    if (attempt !== detailAttempt || revision !== auth.revision) return
    editId.value = id
    Object.assign(form, d.workorder, { plannedQty: String(d.workorder.plannedQty), batches: d.batches.map(b => ({ id: b.id, batchNo: b.batchNo, plannedQty: String(b.plannedQty), remark: b.remark })) })
    productOptions.value = [{ id: d.workorder.productId, code: d.productCode, name: d.productName } as MaterialVo]
    dialog.value = true; void searchRoutes()
  } catch(e) { if (attempt === detailAttempt && revision === auth.revision) error.value = e instanceof Error ? e.message : '编辑读取失败' } finally { if (attempt === detailAttempt && revision === auth.revision) busy.value = false }
}
async function save() {
  if (!validAllocation(form.plannedQty, form.batches)) { ElMessage.warning('批次计划量必须为正数，合计等于主单计划量，最多六位小数'); return }
  if (!form.code.trim() || !form.productId || !form.routingId || form.batches.some(b => !b.batchNo.trim())) { ElMessage.warning('请填写编号、产品、工艺版本及所有批次号'); return }
  const revision = auth.revision, attempt = ++detailAttempt
  busy.value = true; error.value = ''
  try {
    const value = editId.value ? await api.update(editId.value, form) : await api.create(form)
    if (attempt !== detailAttempt || revision !== auth.revision) return
    dialog.value = false; ElMessage.success('工单与批次已保存'); void load(); await open(value.workorder.id)
  } catch(e) { if (attempt === detailAttempt && revision === auth.revision) error.value = e instanceof Error ? e.message : '保存失败' } finally { if (attempt === detailAttempt && revision === auth.revision) busy.value = false }
}
async function release() {
  if (!detail.value) return
  const row = detail.value.workorder, revision = auth.revision
  try {
    await ElMessageBox.confirm('下达后产品、计划数量与工艺版本将固定，是否继续？', '下达工单')
    if (revision !== auth.revision) return
    busy.value = true; await api.release(row.id, row.revision)
    if (revision !== auth.revision) return
    void load(); await open(row.id)
  } catch(e) { if (revision === auth.revision && e instanceof Error) error.value = e.message } finally { if (revision === auth.revision) busy.value = false }
}
async function remove(row: Detail['workorder']) {
  const revision = auth.revision
  try {
    await ElMessageBox.confirm('删除草稿工单及其批次？', '删除工单')
    if (revision !== auth.revision) return
    busy.value = true; await api.remove(row.id, row.revision)
    if (revision === auth.revision) { drawer.value = false; void load() }
  } catch(e) { if (revision === auth.revision && e instanceof Error) error.value = e.message } finally { if (revision === auth.revision) busy.value = false }
}
function chooseBatch(b: Batch) { selectedBatch.value = b; nodeIds.value = b.path.map(n => n.routingNodeId) }
async function savePath() {
  if (!selectedBatch.value || !routeEditable.value || !complete.value || !detail.value) return
  const revision = auth.revision, attempt = ++detailAttempt, batchId = selectedBatch.value.id
  busy.value = true; error.value = ''
  try {
    const value = await api.selectPath(batchId, selectedBatch.value.revision, nodeIds.value)
    if (attempt !== detailAttempt || revision !== auth.revision) return
    detail.value.batches = detail.value.batches.map(b => b.id === batchId ? value : b); selectedBatch.value = value
    ElMessage.success('路径已选择；实际出库确认成功后锁定')
  } catch(e) { if (attempt === detailAttempt && revision === auth.revision) error.value = e instanceof Error ? e.message : '路径保存失败' } finally { if (attempt === detailAttempt && revision === auth.revision) busy.value = false }
}
onMounted(load)
</script>
<template>
  <div class="page-container workorder-page">
    <PageHeader title="生产工单" description="维护生产计划与执行批次，绑定明确的工艺版本" />
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <div class="panel">
      <div class="filter-panel"><el-input v-model="code" placeholder="工单编号" clearable /><el-select v-model="status" placeholder="状态" clearable><el-option label="草稿" value="DRAFT" /><el-option label="已下达" value="RELEASED" /></el-select><el-button @click="page=1;load()">查询</el-button></div>
      <div class="table-toolbar"><el-button v-if="can('create')" type="primary" :disabled="busy" @click="create">新增工单</el-button><span class="secondary">主单创建时一并维护批次，批次计划量合计等于主单计划量</span></div>
      <el-table v-loading="loading" :data="rows" row-key="workorder.id">
        <el-table-column label="工单编号" min-width="180"><template #default="{row}"><CodeText :value="row.workorder.code" /></template></el-table-column>
        <el-table-column label="计划数量" prop="workorder.plannedQty" min-width="130" />
        <el-table-column label="产品" min-width="200"><template #default="{row}">{{ row.productCode }} · {{ row.productName }}</template></el-table-column>
        <el-table-column label="工艺版本" min-width="160"><template #default="{row}">{{ row.routingCode }} · v{{ row.routingVersion }}</template></el-table-column>
        <el-table-column label="批次数" prop="batchCount" width="90" />
        <el-table-column label="状态" width="110"><template #default="{row}"><StatusTag :label="label[row.workorder.status]" :tone="row.workorder.status==='DRAFT'?'warning':'success'" /></template></el-table-column>
        <el-table-column label="操作" width="190" fixed="right"><template #default="{row}"><el-button v-if="can('query')" link type="primary" @click="open(row.workorder.id)">详情</el-button><el-button v-if="can('update') && row.workorder.status==='DRAFT'" link type="primary" :disabled="busy" @click="edit(row.workorder.id)">编辑</el-button><el-button v-if="can('delete') && row.workorder.status==='DRAFT'" link type="danger" :disabled="busy" @click="remove(row.workorder)">删除</el-button></template></el-table-column>
      </el-table><Pagination v-model:page="page" v-model:limit="pageSize" :total="total" @pagination="load" />
    </div>
    <el-dialog v-model="dialog" :title="editId?'编辑草稿工单':'新增工单与批次'" width="850px" destroy-on-close>
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <el-form label-position="top" class="order-form">
        <el-form-item label="工单编号"><el-input v-model="form.code" maxlength="64" /></el-form-item>
        <el-form-item label="计划数量"><el-input v-model="form.plannedQty" placeholder="正数，最多六位小数" /></el-form-item>
        <el-form-item label="产出产品"><el-select v-model="form.productId" filterable remote :remote-method="searchProducts" placeholder="搜索产品名称" @change="productChanged"><el-option v-for="p in productOptions" :key="p.id" :value="p.id" :label="p.code+' · '+p.name" /></el-select></el-form-item>
        <el-form-item label="适用的已发布工艺版本"><el-select v-model="form.routingId" filterable remote :remote-method="searchRoutes" :disabled="!form.productId" placeholder="先选择产品，再选择工艺版本"><el-option v-for="r in routeOptions" :key="r.id" :value="r.id" :label="r.code+' · '+r.name+' · v'+r.version" /></el-select></el-form-item>
        <el-form-item label="计划开始"><el-date-picker v-model="form.plannedStartAt" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" /></el-form-item>
        <el-form-item label="计划结束"><el-date-picker v-model="form.plannedEndAt" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" /></el-form-item>
        <el-form-item label="外部单据编号（可选）"><el-input v-model="form.externalCode" maxlength="128" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" maxlength="500" /></el-form-item>
      </el-form>
      <div class="table-toolbar"><strong>生产批次</strong><el-button :disabled="form.batches.length>=100" @click="form.batches.push({batchNo:'',plannedQty:'',remark:null})">增加批次</el-button></div>
      <el-table :data="form.batches"><el-table-column label="批次号"><template #default="{row}"><el-input v-model="row.batchNo" maxlength="128" placeholder="可沿用ERP批号" /></template></el-table-column><el-table-column label="计划数量"><template #default="{row}"><el-input v-model="row.plannedQty" /></template></el-table-column><el-table-column label="备注"><template #default="{row}"><el-input v-model="row.remark" maxlength="500" /></template></el-table-column><el-table-column width="80"><template #default="{$index}"><el-button link type="danger" :disabled="form.batches.length===1" @click="form.batches.splice($index,1)">移除</el-button></template></el-table-column></el-table>
      <template #footer><el-button @click="dialog=false">取消</el-button><el-button type="primary" :loading="busy" @click="save">保存工单与批次</el-button></template>
    </el-dialog>
    <el-drawer v-model="drawer" title="工单详情与批次路径" size="min(1100px, 94vw)" destroy-on-close>
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <template v-if="detail">
        <el-descriptions :column="2" border><el-descriptions-item label="工单">{{ detail.workorder.code }}</el-descriptions-item><el-descriptions-item label="状态">{{ label[detail.workorder.status] }}</el-descriptions-item><el-descriptions-item label="产品">{{ detail.productCode }} · {{ detail.productName }}</el-descriptions-item><el-descriptions-item label="工艺版本">{{ detail.routing.code }} · v{{ detail.routing.version }}</el-descriptions-item><el-descriptions-item label="计划数量">{{ detail.workorder.plannedQty }}</el-descriptions-item><el-descriptions-item label="批次合计">{{ detail.batches.length }} 个批次（合计与主单一致）</el-descriptions-item></el-descriptions>
        <div class="table-toolbar"><strong>执行批次</strong><el-button v-if="can('release') && detail.workorder.status==='DRAFT'" type="primary" :loading="busy" @click="release">下达工单</el-button></div>
        <el-table :data="detail.batches" row-key="id"><el-table-column label="批次号" prop="batchNo" min-width="140" /><el-table-column label="计划数量" prop="plannedQty" min-width="120" /><el-table-column label="状态" min-width="160"><template #default="{row}">{{ label[row.routeStatus] }}</template></el-table-column><el-table-column label="锁定时间" prop="lockedAt" min-width="180" /><el-table-column width="100"><template #default="{row}"><el-button link type="primary" :disabled="busy" @click="chooseBatch(row)">查看路径</el-button></template></el-table-column></el-table>
        <RoutingGraphPreview v-if="graph" :nodes="graph.nodes" :edges="graph.edges" :selected-node-ids="nodeIds" />
        <section v-if="selectedBatch" class="path-selection" aria-label="批次路径选择">
          <div class="table-toolbar"><strong>{{ selectedBatch.batchNo }} · {{ label[selectedBatch.routeStatus] }}</strong><el-button v-if="routeEditable" :disabled="busy" @click="nodeIds=[]">重新选择</el-button></div>
          <div class="selected-path"><el-tag v-for="(id,i) in nodeIds" :key="id">{{ i+1 }} · {{ graph?.nodes.find(n=>n.id===id)?.nodeCode }} · {{ graph?.nodes.find(n=>n.id===id)?.operationName }}</el-tag><el-empty v-if="!nodeIds.length" description="尚未选择路径" :image-size="45" /></div>
          <template v-if="routeEditable"><p class="secondary">沿真实连接选择入口到出口的完整路径；领料出库确认成功后自动锁定。</p><div class="path-options"><el-button v-for="n in next" :key="n.id" :disabled="busy" @click="n.id && nodeIds.push(n.id)">{{ n.nodeCode }} · {{ n.operationName }}</el-button></div><el-button type="primary" :disabled="!complete" :loading="busy" @click="savePath">保存完整路径</el-button></template>
          <el-alert v-else :title="detail.workorder.status==='DRAFT'?'先下达工单，才能选择批次路径':'当前路径为只读；出库处理中或待核实的路径不能重选'" type="info" :closable="false" />
        </section>
      </template><el-empty v-else-if="!busy" description="未读取到工单" />
    </el-drawer>
  </div>
</template>
<style scoped>
.filter-panel{display:flex;gap:12px;flex-wrap:wrap}.filter-panel>.el-input,.filter-panel>.el-select{width:220px}.order-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 20px}.order-form .el-select,.order-form .el-date-editor{width:100%}.selected-path,.path-options{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0}.path-selection{margin-top:20px;border-top:1px solid var(--mes-border);padding-top:12px}@media(max-width:700px){.order-form{grid-template-columns:1fr}}
</style>
