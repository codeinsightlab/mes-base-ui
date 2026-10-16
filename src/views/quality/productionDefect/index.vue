<script setup lang="ts">
import ExecutionIdentityLookup from '@/components/business/production/ExecutionIdentityLookup.vue'
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import ScopeTag from '@/components/ScopeTag.vue'
import Pagination from '@/components/Pagination/index.vue'
import ExecutionSelect from '@/components/business/production/ExecutionSelect.vue'
import WorkOrderSelect from '@/components/business/production/WorkOrderSelect.vue'
import PersonnelSelect from '@/components/business/directory/PersonnelSelect.vue'
import { productionDefect as api, defectPermissions as perms, factsOf, upstreamNodes, defaultUpstream, type Facts, type Version, type Node, type Warehouse } from '@/api/quality/productionDefect'
import { useAuth } from '@/stores/auth'
const auth = useAuth(), can = (key: keyof typeof perms) => auth.hasPermission(perms[key], 'factory')
const access = computed(() => [can('read'), can('create'), can('revise'), can('void')].join(','))
const rows = ref<Version[]>([]), total = ref(0), page = ref(1), limit = ref(20), loading = ref(false), error = ref('')
const execution = ref(''), workorder = ref<string | null>(null)
const open = ref(false), mode = ref<'create' | 'revise' | 'void'>('create'), selected = ref<Version | null>(null), reason = ref(''), busy = ref(false), formError = ref(''), nodes = ref<Node[]>([]), warehouses = ref<Warehouse[]>([]), requestKey = ref('')
const historyOpen = ref(false), history = ref<Version[]>([]), historyTotal = ref(0), historyPage = ref(1), historyId = ref(''), historyError = ref('')
const empty = (): Facts => ({ executionId: '', affectedNodeId: '', discoveredNodeId: '', responsibleNodeId: null, defectQty: '', wasteCategory: 'PROCESS', defectReason: '', responsibleUserId: null, responsibilityRemark: null, destinationType: 'ROUTING_NODE', targetNodeId: null, targetWarehouseId: null, destinationRemark: null, occurredAt: '' })
const form = reactive<Facts>(empty()), upstream = computed(() => upstreamNodes(nodes.value, form.discoveredNodeId))
let listTicket = 0, dialogTicket = 0, nodeTicket = 0, historyTicket = 0, warehouseTicket = 0, original = ''
const snapshot = () => JSON.stringify({ form: factsOf(form), reason: reason.value })
function clear() { listTicket++; dialogTicket++; nodeTicket++; historyTicket++; warehouseTicket++; rows.value = []; total.value = 0; open.value = false; historyOpen.value = false; history.value = []; historyTotal.value = 0; selected.value = null; nodes.value = []; warehouses.value = []; Object.assign(form, empty()); reason.value = ''; formError.value = ''; error.value = ''; historyError.value = ''; loading.value = false; busy.value = false; requestKey.value = '' }
watch(() => [auth.factoryId, auth.revision, access.value], () => { clear(); execution.value = ''; workorder.value = null; page.value = 1 }, { flush: 'sync' })
onBeforeUnmount(clear)
async function load() {
 const ticket = ++listTicket; rows.value = []; total.value = 0; error.value = ''
 if (!can('read')) return
 loading.value = true
 try { const data = await api.page({ ...(execution.value ? { executionId: execution.value } : {}), ...(workorder.value ? { workorderId: workorder.value } : {}), offset: (page.value - 1) * limit.value, limit: limit.value }); if (ticket === listTicket) { rows.value = data.items; total.value = data.total } }
 catch (e) { if (ticket === listTicket) error.value = message(e) }
 finally { if (ticket === listTicket) loading.value = false }
}
function message(e: unknown) { return e instanceof Error ? e.message : '请求失败，请重试' }
async function loadNodes(id: string) {
 const ticket = ++nodeTicket; nodes.value = []
 if (!id || !can('read')) return
 try { const data = await api.nodes(id); if (ticket === nodeTicket && open.value) nodes.value = data }
 catch(e) { if (ticket === nodeTicket && open.value) formError.value = message(e) }
}
watch(() => form.executionId, (id, before) => { if (!open.value) return; if (mode.value === 'create' && before !== id) { form.affectedNodeId = ''; form.discoveredNodeId = ''; form.responsibleNodeId = null; form.targetNodeId = null }; void loadNodes(id) })
watch(() => [form.discoveredNodeId, form.destinationType], () => { if (mode.value === 'create') form.targetNodeId = form.destinationType === 'ROUTING_NODE' ? defaultUpstream(nodes.value, form.discoveredNodeId) : null; if (form.destinationType === 'ROUTING_NODE') form.targetWarehouseId = null; else form.targetNodeId = null })
async function searchWarehouses(keyword = '') { const ticket = ++warehouseTicket; try { const data = await api.warehouses(keyword); if (ticket === warehouseTicket && open.value) warehouses.value = data } catch(e) { if (ticket === warehouseTicket) formError.value = message(e) } }
async function begin(next: 'create' | 'revise' | 'void', row?: Version) {
 const ticket = ++dialogTicket; selected.value = row ?? null; mode.value = next; reason.value = ''; formError.value = ''; requestKey.value = crypto.randomUUID(); nodes.value = []; warehouses.value = []; open.value = true
 Object.assign(form, row ? factsOf(row) : { ...empty(), executionId: execution.value }); original = snapshot()
 if (form.executionId) await loadNodes(form.executionId)
 if (open.value && ticket === dialogTicket) original = snapshot()
}
async function closeDialog(done?: () => void) {
 if (busy.value) return
 if (snapshot() !== original) { try { await ElMessageBox.confirm('有未保存内容，是否放弃本次编辑？', '关闭确认', { type: 'warning' }) } catch { return } }
 dialogTicket++; nodeTicket++; warehouseTicket++; open.value = false; selected.value = null; nodes.value = []; warehouses.value = []; Object.assign(form, empty()); reason.value = ''; formError.value = ''; done?.()
}
async function submit() {
 if (busy.value || !can(mode.value)) return
 const ticket = dialogTicket, active = selected.value
 if (mode.value !== 'create' && !reason.value.trim()) { formError.value = '请填写订正或作废原因'; return }
 if (mode.value !== 'void' && (!form.executionId || !form.affectedNodeId || !form.discoveredNodeId || !form.defectReason.trim() || !form.occurredAt || !/^(?:0|[1-9]\d{0,13})(?:\.\d{1,6})?$/.test(form.defectQty) || !/[1-9]/.test(form.defectQty))) { formError.value = '请完整填写生产身份、工序、正数数量、原因及发生时间'; return }
 busy.value = true; formError.value = ''
 const body = { requestKey: requestKey.value, ...(mode.value === 'create' ? {} : { expectedRevision: active!.revisionNo, revisionReason: reason.value }), ...(mode.value === 'void' ? {} : { facts: factsOf(form) }) }
 try {
  const result = mode.value === 'create' ? await api.create(body) : mode.value === 'revise' ? await api.revise(active!.declarationId, body) : await api.void(active!.declarationId, body)
  if (ticket !== dialogTicket) return
  ElMessage.success(result.executionMode === 'LOCAL_ONLY' && !result.externalExecuted ? '已保存不良版本，仅本地登记' : '已保存，请核对外部执行状态')
  busy.value = false; original = snapshot(); await closeDialog(); await load()
 } catch(e) { if (ticket === dialogTicket) formError.value = message(e) } finally { if (ticket === dialogTicket) busy.value = false }
}
async function loadHistory() {
 const ticket = ++historyTicket; history.value = []; historyError.value = ''
 try { const data = await api.history(historyId.value, (historyPage.value - 1) * 20); if (ticket === historyTicket && historyOpen.value) { history.value = data.items; historyTotal.value = data.total } } catch(e) { if (ticket === historyTicket) historyError.value = message(e) }
}
function showHistory(row: Version) { historyId.value = row.declarationId; historyPage.value = 1; historyOpen.value = true; void loadHistory() }
function closeHistory() { historyTicket++; historyOpen.value = false; history.value = []; historyTotal.value = 0; historyError.value = '' }
const historyLabels: Record<string, string> = { id: '版本记录编号', declarationId: '申报身份', revisionNo: '版本号', recordAction: '版本动作', revisionReason: '留痕原因', executionId: '执行单元', affectedNodeId: '数量影响节点', discoveredNodeId: '发现节点', responsibleNodeId: '责任节点', responsibleUserId: '责任用户', targetNodeId: '退回工序', targetWarehouseId: '目标仓库', reportedBy: '原始申报人', recordedBy: '本版本录入人', wasteCategory: '工废/料废类别', defectReason: '不良原因', responsibilityRemark: '责任认定说明', destinationType: '去向类型', destinationRemark: '去向说明', defectQty: '不良产品数量', occurredAt: '发生时间', recordedAt: '记录时间', discoveredNodeName: '发现工序名称', affectedNodeName: '影响工序名称', responsibleNodeName: '责任工序名称', targetNodeName: '目标工序名称', targetWarehouseName: '仓库当前名称', responsibleUserName: '责任人当前姓名', reportedByName: '申报人当前姓名', recordedByName: '录入人当前姓名' }
const reference = (name: string | null | undefined, id: string | null) => id ? `${name ? name + ' · ' : ''}#${id}` : '未认定'
const destination = (row: Version) => row.destinationType === 'ROUTING_NODE' ? '退工序 ' + reference(row.targetNodeName, row.targetNodeId) : '退仓库 ' + reference(row.targetWarehouseName, row.targetWarehouseId)
const action = (value: string) => ({ CREATE: '申报', REVISE: '订正', VOID: '已作废' }[value] ?? value)
void load()
</script>
<template>
 <div class="app-container">
  <PageHeader title="不良品管理" description="不良独立申报、完整版本留痕。有效不良扣减影响节点的正常流转产出。"><ScopeTag kind="FACTORY" :factory-id="auth.factoryId" /></PageHeader>
  <el-alert title="有效不良参与下道工序可报工量校验；仅登记去向，不执行返工、仓库库存移动或 ERP 报废。" type="info" :closable="false" />
  <el-form class="filter-panel" inline @submit.prevent="page = 1; load()">
   <ExecutionIdentityLookup selectable @selected="i => { workorder = i.workorderId; execution = i.executionId }" />
   <el-form-item label="工单"><WorkOrderSelect v-model="workorder" /></el-form-item><el-form-item label="执行单元"><ExecutionSelect v-model="execution" :workorder-id="workorder" /></el-form-item>
   <el-form-item><el-button :disabled="!can('read')" @click="page = 1; load()">查询</el-button></el-form-item>
  </el-form>
  <div class="table-toolbar"><el-button v-if="can('create')" type="primary" @click="begin('create')">新增申报</el-button><span class="secondary">列表仅显示每条申报的最新版本，作废记录保留。</span></div>
  <el-alert v-if="error" :title="error" type="error" />
  <el-table v-loading="loading" :data="rows" row-key="declarationId">
   <el-table-column prop="declarationId" label="申报身份" min-width="280" /><el-table-column prop="executionId" label="Execution" width="110" />
   <el-table-column prop="revisionNo" label="版本" width="70" /><el-table-column label="动作" width="85"><template #default="{row}">{{ action(row.recordAction) }}</template></el-table-column>
   <el-table-column label="发现工序" min-width="150"><template #default="{row}">{{ reference(row.discoveredNodeName, row.discoveredNodeId) }}</template></el-table-column><el-table-column label="影响工序" min-width="150"><template #default="{row}">{{ reference(row.affectedNodeName, row.affectedNodeId) }}</template></el-table-column>
   <el-table-column label="类别" width="75"><template #default="{row}">{{ row.wasteCategory === 'PROCESS' ? '工废' : '料废' }}</template></el-table-column><el-table-column prop="defectQty" label="不良数量" min-width="120" />
   <el-table-column prop="defectReason" label="原因" min-width="160" /><el-table-column label="责任人" min-width="150"><template #default="{row}">{{ reference(row.responsibleUserName, row.responsibleUserId) }}</template></el-table-column><el-table-column label="责任工序" min-width="150"><template #default="{row}">{{ reference(row.responsibleNodeName, row.responsibleNodeId) }}</template></el-table-column>
   <el-table-column label="登记去向" min-width="140"><template #default="{row}">{{ destination(row) }}</template></el-table-column><el-table-column prop="occurredAt" label="发生时间" min-width="185" />
   <el-table-column label="操作" fixed="right" width="205"><template #default="{row}"><el-button link @click="showHistory(row)">详情/历史</el-button><el-button v-if="can('revise') && row.recordAction !== 'VOID'" link @click="begin('revise', row)">订正</el-button><el-button v-if="can('void') && row.recordAction !== 'VOID'" link type="danger" @click="begin('void', row)">作废</el-button></template></el-table-column>
  </el-table>
  <Pagination v-model:page="page" v-model:limit="limit" :total="total" @pagination="load" />
  <el-dialog v-model="open" :title="mode === 'create' ? '新增不良申报' : mode === 'revise' ? '管理员留痕订正' : '管理员留痕作废'" width="min(760px, 96vw)" :before-close="closeDialog" destroy-on-close>
   <el-alert v-if="formError" :title="formError" type="error" />
   <el-form label-width="110px" :disabled="busy" @submit.prevent="submit">
    <template v-if="mode !== 'void'">
     <el-form-item label="执行单元" required><ExecutionSelect v-if="mode === 'create'" v-model="form.executionId" /><el-input v-else :model-value="form.executionId" disabled /></el-form-item>
     <el-form-item label="影响节点" required><el-select v-model="form.affectedNodeId" :disabled="mode !== 'create'"><el-option v-for="node in nodes" :key="node.id" :value="node.id" :label="`${node.sequenceNo}. ${node.name} #${node.id}`" /></el-select></el-form-item>
     <el-form-item label="发现节点" required><el-select v-model="form.discoveredNodeId"><el-option v-for="node in nodes" :key="node.id" :value="node.id" :label="`${node.name} #${node.id}`" /></el-select></el-form-item>
     <el-form-item label="不良分类" required><el-select v-model="form.wasteCategory"><el-option label="工废" value="PROCESS" /><el-option label="料废" value="MATERIAL" /></el-select></el-form-item>
     <el-form-item label="不良产品数量" required><el-input v-model="form.defectQty" inputmode="decimal" placeholder="正数，最多6位小数" /></el-form-item>
     <el-form-item label="不良原因" required><el-input v-model="form.defectReason" type="textarea" maxlength="500" /></el-form-item>
     <el-form-item label="责任节点"><el-select v-model="form.responsibleNodeId" clearable><el-option v-for="node in nodes" :key="node.id" :value="node.id" :label="`${node.name} #${node.id}`" /></el-select></el-form-item>
     <el-form-item label="责任人"><PersonnelSelect v-model="form.responsibleUserId" placeholder="未认定可留空" /></el-form-item>
     <el-form-item label="责任说明"><el-input v-model="form.responsibilityRemark" maxlength="500" /></el-form-item>
     <el-form-item label="处置去向" required><el-select v-model="form.destinationType"><el-option label="退指定工序（仅登记）" value="ROUTING_NODE" /><el-option label="退指定仓库（仅登记）" value="WAREHOUSE" /></el-select></el-form-item>
     <el-form-item v-if="form.destinationType === 'ROUTING_NODE'" label="发现节点上游" required><el-select v-model="form.targetNodeId" :placeholder="upstream.length ? '默认上一实际工序' : '首节点无上游，请选择退仓库'"><el-option v-for="node in upstream" :key="node.id" :value="node.id" :label="`${node.name} #${node.id}`" /></el-select></el-form-item>
     <el-form-item v-else label="目标仓库" required><el-select v-model="form.targetWarehouseId" remote filterable :remote-method="searchWarehouses" @visible-change="(v: boolean) => v && searchWarehouses()"><el-option v-for="w in warehouses" :key="w.id" :value="w.id" :label="`${w.code} · ${w.name}`" /></el-select></el-form-item>
     <el-form-item label="去向备注"><el-input v-model="form.destinationRemark" maxlength="500" /></el-form-item>
     <el-form-item label="发生时间" required><el-date-picker v-model="form.occurredAt" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" /></el-form-item>
    </template>
    <el-alert v-else title="将追加作废终止版本，原版本全部保留，有效不良数量贡献归零。" type="warning" :closable="false" />
    <el-form-item v-if="mode !== 'create'" label="留痕原因" required><el-input v-model="reason" type="textarea" maxlength="500" /></el-form-item>
   </el-form>
   <template #footer><el-button :disabled="busy" @click="closeDialog()">取消</el-button><el-button type="primary" :loading="busy" @click="submit">保存版本</el-button></template>
  </el-dialog>
  <el-dialog v-model="historyOpen" title="不良完整版本历史（只读）" width="min(1100px, 96vw)" :before-close="closeHistory" destroy-on-close>
   <el-alert v-if="historyError" :title="historyError" type="error" />
   <el-table :data="history" row-key="id"><el-table-column type="expand"><template #default="{row}"><el-descriptions :column="1" border><el-descriptions-item v-for="(value, key) in row" :key="key" :label="historyLabels[String(key)] ?? String(key)">{{ value ?? '未填写' }}</el-descriptions-item></el-descriptions></template></el-table-column><el-table-column prop="revisionNo" label="版本" width="70" /><el-table-column label="动作" width="90"><template #default="{row}">{{ action(row.recordAction) }}</template></el-table-column><el-table-column prop="defectQty" label="不良数量" /><el-table-column prop="responsibleUserId" label="责任用户" /><el-table-column prop="revisionReason" label="留痕原因" min-width="160" /><el-table-column prop="recordedBy" label="录入人" /><el-table-column prop="recordedAt" label="记录时间" min-width="185" /></el-table>
   <Pagination v-model:page="historyPage" :total="historyTotal" :limit="20" @pagination="loadHistory" />
  </el-dialog>
 </div>
</template>
