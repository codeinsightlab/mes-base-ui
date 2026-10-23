<script setup lang="ts">
import QueryForm from '@/components/QueryForm.vue'
import { ApiError } from '@/lib/request'

import CodeScanner from '@/components/scanner/CodeScanner.vue'
import { displayQuantity } from '@/lib/production/quantity'
import QuantityText from '@/components/business/production/QuantityText.vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/stores/auth'
import PageHeader from '@/components/PageHeader.vue'
import RoutingGraphPreview from '@/components/business/RoutingGraphPreview.vue'
import { productionInput as api, inputPermission, type Supply, type Preview, type Calculation, type Command, type Result } from '@/api/production/productionInput'
const auth = useAuth(), router = useRouter()
const allowed = computed(() => auth.hasPermission(inputPermission, 'factory'))
const code = ref(''), orderId = ref(''), stockId = ref(''), outputQty = ref(''), nextNode = ref('')
const supply = ref<Supply | null>(null), preview = ref<Preview | null>(null), calculation = ref<Calculation | null>(null)
const selected = ref<string[]>([]), pending = ref<Command | null>(null), result = ref<Result | null>(null)
const error = ref(''), busy = ref(false), pendingSourceMode = ref<string | null>(null)
let generation = 0, contextSequence = 0, previewSequence = 0, calculateSequence = 0
const terminal = computed(() => !!preview.value?.actual && !['READY', 'RUNNING', 'FULLY_RECEIVED'].includes(preview.value.actual.executionStatus))
const stockOptions = computed(() => supply.value?.stocks.filter(s => !orderId.value || supply.value?.orders.find(o => o.workorderId === orderId.value)?.allowedWarehouses.includes(s.warehouseId)) ?? [])
const pathCandidates = computed(() => {
 const graph = preview.value?.definition; if (!graph) return []
 const last = graph.nodes.find(n => n.id === selected.value.at(-1))
 return graph.nodes.filter(n => !selected.value.includes(n.id!) && (last ? graph.edges.some(e => e.fromNodeCode === last.nodeCode && e.toNodeCode === n.nodeCode) : !graph.edges.some(e => e.toNodeCode === n.nodeCode)))
})
const pathComplete = computed(() => {
 const graph = preview.value?.definition, last = graph?.nodes.find(n => n.id === selected.value.at(-1))
 return !!graph && !!last && !graph.edges.some(e => e.fromNodeCode === last.nodeCode) && graph.nodes.filter(n => n.isKey).every(n => selected.value.includes(n.id!))
})
function clear() { generation++; contextSequence++; previewSequence++; calculateSequence++; supply.value = null; preview.value = null; calculation.value = null; selected.value = []; pending.value = null; pendingSourceMode.value = null; result.value = null; error.value = ''; busy.value = false; orderId.value = ''; stockId.value = ''; outputQty.value = ''; nextNode.value = '' }
const recoveryKey = () => 'mes-production-input-pending:' + auth.username + ':' + auth.factoryId
function restorePending() {
 if (!allowed.value) return
 const saved = sessionStorage.getItem(recoveryKey()); if (!saved) return
 try { const savedValue = JSON.parse(saved) as Command | { command: Command; sourceMode: string | null }; const request = 'command' in savedValue ? savedValue.command : savedValue; code.value = request.code; pending.value = request; pendingSourceMode.value = 'command' in savedValue ? savedValue.sourceMode : null; error.value = '存在结果待确认的投产请求，请使用原请求重查，不能发起替代领料。' }
 catch { error.value = '待确认投产请求无法读取，请联系管理员核实原记录。' }
}
watch(() => [auth.factoryId, auth.revision, allowed.value], () => { clear(); code.value = ''; restorePending() }, {flush: 'sync'})
watch(code, clear, {flush: 'sync'})
restorePending()
watch([stockId, outputQty], () => { calculateSequence++; calculation.value = null }, {flush: 'sync'})
watch(orderId, () => { previewSequence++; calculateSequence++; preview.value = null; calculation.value = null; selected.value = []; nextNode.value = ''; stockId.value = ''; outputQty.value = ''; if (orderId.value) void loadPreview() }, {flush: 'sync'})
watch(stockOptions, candidates => { if (pending.value) return; if (candidates.length === 1) stockId.value = candidates[0]!.reference; else if (!candidates.some(stock => stock.reference === stockId.value)) stockId.value = '' }, {flush: 'sync'})
onBeforeUnmount(clear)
async function query() {
 if (!allowed.value || busy.value || pending.value) return
 const ticket = ++contextSequence; busy.value = true; error.value = ''; supply.value = null; orderId.value = ''; preview.value = null; result.value = null
 try { const data = await api.query(code.value); if (ticket !== contextSequence) return; supply.value = data; if ((data.total ?? data.orders.length) === 1) orderId.value = data.orders[0]!.workorderId }
 catch (e) { if (ticket === contextSequence) error.value = e instanceof Error ? e.message : '库存查询失败' }
 finally { if (ticket === contextSequence) busy.value = false }
}
async function moreOrders() {
 if (!supply.value || busy.value || pending.value) return
 const ticket = contextSequence; busy.value = true; error.value = ''
 try {
  const data = await api.query(code.value, supply.value.orders.length)
  if (ticket !== contextSequence || !supply.value) return
  supply.value = {...data, orders: [...new Map([...supply.value.orders, ...data.orders].map(o => [o.workorderId, o])).values()]}
 } catch(e) { if (ticket === contextSequence) error.value = e instanceof Error ? e.message : '候选工单读取失败' }
 finally { if (ticket === contextSequence) busy.value = false }
}
async function loadPreview() {
 const ticket = ++previewSequence; error.value = ''
 try { const data = await api.preview(code.value, orderId.value); if (ticket !== previewSequence) return; preview.value = data; selected.value = data.actual ? [...data.actual.selectedNodeIds] : [] }
 catch (e) { if (ticket === previewSequence) error.value = e instanceof Error ? e.message : '执行工艺读取失败' }
}
async function calculate() {
 if (!orderId.value || !stockId.value || !/^\d{1,14}(\.\d{1,2})?$/.test(outputQty.value) || !/[1-9]/.test(outputQty.value) || busy.value || !allowed.value) return
 const ticket = ++calculateSequence; busy.value = true; error.value = ''; calculation.value = null
 try { const data = await api.calculate({code: code.value, workorderId: orderId.value, stockReference: stockId.value, outputQty: outputQty.value}); if (ticket === calculateSequence) calculation.value = data }
 catch (e) { if (ticket === calculateSequence) error.value = e instanceof Error ? e.message : '用料计算失败' }
 finally { if (ticket === calculateSequence) busy.value = false }
}
async function submit() {
 if (!allowed.value || busy.value || (!pending.value && (!calculation.value || !preview.value || !pathComplete.value))) return
 if (!pending.value) { pendingSourceMode.value = calculation.value!.sourceMode; pending.value = {requestId: crypto.randomUUID(), code: code.value, workorderId: orderId.value, stockReference: stockId.value, outputQty: outputQty.value, routingId: preview.value!.definition.routing.id, routingNodeIds: [...selected.value], inputKind: 'PRODUCTION_INPUT', calculationKey: calculation.value!.calculationKey} }
 const storageKey = recoveryKey(); sessionStorage.setItem(storageKey, JSON.stringify({ command: pending.value, sourceMode: pendingSourceMode.value }))
 const ticket = generation; busy.value = true; error.value = ''
 try { const data = await api.submit(pending.value); if (data.status === 'CONFIRMED') sessionStorage.removeItem(storageKey); if (ticket !== generation) return; result.value = data; if (data.status === 'CONFIRMED') await loadPreview() }
 catch (e) {
  const localRejected = pendingSourceMode.value === 'LOCAL_ONLY' && e instanceof ApiError
   && ['BAD_REQUEST', 'PRODUCTION_INPUT_STALE', 'PRODUCTION_INPUT_QUOTA_EXCEEDED', 'WORKORDER_CANCELLED', 'WORKORDER_NOT_RELEASED', 'BUSINESS_SOURCE_CONFLICT'].includes(e.code)
  if (localRejected) sessionStorage.removeItem(storageKey)
  if (ticket !== generation) return
  if (localRejected) { pending.value = null; pendingSourceMode.value = null; calculation.value = null; error.value = e.message + '；本次未形成正式投入，请重新计算。' }
  else error.value = e instanceof Error ? e.message : '提交结果未取得，请使用同一请求重查'
 }
 finally { if (ticket === generation) busy.value = false }
}
function again() { if (result.value?.status !== 'CONFIRMED') return; pending.value = null; pendingSourceMode.value = null; calculation.value = null; result.value = null; outputQty.value = ''; void query() }
</script>
<template>
 <section class="page-shell production-input">
  <PageHeader title="扫码投产" description="单材料投产 · 扫描工单、材料品号及生产批次" />
  <el-alert v-if="!allowed" title="没有正式投产权限" type="warning" :closable="false" />
  <template v-else>
   <el-alert v-if="error" :title="error" type="error" :closable="false" />
   <QueryForm class="filter-panel input-scan" label-position="top" @submit="query">
    <el-form-item label="工单 / 材料品号 / 生产批次"><el-input v-model="code" placeholder="工单号:材料品号#批次号，例如 WO001:M001#0001" maxlength="2048" :disabled="busy || !!pending" aria-label="工单 / 材料品号 / 生产批次" aria-describedby="production-input-scan-help" /></el-form-item>
    <el-button native-type="submit" type="primary" :loading="busy" :disabled="!code || !!pending" >查询库存与工单</el-button>
    <CodeScanner v-model="code" :disabled="busy || !!pending || !allowed" :context-key="auth.factoryId + ':' + auth.revision" @confirm="query" />
   </QueryForm>
   <p id="production-input-scan-help" class="secondary">按“工单号:材料品号#批次号”填写，例如 WO001:M001#0001；材料必须属于工单选定BOM的直接组件；领料成功后，使用返回的生产身份码报工。批次原文保持不变。</p>
   <template v-if="supply">
    <el-alert :title="supply.sourceMode === 'LOCAL_ONLY' ? '独立 MES 模式：使用本地批次库存与受控工单用料依据' : 'ERP 模式：由配置的适配器提供库存与工单依据'" type="info" :closable="false" />
    <el-empty v-if="!supply.stocks.length" description="没有该材料批次的合法可用库存" />
    <el-empty v-else-if="!supply.orders.length" description="没有匹配的工单；请检查已下达工单、BOM用料与允许仓库" />
    <el-form v-else label-position="top" class="panel">
     <el-form-item label="生产工单"><el-select v-model="orderId" :disabled="busy || !!pending" placeholder="选择工单、产出产品与工作中心"><el-option v-for="o in supply.orders" :key="o.workorderId" :value="o.workorderId" :label="`${o.workorderCode} · ${o.productCode} ${o.productName} · ${o.workCenter} · 计划 ${displayQuantity(o.plannedQty)} ${o.outputUnitCode} · ${o.status}`" /></el-select></el-form-item>
     <p class="secondary">已加载 {{ supply.orders.length }} / {{ supply.total ?? supply.orders.length }} 张匹配工单 <el-button v-if="supply.orders.length < supply.total" link :loading="busy" :disabled="!!pending" @click="moreOrders">加载更多匹配工单</el-button></p>
     <el-form-item label="材料库存来源"><el-select v-model="stockId" :disabled="!orderId || busy || !!pending" placeholder="明确选择仓库、批次及库位"><el-option v-for="s in stockOptions" :key="s.reference" :value="s.reference" :label="`${s.materialCode} / ${s.lotCode} · ${s.warehouseCode}${s.binCode ? ' / '+s.binCode : ''} · 可用 ${displayQuantity(s.availableQty)} ${s.unitCode}`" /></el-select></el-form-item>
     <el-form-item :label="'本次预计成品产出数量' + (supply.orders.find(o => o.workorderId === orderId)?.outputUnitCode ? '（' + supply.orders.find(o => o.workorderId === orderId)?.outputUnitCode + '）' : '')"><el-input v-model="outputQty" inputmode="decimal" :disabled="busy || !!pending" placeholder="正数，最多2位小数" /></el-form-item>
     <el-button :disabled="!stockId || !outputQty || !!pending" :loading="busy" @click="calculate">计算本次材料领用量</el-button>
     <el-descriptions v-if="calculation" :column="1" border><el-descriptions-item label="预计产出"><QuantityText :value="calculation.outputQty" /> {{ calculation.order.outputUnitCode }}</el-descriptions-item><el-descriptions-item label="材料领用"><QuantityText :value="calculation.issueQty" /> {{ calculation.stock.unitCode }}</el-descriptions-item><el-descriptions-item label="库存读取时间">{{ calculation.stock.observedAt }}</el-descriptions-item></el-descriptions>
     <template v-if="preview">
      <el-alert v-if="terminal" title="此生产身份状态不允许继续投产" type="warning" :closable="false" /><el-alert v-else-if="preview.actual?.executionStatus === 'FULLY_RECEIVED'" title="本执行已完全入库。计划余额内的合法追加将复用本执行并恢复未完成，既有报工、入库和结束记录保留。" type="info" :closable="false" />
      <h3>{{ preview.actual ? preview.actual.executionId + ' · ' + preview.actual.executionStatus : '首次投产将创建执行单元' }}</h3>
      <p>{{ preview.definition.routing.code }} / V{{ preview.definition.routing.version }} · {{ preview.definition.routing.name }}</p>
      <RoutingGraphPreview :nodes="preview.definition.nodes" :edges="preview.definition.edges" :selected-node-ids="selected" />
      <ol aria-label="本次实际路径"><li v-for="id in selected" :key="id">{{ preview.definition.nodes.find(n => n.id === id)?.nodeCode }} · {{ preview.definition.nodes.find(n => n.id === id)?.operationName }}</li></ol>
      <template v-if="!preview.actual">
       <el-select v-model="nextNode" placeholder="选择起点或下一相邻工序" :disabled="busy || !!pending"><el-option v-for="n in pathCandidates" :key="n.id" :value="n.id!" :label="n.nodeCode + ' · ' + n.operationName" /></el-select>
       <el-button :disabled="!nextNode || !!pending" @click="selected.push(nextNode); nextNode = ''">加入路径</el-button><el-button :disabled="!selected.length || !!pending" @click="selected.pop()">撤回末节点</el-button>
      </template>
      <p class="secondary">实际路径在首次领料确认后锁定；追加投产不会改变工艺版本或路径。</p>
     </template>
     <div class="table-toolbar"><el-button type="primary" :loading="busy" :disabled="terminal || result?.status === 'CONFIRMED' || (!pending && (!calculation || !pathComplete))" @click="submit">{{ pending ? '使用原请求重查结果' : '确认正式投产' }}</el-button></div>
    </el-form>
   </template>
   <div v-if="pending && result?.status !== 'CONFIRMED'" class="table-toolbar" role="status"><span>原投产请求 {{ pending.requestId }}：结果待确认</span><el-button :loading="busy" @click="submit">使用原请求重查</el-button></div>
   <el-button v-if="result?.issueId" @click="router.push({path:'/issue/mesMaterialIssue',query:{issueId:result.issueId}})">打开本次领料单并核实</el-button>
   <el-descriptions v-if="result" :column="1" border><el-descriptions-item label="执行单元">{{ result.executionId }}</el-descriptions-item><el-descriptions-item label="领料结果">{{ result.status }}</el-descriptions-item><el-descriptions-item label="生产身份码">{{ result.code || '未生成（未记录批次）' }}</el-descriptions-item><el-descriptions-item label="累计正式投入（产出基本单位）"><QuantityText :value="result.productionInputQty" /></el-descriptions-item><el-descriptions-item label="首工序剩余可报"><QuantityText :value="result.availableQty" /></el-descriptions-item><el-descriptions-item label="请求号">{{ result.requestId }}</el-descriptions-item></el-descriptions>
   <el-alert v-if="result && result.status !== 'CONFIRMED'" title="本次尚未贡献投产额度，请在领料管理中核实原操作；不要重新发起同一次领料。" type="warning" :closable="false" />
   <div v-if="result?.status === 'CONFIRMED'" class="table-toolbar"><el-button @click="again">再次投产</el-button><el-button @click="router.push({path:'/production/productionReport',query:{executionId:result.executionId,workorderId:orderId}})">查看生产数量</el-button></div>
  </template>
 </section>
</template>

<style scoped>
.production-input :deep(.el-select) { width: 100%; }
.production-input :deep(.el-descriptions__label) { width: 120px; min-width: 120px; word-break: normal; }
.production-input .input-scan :deep(.el-input) { width: 100% !important; }
.production-input :deep(.el-descriptions__content) { overflow-wrap: anywhere; word-break: break-all; }
.input-scan { display: flex; flex-wrap: wrap; align-items: flex-end; gap: var(--ui-space-3); }
.input-scan .el-form-item { flex: 0 1 640px; min-width: min(100%, 320px); max-width: 100%; margin: 0; }
.input-scan :deep(.el-form-item__label) { height: auto; line-height: 1.5; }
.input-scan :deep(.el-form-item__content) { min-width: 0; }
.input-scan :deep(.el-input__wrapper) { min-height: 44px; }
.input-scan .el-button { flex-shrink: 0; min-height: 44px; margin-left: 0; }
</style>
