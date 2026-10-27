<script setup lang="ts">
import { usePageMessageBox } from '@/lib/pageMessageBox'

import PageDialog from '@/components/page/PageDialog.vue'

import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import ScopeTag from '@/components/ScopeTag.vue'
import QueryForm from '@/components/QueryForm.vue'
import Pagination from '@/components/Pagination/index.vue'
import WorkOrderSelect from '@/components/business/production/WorkOrderSelect.vue'
import ExecutionSelect from '@/components/business/production/ExecutionSelect.vue'
import ExecutionIdentityLookup from '@/components/business/production/ExecutionIdentityLookup.vue'
import PersonnelSelect from '@/components/business/directory/PersonnelSelect.vue'
import QuantityText from '@/components/business/production/QuantityText.vue'
import QuantityInput from '@/components/business/material/QuantityInput.vue'
import { normalizedQuantityInput } from '@/lib/production/quantityRules'
import { qualityTreatment } from '@/api/quality/qualityTreatment'
import DefectDeclarationPanel from '@/components/business/quality/DefectDeclarationPanel.vue'
import DefectStatisticsPanel from '@/components/business/quality/DefectStatisticsPanel.vue'
import QualityTreatmentPanel from '@/components/business/quality/QualityTreatmentPanel.vue'
import { productionDefect as api, defectPermissions, factsOf, type Version, type Command } from '@/api/quality/productionDefect'
import { qualityStateLabel, qualityStateTone, qualityReceiptLabel, positiveQuantity } from '@/lib/quality/presentation'
import { parseTime } from '@/utils/ruoyi'
import { useAuth } from '@/stores/auth'
import { ApiError } from '@/lib/request'
const ElMessageBox = usePageMessageBox()

