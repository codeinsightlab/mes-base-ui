<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useAuth } from '@/stores/auth'
import { ApiError } from '@/lib/request'
import { qualityTreatment as api, type Treatment, type Command, type Action, type Attribution } from '@/api/quality/qualityTreatment'
import type { Version } from '@/api/quality/productionDefect'
const props = defineProps<{ declarationId: string; candidates: Version[] }>()
const emit = defineEmits<{ changed: []; pending: [value: boolean] }>()
const current = computed(() => props.candidates.find(d => d.declarationId === props.declarationId))
const auth = useAuth(), allowed = computed(() => auth.hasPermission('business:quality:defect:read', 'factory')), writable = computed(() => auth.hasPermission('business:quality:defect:revise', 'factory') && current.value?.recordAction !== 'VOID')
const view = ref<Treatment | null>(null), error = ref(''), loading = ref(false), busy = ref(false), pending = ref<Command | null>(null)
const action = ref<Action>('ASSESS'), attribution = ref<Attribution>('INDEPENDENT'), related = ref<string | null>(null), basis = ref('')
const form = reactive({ parentId: null as string | null, scrapQty: '', reworkQty: '', processedQty: '', recoveredQty: '', failedQty: '', reason: '', occurredAt: '' })
watch(() => !!pending.value || busy.value, value => emit('pending', value), { flush: 'sync' })
let generation = 0, queryAttempt = 0, uncertain = false
const pendingKey = () => 'mes-quality-pending:' + auth.username + ':' + auth.factoryId + ':' + props.declarationId
function clear() { generation++; queryAttempt++; view.value = null; error.value = ''; pending.value = null; uncertain = false; loading.value = busy.value = false; action.value = 'ASSESS'; basis.value = ''; related.value = null; Object.assign(form, {parentId:null,scrapQty:'',reworkQty:'',processedQty:'',recoveredQty:'',failedQty:'',reason:'',occurredAt:''}) }
async function load() {
 const ticket = ++queryAttempt, scope = generation; if (!allowed.value || !props.declarationId) return
 loading.value = true; error.value = ''
 try { const data = await api.details(props.declarationId); if (ticket !== queryAttempt || scope !== generation) return; view.value = data;
 const saved = sessionStorage.getItem(pendingKey()); if (saved && !pending.value) { pending.value = JSON.parse(saved) as Command; uncertain = true }
 if (pending.value && data.events.some(e => e.id === pending.value?.requestId)) { sessionStorage.removeItem(pendingKey()); pending.value = null; uncertain = false }
 action.value = pending.value?.action ?? (data.attribution === 'UNVERIFIED' ? 'ASSESS' : 'ALLOCATE') }
 catch(e) { if (ticket === queryAttempt && scope === generation) error.value = e instanceof Error ? e.message : '质量处置读取失败' }
 finally { if (ticket === queryAttempt && scope === generation) loading.value = false }
}
watch(() => [props.declarationId,auth.factoryId,auth.revision,allowed.value,writable.value], () => { clear(); void load() }, { immediate: true, flush: 'sync' })
onBeforeUnmount(() => { clear(); emit('pending', false) })
watch(action, () => { form.parentId = null })
const parents = computed(() => view.value?.events.filter(e => e.actionType === (action.value === 'CORRECT_RESULT' ? 'RESULT' : action.value === 'RESULT' || action.value === 'CANCEL_START' ? 'START' : 'ALLOCATE')) ?? [])
const legacy = computed(() => view.value?.destinationType != null ? view.value.destinationType !== 'SAME_NODE' : current.value != null && current.value.destinationType !== 'SAME_NODE')
const relatedOptions = computed(() => props.candidates.filter(v => v.declarationId !== props.declarationId && v.executionId === view.value?.executionId && v.recordAction !== 'VOID'))
const eventLabel = (value: string) => ({ ASSESS: '归属核实', ALLOCATE: '报废/返工分配', START: '开始单节点返工', RESULT: '返工结果确认', CANCEL_ALLOC: '撤回未使用分配', CANCEL_START: '取消未处理开始量', CORRECT_RESULT: '订正原返工结果' }[value] ?? value)
const stateLabel = (value: string) => ({UNVERIFIED:'归属待核实',OVERLAP:'关联重复，不再扣减',PENDING:'待处置',IN_PROGRESS:'返工处理中',WAITING_REWORK:'待返工',FAILED_SCRAPPED:'返工结束，失败部分转报废',RECOVERED:'返工成功已恢复',SCRAPPED:'已报废',VOIDED:'申报已作废，历史保留'}[value] ?? value)
async function submit() {
 if (!view.value || !writable.value || busy.value) return
 if (!pending.value) pending.value = {requestId:crypto.randomUUID(),expectedRevision:view.value.revision,action:action.value,parentId:action.value !== 'ASSESS' && action.value !== 'ALLOCATE' ? form.parentId : null,scrapQty:(action.value === 'ALLOCATE' || action.value === 'CANCEL_ALLOC') ? form.scrapQty || '0' : '0',reworkQty:['ALLOCATE','START','CANCEL_ALLOC','CANCEL_START'].includes(action.value) ? form.reworkQty || '0' : '0',processedQty:(action.value === 'RESULT' || action.value === 'CORRECT_RESULT') ? form.processedQty || '0' : '0',recoveredQty:(action.value === 'RESULT' || action.value === 'CORRECT_RESULT') ? form.recoveredQty || '0' : '0',failedQty:(action.value === 'RESULT' || action.value === 'CORRECT_RESULT') ? form.failedQty || '0' : '0',occurredAt:form.occurredAt,reason:form.reason,assessment:action.value === 'ASSESS' ? {type:attribution.value,relatedDeclarationId:attribution.value === 'OVERLAP' ? related.value : null,basis:basis.value} : null}
 const storageKey = pendingKey(); sessionStorage.setItem(storageKey, JSON.stringify(pending.value))
 const ticket = generation; busy.value = true; error.value = ''
 try { const data = await api.execute(props.declarationId,pending.value); sessionStorage.removeItem(storageKey); if (ticket !== generation) return; view.value = data; action.value = data.attribution === 'UNVERIFIED' ? 'ASSESS' : 'ALLOCATE'; pending.value = null; uncertain = false; form.parentId = null; emit('changed') }
 catch(e) { if (ticket !== generation) return; error.value = e instanceof Error ? e.message : '未取得确认结果，请使用原请求重查'; if (e instanceof ApiError && e.status >= 400 && e.status < 500 && !uncertain) { sessionStorage.removeItem(storageKey); pending.value = null } else { uncertain = true } }
 finally { if (ticket === generation) busy.value = false }
}
</script>
<template>
 <section class="quality-treatment" aria-label="单节点质量处置与返工">
  <div class="table-toolbar"><strong>质量处置与单节点返工<span v-if="current?.affectedNodeName"> · {{ current.affectedNodeName }}</span></strong><el-button :loading="loading" :disabled="busy" @click="load">刷新处置</el-button></div>
  <el-alert v-if="error" :title="error" type="error" :closable="false" />
  <template v-if="view && allowed">
   <el-alert v-if="view.attribution === 'UNVERIFIED' && view.recordAction !== 'VOID'" title="归属待核实：尚未证明与其他申报是否同一批实物。当前不重复扣减，但禁止依赖不确定额度继续报工或交接。" type="warning" :closable="false" />
   <el-alert v-if="legacy" title="此记录保留历史退工序/退仓登记；归属可核实，返工前须由管理员留痕订正为所属工序处置。" type="info" :closable="false" />
   <p>{{ stateLabel(view.state) }}<span v-if="view.basis"> · 核实依据：{{ view.basis }}</span></p>
   <el-descriptions :column="2" border><el-descriptions-item label="原始直接不良">{{ view.defectQty }}</el-descriptions-item><el-descriptions-item label="当前未恢复不良">{{ view.recordAction === 'VOID' ? '已作废' : view.attribution === 'UNVERIFIED' ? '待核实' : view.netDefectQty }}</el-descriptions-item><el-descriptions-item label="直接分配报废">{{ view.allocatedScrapQty }}</el-descriptions-item><el-descriptions-item label="分配返工">{{ view.allocatedReworkQty }}</el-descriptions-item><el-descriptions-item label="返工加工完成量">{{ view.processedQty }}</el-descriptions-item><el-descriptions-item label="确认恢复量">{{ view.recoveredQty }}</el-descriptions-item><el-descriptions-item label="返工失败转报废">{{ view.failedQty }}</el-descriptions-item><el-descriptions-item label="返工处理中">{{ view.inProgressQty }}</el-descriptions-item></el-descriptions>
   <p class="secondary">返工仅发生在本次不良所属工序；恢复只减少原有不良损失，不新增正常报工，不自动补齐末道加工或入库。</p>
   <el-form v-if="writable && view.attribution !== 'OVERLAP' && view.recordAction !== 'VOID'" label-position="top" :disabled="busy || !!pending" @submit.prevent="submit">
    <el-form-item label="本次质量操作"><el-select v-model="action"><el-option v-if="view.attribution === 'UNVERIFIED'" label="核实不良归属" value="ASSESS" /><template v-if="view.attribution === 'INDEPENDENT'"><el-option label="分配报废/返工" value="ALLOCATE" /><el-option label="开始所属节点返工" value="START" /><el-option label="录入返工结果并确认" value="RESULT" /><el-option label="撤回尚未使用的分配" value="CANCEL_ALLOC" /><el-option label="取消尚未处理的返工开始量" value="CANCEL_START" /><el-option label="订正原返工结果" value="CORRECT_RESULT" /></template></el-select></el-form-item>
    <template v-if="action === 'ASSESS'"><el-form-item label="归属结论"><el-select v-model="attribution"><el-option label="已核实为独立不良，不与已有申报重复" value="INDEPENDENT" /><el-option label="与已有申报属于同一批不良，不重复扣减" value="OVERLAP" /></el-select></el-form-item><el-form-item v-if="attribution === 'OVERLAP'" label="关联原不良申报"><el-select v-model="related" placeholder="选择同执行的原申报；可先在列表筛选该执行"><el-option v-for="d in relatedOptions" :key="d.declarationId" :value="d.declarationId" :label="`${d.affectedNodeName || '工序名称未记录'} · ${d.defectQty} · ${d.defectReason}`" /></el-select></el-form-item><el-form-item label="核实依据"><el-input v-model="basis" type="textarea" maxlength="500" /></el-form-item></template>
    <el-form-item v-if="!['ASSESS','ALLOCATE'].includes(action)" label="关联原始质量事件"><el-select v-model="form.parentId" placeholder="选择本申报的对应处理记录"><el-option v-for="e in parents" :key="e.id" :value="e.id" :label="`${eventLabel(e.actionType)} · 返工 ${e.reworkQty} / 处理 ${e.processedQty} / 恢复 ${e.recoveredQty} · ${e.occurredAt}`" /></el-select></el-form-item>
    <el-form-item v-if="action === 'ALLOCATE' || action === 'CANCEL_ALLOC'" :label="action === 'CANCEL_ALLOC' ? '撤回报废分配数量（不恢复为合格品）' : '本次报废数量'"><el-input v-model="form.scrapQty" inputmode="decimal" /></el-form-item>
    <el-form-item v-if="['ALLOCATE','START','CANCEL_ALLOC','CANCEL_START'].includes(action)" :label="action.startsWith('CANCEL') ? '本次取消数量（仅限未消耗余额）' : '本次返工数量'"><el-input v-model="form.reworkQty" inputmode="decimal" /></el-form-item>
    <el-alert v-if="action === 'CORRECT_RESULT'" title="填写原结果订正后的有效总量：处理量不得增加，成功与失败之和必须等于处理量。不会修改原事件。" type="warning" :closable="false" /><template v-if="action === 'RESULT' || action === 'CORRECT_RESULT'"><el-form-item label="实际返工处理量"><el-input v-model="form.processedQty" inputmode="decimal" /></el-form-item><el-form-item label="成功恢复数量"><el-input v-model="form.recoveredQty" inputmode="decimal" /></el-form-item><el-form-item label="失败转报废数量"><el-input v-model="form.failedQty" inputmode="decimal" /></el-form-item></template>
    <el-form-item label="实际操作时间"><el-date-picker v-model="form.occurredAt" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" /></el-form-item><el-form-item label="原因"><el-input v-model="form.reason" maxlength="500" /></el-form-item>
   </el-form>
   <p v-if="pending" role="status">原质量请求 {{ pending.requestId }} 的结果待确认，仅允许原样重查。</p>
   <el-button v-if="writable && view.attribution !== 'OVERLAP' && view.recordAction !== 'VOID'" type="primary" :loading="busy" :disabled="busy || (legacy && action !== 'ASSESS')" @click="submit">{{ pending ? '使用原请求重查结果' : '确认本次质量操作' }}</el-button>
   <el-table :data="view.events" row-key="id" border><el-table-column prop="declarationRevision" label="申报版本" width="90" /><el-table-column label="动作" min-width="140"><template #default="{row}">{{ eventLabel(row.actionType) }}</template></el-table-column><el-table-column prop="scrapQty" label="直接报废" min-width="100" /><el-table-column prop="reworkQty" label="分配/开始返工" min-width="125" /><el-table-column prop="processedQty" label="返工加工量" min-width="110" /><el-table-column prop="recoveredQty" label="确认恢复量" min-width="110" /><el-table-column prop="failedQty" label="失败转报废" min-width="110" /><el-table-column prop="operatorName" label="实际操作人" min-width="120" /><el-table-column prop="confirmedByName" label="记录/确认人" min-width="120" /><el-table-column prop="occurredAt" label="处理时间" min-width="180" /><el-table-column prop="reason" label="原因" min-width="160" /></el-table>
  </template>
 </section>
</template>
<style scoped>
.quality-treatment :deep(.el-select), .quality-treatment :deep(.el-date-editor) { width:100%; }
.quality-treatment :deep(.el-descriptions__content) { overflow-wrap:anywhere; }
@media (max-width: 600px) {
 .quality-treatment :deep(.el-descriptions__table tbody) { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); }
 .quality-treatment :deep(.el-descriptions__table tr) { display:contents; }
 .quality-treatment :deep(.el-descriptions__table td) { display:block; width:auto; }
 .quality-treatment :deep(.el-descriptions__content) { white-space:nowrap; }
}
</style>