const auth = useAuth(), can = (key:keyof typeof defectPermissions) => auth.hasPermission(defectPermissions[key], 'factory')
const access = computed(() => [can('read'), can('create'), can('revise'), can('void')].join(','))
const rows = ref<Version[]>([]), total = ref(0), page = ref(1), limit = ref(20), loading = ref(false), error = ref('')
const execution = ref(''), workorder = ref<string | null>(null), section = ref('records')
const declarationOpen = ref(false), declarationDirty = ref(false), declarationPending = ref(false)
const historyOpen = ref(false), detailRecord = ref<Version | null>(null), initialAction = ref<'assess' | 'dispose' | undefined>(), treatmentPending = ref(false), treatmentDirty = ref(false)
const history = ref<Version[]>([]), historyPage = ref(1), historyTotal = ref(0), historyError = ref(''), historyLoading = ref(false)
const open = ref(false), mode = ref<'revise' | 'void'>('revise'), selected = ref<Version | null>(null), reason = ref(''), busy = ref(false), formError = ref(''), editBlocked = ref(false)
const form = reactive({ defectQty: '', defectReason: '', responsibleUserId: null as string | null, responsibilityRemark: null as string | null })
const pendingEdit = ref<Command | null>(null)
const editProductId = ref<string | null>(null), editQuantityValid = ref(false), editQuantityLoading = ref(false), editQuantityError = ref('')
const quantityUnchanged = computed(() => !!selected.value && normalizedQuantityInput(form.defectQty) === normalizedQuantityInput(selected.value.defectQty))
let quantityReadTicket = 0
function resetEditQuantity() { quantityReadTicket++; editProductId.value = null; editQuantityValid.value = false; editQuantityLoading.value = false; editQuantityError.value = '' }
let listTicket = 0, historyTicket = 0, editTicket = 0, original = '', uncertain = false
const editKey = () => `mes-quality-edit:${auth.username}:${auth.factoryId}:${selected.value?.declarationId}:${mode.value}`
const snapshot = () => JSON.stringify({ form, reason: reason.value })
function clear() { resetEditQuantity();listTicket++;historyTicket++;editTicket++;rows.value = [];total.value = 0;error.value = '';loading.value = false;declarationOpen.value = false;declarationDirty.value = declarationPending.value = false;historyOpen.value = false;detailRecord.value = null;history.value = [];historyTotal.value = 0;historyError.value = '';historyLoading.value = false;treatmentPending.value = treatmentDirty.value = false;open.value = false;selected.value = null;reason.value = '';pendingEdit.value = null;busy.value = false;formError.value = '';editBlocked.value = false;uncertain = false;Object.assign(form, { defectQty: '', defectReason: '', responsibleUserId: null, responsibilityRemark: null }) }
watch(() => [auth.factoryId, auth.revision, auth.factorySwitching, access.value], () => { clear();execution.value = '';workorder.value = null;page.value = 1;section.value = 'records' }, { flush: 'sync' })
onBeforeUnmount(clear)
async function load() { const ticket = ++listTicket;error.value = '';if (!can('read')) { rows.value = [];total.value = 0;return }loading.value = true;try { const data = await api.page({ ...(execution.value ? { executionId: execution.value } : {}), ...(workorder.value ? { workorderId: workorder.value } : {}), offset: (page.value - 1) * limit.value, limit: limit.value });if (ticket !== listTicket) return;rows.value = data.items;total.value = data.total;if (detailRecord.value) { const fresh = rows.value.find(r => r.declarationId === detailRecord.value?.declarationId);if (fresh)detailRecord.value = fresh } } catch(e) { if (ticket === listTicket) { rows.value = [];total.value = 0;error.value = message(e) } } finally { if (ticket === listTicket)loading.value = false } }
function message(e:unknown) { return e instanceof Error ? e.message : '请求失败，请重试' }
function search() { page.value = 1;void load() }
function resetQuery() { workorder.value = null;execution.value = '';search() }
const active = (row:Version) => ['READY', 'RUNNING'].includes(row.executionStatus ?? '') && ['DRAFT', 'RELEASED'].includes(row.workorderStatus ?? '')
const editable = (row:Version) => row.recordAction !== 'VOID' && ['UNVERIFIED', 'PENDING'].includes(row.processingState) && !positiveQuantity(row.returnedQuantity) && !positiveQuantity(row.transferredQuantity) && active(row)
const actionable = (row:Version) => can('revise') && row.recordAction !== 'VOID' && row.processingState !== 'UNRESOLVED' && active(row) && (row.processingState === 'UNVERIFIED' || positiveQuantity(row.pendingQuantity))
async function loadHistory() { const row = detailRecord.value, ticket = ++historyTicket;if (!row) return;historyError.value = '';history.value = [];historyTotal.value = 0;historyLoading.value = true;try { const result = await api.history(row.declarationId, (historyPage.value - 1) * 20);if (ticket === historyTicket && historyOpen.value) { history.value = result.items;historyTotal.value = result.total } } catch(e) { if (ticket === historyTicket && historyOpen.value)historyError.value = message(e) } finally { if (ticket === historyTicket && historyOpen.value)historyLoading.value = false } }
function showHistory(row:Version, intent?:'assess' | 'dispose') { detailRecord.value = row;initialAction.value = intent;historyPage.value = 1;history.value = [];historyOpen.value = true;void loadHistory() }
async function closeHistory(done?:() => void) { if (treatmentPending.value) { ElMessage.warning('处理结果尚未确认，请先核对原请求');return } if (treatmentDirty.value) { try { await ElMessageBox.confirm('是否放弃尚未提交的处理内容？', '关闭确认') } catch { return } }historyTicket++;historyOpen.value = false;detailRecord.value = null;history.value = [];historyTotal.value = 0;done?.() }
async function onChanged() { await Promise.all([load(), loadHistory()]) }
async function closeDeclaration(done:() => void) { if (declarationDirty.value && !declarationPending.value) { try { await ElMessageBox.confirm('是否放弃未提交的不良申报？', '关闭确认') } catch { return } }declarationOpen.value = false;declarationDirty.value = false;done() }
function begin(next:'revise' | 'void', row:Version) { if (auth.factorySwitching || !can(next)) return;resetEditQuantity();editTicket++;selected.value = row;mode.value = next;reason.value = '';formError.value = '';busy.value = false;editBlocked.value = false;uncertain = false;pendingEdit.value = null;Object.assign(form, { defectQty: row.defectQty, defectReason: row.defectReason, responsibleUserId: row.responsibleUserId, responsibilityRemark: row.responsibilityRemark });open.value = true;try { const saved = sessionStorage.getItem(editKey());if (saved) { const command = JSON.parse(saved) as Command;if (typeof command.requestKey !== 'string' || typeof command.expectedRevision !== 'number') throw new Error('请求不完整');pendingEdit.value = command;reason.value = command.revisionReason ?? '';if (command.facts)Object.assign(form, { defectQty: command.facts.defectQty, defectReason: command.facts.defectReason, responsibleUserId: command.facts.responsibleUserId, responsibilityRemark: command.facts.responsibilityRemark });uncertain = true } } catch { editBlocked.value = true;formError.value = '待确认请求无法读取，请联系管理员核对，避免重复操作。' }original = snapshot();if (next === 'revise' && !pendingEdit.value) void loadEditProduct() }
async function loadEditProduct() {
  const row = selected.value
  if (!row || !open.value || mode.value !== 'revise' || pendingEdit.value || !can('revise') || auth.factorySwitching) return
  const ticket = ++quantityReadTicket, edit = editTicket, factory = auth.factoryId, revision = auth.revision
  const current = () => ticket === quantityReadTicket && edit === editTicket && open.value && mode.value === 'revise' && selected.value?.declarationId === row.declarationId && selected.value?.executionId === row.executionId && factory === auth.factoryId && revision === auth.revision && !auth.factorySwitching && can('revise')
  editProductId.value = null; editQuantityValid.value = false; editQuantityLoading.value = true; editQuantityError.value = ''
  try {
    const data = await qualityTreatment.details(row.declarationId)
    if (!current()) return
    if (data.declarationId !== row.declarationId || data.executionId !== row.executionId || data.revision !== row.revisionNo || typeof data.productId !== 'string' || !data.productId) {
      editQuantityError.value = '不良记录的物料或版本依据不一致，请重新读取记录'
      return
    }
    editProductId.value = data.productId
  } catch(e) { if (current()) editQuantityError.value = message(e) } finally { if (current()) editQuantityLoading.value = false }
}
async function closeDialog(done?:() => void) { if (busy.value) return;if (pendingEdit.value) { formError.value = '请求结果尚未确认，请先核对原请求';return } if (snapshot() !== original) { try { await ElMessageBox.confirm('是否放弃尚未保存的内容？', '关闭确认') } catch { return } }editTicket++;open.value = false;selected.value = null;done?.() }
async function submit() { const row = selected.value;if (!row || busy.value || editBlocked.value || auth.factorySwitching || !can(mode.value)) return;if (!pendingEdit.value) { if (!reason.value.trim()) { formError.value = '请填写操作原因';return } if (mode.value === 'revise' && (!form.defectReason.trim() || (!quantityUnchanged.value && (!editProductId.value || !editQuantityValid.value || !positiveQuantity(normalizedQuantityInput(form.defectQty)))))) { formError.value = '请填写不良原因；修改数量须符合当前物料单位规则';return }pendingEdit.value = { requestKey: crypto.randomUUID(), expectedRevision: row.revisionNo, revisionReason: reason.value.trim(), ...(mode.value === 'revise' ? { facts: { ...factsOf(row), ...form, defectQty: quantityUnchanged.value ? row.defectQty : normalizedQuantityInput(form.defectQty) }} : {}) } } const ticket = editTicket, key = editKey();try { sessionStorage.setItem(key, JSON.stringify(pendingEdit.value)) } catch { formError.value = '无法保存请求，尚未发送，请恢复会话存储后重试';return }busy.value = true;formError.value = '';try { if (mode.value === 'revise') await api.revise(row.declarationId, pendingEdit.value);else await api.void(row.declarationId, pendingEdit.value);sessionStorage.removeItem(key);if (ticket !== editTicket) return;pendingEdit.value = null;uncertain = false;open.value = false;ElMessage.success(mode.value === 'revise' ? '申报已订正' : '申报已作废');await load() } catch(e) { if (ticket !== editTicket) return;formError.value = message(e);if (e instanceof ApiError && e.status >= 400 && e.status < 500 && !uncertain) { sessionStorage.removeItem(key);pendingEdit.value = null } else uncertain = true } finally { if (ticket === editTicket)busy.value = false } }
const versionAction = (value:string) => ({ CREATE: '登记申报', REVISE: '订正申报', VOID: '作废申报' }[value] ?? value)
void load()
</script>
<template>
  <div class="app-container quality-page">
    <PageHeader title="不良品管理" description="记录生产不良、核实申报并办理入仓，追溯每次正式交接。"><ScopeTag kind="FACTORY" :factory-id="auth.factoryId" /><el-button v-if="can('create')" type="primary" @click="declarationOpen=true">登记不良</el-button></PageHeader>
    <el-tabs v-model="section"><el-tab-pane label="不良记录" name="records" /><el-tab-pane label="统计分析" name="statistics" /></el-tabs>
    <template v-if="section==='records'">
      <QueryForm class="filter-panel" inline @submit="search"><el-form-item label="工单"><WorkOrderSelect v-model="workorder" /></el-form-item><el-form-item label="生产执行"><ExecutionSelect v-model="execution" :workorder-id="workorder" /></el-form-item><el-form-item><el-button type="primary" native-type="submit" :disabled="!can('read')" :loading="loading">查询</el-button><el-button :disabled="loading" @click="resetQuery">重置</el-button></el-form-item><ExecutionIdentityLookup selectable @selected="i=>{workorder=i.workorderId;execution=i.executionId;search()}" /></QueryForm>
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <el-table v-loading="loading" :data="rows" row-key="declarationId" class="defect-list" :empty-text="error ? '读取失败，请重新查询' : '暂无不良记录，可点击右上角登记不良'">
        <el-table-column label="批次号 / 工单号" min-width="170"><template #default="{row}"><strong>{{ row.batchNo || '批次未记录' }}</strong><div class="secondary ellipsis" :title="row.workorderCode">{{ row.workorderCode }}</div></template></el-table-column>
        <el-table-column label="产出品号 / 名称" min-width="165"><template #default="{row}"><strong>{{ row.productCode }}</strong><div class="secondary ellipsis" :title="row.productName">{{ row.productName }}</div></template></el-table-column>
        <el-table-column prop="specification" label="规格" min-width="130" show-overflow-tooltip />
        <el-table-column label="不良情况" min-width="155"><template #default="{row}"><span>{{ row.defectTypeNameSnapshot || row.defectReason }}</span><div v-if="row.defectTypeNameSnapshot" class="secondary ellipsis" :title="row.defectReason">{{ row.defectReason }}</div></template></el-table-column>
        <el-table-column label="申报工序" min-width="105"><template #default="{row}">{{ row.affectedNodeName || '工序未返回' }}</template></el-table-column>
        <el-table-column label="数量" min-width="100" align="right"><template #default="{row}"><QuantityText :value="row.defectQty" /><div v-if="positiveQuantity(row.pendingQuantity)&&row.recordAction!=='VOID'" class="secondary">待{{ row.processingState==='UNVERIFIED'?'核实':'入仓' }} <QuantityText :value="row.pendingQuantity" /></div></template></el-table-column>
        <el-table-column label="入仓状态" min-width="120"><template #default="{row}">{{ qualityReceiptLabel(row.receiptState) }}</template></el-table-column>
        <el-table-column label="处理状态" min-width="110"><template #default="{row}"><el-tag :type="qualityStateTone(row.processingState)">{{ qualityStateLabel(row.processingState) }}</el-tag></template></el-table-column>
        <el-table-column label="申报时间" min-width="150"><template #default="{row}">{{ parseTime(row.occurredAt) }}<div class="secondary">{{ row.reportedByName }}</div></template></el-table-column>
        <el-table-column label="操作" width="170" fixed="right"><template #default="{row}"><el-button link type="primary" @click="showHistory(row)">查看</el-button><el-button v-if="actionable(row)" link type="primary" @click="showHistory(row,row.processingState==='UNVERIFIED'?'assess':'dispose')">{{ row.processingState==='UNVERIFIED'?'核实':'入仓' }}</el-button><el-dropdown v-if="editable(row)&&(can('revise')||can('void'))" trigger="click" @command="(command:'revise'|'void')=>begin(command,row)"><el-button link aria-label="更多申报操作">更多</el-button><template #dropdown><el-dropdown-menu><el-dropdown-item v-if="can('revise')" command="revise">订正申报</el-dropdown-item><el-dropdown-item v-if="can('void')" command="void">作废申报</el-dropdown-item></el-dropdown-menu></template></el-dropdown></template></el-table-column>
      </el-table>
      <Pagination v-model:page="page" v-model:limit="limit" :total="total" @pagination="load" />
    </template>
    <DefectStatisticsPanel v-else :execution-id="execution" />
    <PageDialog v-model="declarationOpen" title="登记不良" width="min(650px,96vw)" :before-close="closeDeclaration" destroy-on-close><DefectDeclarationPanel v-if="declarationOpen" :execution-id="execution||undefined" @saved="load" @pending="declarationPending=$event" @dirty="declarationDirty=$event" /></PageDialog>
    <PageDialog v-model="historyOpen" title="不良详情" width="min(960px,96vw)" :before-close="closeHistory" destroy-on-close>
      <QualityTreatmentPanel v-if="historyOpen&&detailRecord" :declaration-id="detailRecord.declarationId" :record="detailRecord" :candidates="rows" :initial-action="initialAction" @changed="onChanged" @pending="treatmentPending=$event" @dirty="treatmentDirty=$event"><template #versions><el-button :loading="historyLoading" @click="loadHistory">重新读取申报版本</el-button><el-alert v-if="historyError" :title="historyError" type="error" /><el-table v-loading="historyLoading" :data="history" row-key="id" :empty-text="historyError ? '申报版本读取失败，请重试' : '暂无版本记录'"><el-table-column prop="revisionNo" label="版本" width="65" /><el-table-column label="操作" width="100"><template #default="{row}">{{ versionAction(row.recordAction) }}</template></el-table-column><el-table-column label="申报数量" width="105"><template #default="{row}"><QuantityText :value="row.defectQty" /></template></el-table-column><el-table-column prop="revisionReason" label="操作原因" min-width="140" /><el-table-column prop="recordedByName" label="操作人" width="100" /><el-table-column label="时间" min-width="160"><template #default="{row}">{{ parseTime(row.recordedAt) }}</template></el-table-column></el-table><Pagination v-model:page="historyPage" :total="historyTotal" :limit="20" @pagination="loadHistory" /></template></QualityTreatmentPanel>
    </PageDialog>
    <PageDialog v-model="open" :title="mode==='revise'?'订正不良申报':'作废不良申报'" width="min(560px,94vw)" :before-close="closeDialog" destroy-on-close>
      <el-alert v-if="formError" :title="formError" type="error" :closable="false" /><el-form label-position="top" :disabled="busy||!!pendingEdit||editBlocked" @submit.prevent="submit"><template v-if="mode==='revise'"><el-form-item label="不良数量" required><QuantityInput v-model="form.defectQty" :material-id="editProductId" :unchanged-value="selected?.defectQty" required positive @validity="editQuantityValid=$event" /><p v-if="editQuantityLoading" class="secondary">正在读取当前物料规则，不修改数量时仍可保存其他信息。</p><el-alert v-if="editQuantityError" :title="editQuantityError" type="error" :closable="false" /><el-button v-if="editQuantityError" link @click="loadEditProduct">重新读取物料依据</el-button></el-form-item><el-form-item label="不良原因" required><el-input v-model="form.defectReason" type="textarea" maxlength="500" /></el-form-item><el-form-item label="责任人"><PersonnelSelect v-model="form.responsibleUserId" /></el-form-item><el-form-item label="责任说明"><el-input v-model="form.responsibilityRemark" maxlength="500" /></el-form-item></template><p v-else>作废后，此申报不再计入有效不良，原操作记录保留。</p><el-form-item label="操作原因" required><el-input v-model="reason" type="textarea" maxlength="500" /></el-form-item></el-form><template #footer><el-button :disabled="busy||!!pendingEdit" @click="closeDialog()">取消</el-button><el-button type="primary" :loading="busy" :disabled="editBlocked" @click="submit">{{ pendingEdit?'核对原请求结果':mode==='revise'?'保存订正':'确认作废' }}</el-button></template>
    </PageDialog>
  </div>
</template>
<style scoped>
.defect-list :deep(.cell){line-height:1.7}.defect-list :deep(.secondary){font-size:12px}.defect-list :deep(.el-dropdown){margin-left:10px}.ellipsis{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.filter-panel :deep(.el-select){width:200px}
</style>
