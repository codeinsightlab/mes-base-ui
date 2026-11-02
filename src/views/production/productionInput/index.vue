<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import QueryForm from '@/components/QueryForm.vue'
import CodeScanner from '@/components/scanner/CodeScanner.vue'
import QuantityInput from '@/components/business/material/QuantityInput.vue'
import QuantityText from '@/components/business/production/QuantityText.vue'
import RoutingGraphPreview from '@/components/business/RoutingGraphPreview.vue'
import { useAuth } from '@/stores/auth'
import { ApiError } from '@/lib/request'
import { normalizedQuantityInput } from '@/lib/production/quantityRules'
import { productionInput as api, inputPermission, type Preview, type Command, type Result } from '@/api/production/productionInput'
import { productionCombination as combinations, type Calculation, type Combination } from '@/api/production/productionCombination'
const auth = useAuth()
const allowed = computed(() => auth.hasPermission(inputPermission, 'factory') && auth.runtimeMode === 'LOCAL')
const code = ref(''), quantity = ref(''), valid = ref(false), nextNode = ref('')
const combination = ref<Combination | null>(null)
const calculation = ref<Calculation | null>(null), preview = ref<Preview | null>(null)
const selected = ref<string[]>([]), pending = ref<Command | null>(null), result = ref<Result | null>(null)
const error = ref(''), pathError = ref(''), busy = ref(false)
const demandById = computed(() => new Map(combination.value?.items.map(item => [item.demandLineId, item]) ?? []))
let sequence = 0
const storageKey = () => `mes-combination-input:${auth.username}:${auth.factoryId}`
const pathCandidates = computed(() => {
  const graph = preview.value?.definition
  if (!graph) return []
  const last = graph.nodes.find(n => n.id === selected.value.at(-1))
  return graph.nodes.filter(n => !selected.value.includes(n.id!) && (last ? graph.edges.some(e => e.fromNodeCode === last.nodeCode && e.toNodeCode === n.nodeCode) : !graph.edges.some(e => e.toNodeCode === n.nodeCode)))
})
const pathComplete = computed(() => {
  if (preview.value && !preview.value.definition) return true
  const graph = preview.value?.definition, last = graph?.nodes.find(n => n.id === selected.value.at(-1))
  return !!graph && !!last && !graph.edges.some(e => e.fromNodeCode === last.nodeCode) && graph.nodes.filter(n => n.isKey).every(n => selected.value.includes(n.id!))
})
const calculatedQuantity = computed(() => !!calculation.value && normalizedQuantityInput(calculation.value.outputQty) === normalizedQuantityInput(quantity.value))
function reset() { combination.value = null;sequence++;calculation.value = null;preview.value = null;selected.value = [];nextNode.value = '';quantity.value = '';pending.value = null;result.value = null;error.value = '';pathError.value = '';busy.value = false }
function restore() {
  if (!allowed.value) return
  try {
    const saved = sessionStorage.getItem(storageKey())
    if (saved) { pending.value = JSON.parse(saved) as Command;code.value = pending.value.code;error.value = '有领料请求尚未确认结果，请使用原请求重查。' }
  } catch { error.value = '待确认请求无法读取，请管理员核对原单据后处理。' }
}
watch(() => [auth.factoryId, auth.revision, auth.factoryPermissions.join('|'), auth.runtimeMode], () => { reset();code.value = '';restore() }, { flush: 'sync' })
watch(code, () => { if (!pending.value) reset() }, { flush: 'sync' })
onBeforeUnmount(reset)
restore()
async function loadPath(ticket: number, workorderId: string) {
  pathError.value = ''
  try { const data = await api.preview(code.value, workorderId);if (ticket !== sequence) return;preview.value = data;selected.value = data.actual ? [...data.actual.selectedNodeIds] : [] } catch(e) { if (ticket === sequence) pathError.value = e instanceof Error ? e.message : '工艺路径读取失败' }
}
async function query(defaultMaximum = true) {
  if (!allowed.value || pending.value || busy.value) return
  const ticket = ++sequence
  busy.value = true;error.value = '';result.value = null
  try {
    const raw = await combinations.resolve(code.value)
    if (ticket !== sequence) return
    combination.value = raw
    void loadPath(ticket, raw.workorderId)
    const data = await combinations.calculate(code.value, defaultMaximum ? undefined : normalizedQuantityInput(quantity.value))
    if (ticket !== sequence) return
    calculation.value = data
    if (defaultMaximum) quantity.value = data.outputQty
  } catch(e) { if (ticket === sequence) { calculation.value = null;error.value = e instanceof Error ? e.message : '固定组合计算失败' } } finally { if (ticket === sequence) busy.value = false }
}
async function submit() {
  if (!allowed.value || busy.value) return
  if (!pending.value) {
    if (!calculation.value || !preview.value || !valid.value || !calculatedQuantity.value || !pathComplete.value) return
    pending.value = { requestId: crypto.randomUUID(), code: code.value, outputQty: normalizedQuantityInput(quantity.value), routingId: preview.value.definition?.routing.id ?? null, routingNodeIds: [...selected.value], calculationKey: calculation.value.calculationKey }
  }
  const key = storageKey(), ticket = sequence
  sessionStorage.setItem(key, JSON.stringify(pending.value));busy.value = true;error.value = ''
  try {
    const data = await api.submit(pending.value)
    if (data.status === 'POSTED') sessionStorage.removeItem(key)
    if (ticket !== sequence) return
    result.value = data
    if (data.status === 'POSTED') { pending.value = null;calculation.value = null }
  } catch(e) {
    const rejected = e instanceof ApiError && ['BAD_REQUEST', 'PRODUCTION_INPUT_STALE', 'PRODUCTION_COMBINATION_STOCK_CHANGED', 'PRODUCTION_COMBINATION_CLOSED', 'PRODUCTION_INPUT_QUOTA_EXCEEDED', 'WORKORDER_NOT_RELEASED', 'WORKORDER_CANCELLED', 'BUSINESS_SOURCE_CONFLICT'].includes(e.code)
    if (rejected) sessionStorage.removeItem(key)
    if (ticket !== sequence) return
    if (rejected) { pending.value = null;calculation.value = null }
    error.value = (e instanceof ApiError && e.maximumQty ? `库存已变化，当前最大可领 ${e.maximumQty} 套` : e instanceof Error ? e.message : '未取得处理结果') + (rejected ? '；本次未形成投入，请重新读取当前可领数量后确认。' : '；请使用原请求重查，避免重复领料。')
  } finally { if (ticket === sequence) busy.value = false }
}
</script>
<template>
  <section class="page-shell production-input">
    <PageHeader title="扫码生产领料" description="读取固定材料批次组合，按完整配套数量领料" />
    <el-alert v-if="!allowed" title="需要本地工厂生产领料权限" type="warning" :closable="false" />
    <template v-else>
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <QueryForm label-position="top" @submit="query()">
        <el-form-item label="材料组合二维码"><el-input v-model="code" placeholder="扫描工单生成的组合二维码" :disabled="busy || !!pending" aria-label="材料组合二维码" /></el-form-item>
        <el-button native-type="submit" type="primary" :disabled="!code || !!pending" :loading="busy">读取当前可领数量</el-button>
        <CodeScanner v-model="code" :disabled="busy || !!pending" :context-key="auth.factoryId + ':' + auth.revision" @confirm="query()" />
      </QueryForm>
      <el-button v-if="pending" type="primary" :loading="busy" @click="submit">使用原请求重查结果</el-button>
      <template v-if="combination">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="工单">{{ combination.workorderCode }}</el-descriptions-item>
          <el-descriptions-item label="当前最大可领套数"><QuantityText v-if="calculation" :value="calculation.maximumQty" /><span v-else>待重新计算</span></el-descriptions-item>
          <el-descriptions-item label="执行">{{ combination.executionId || '首次成功领料后创建' }}</el-descriptions-item>
          <el-descriptions-item label="组合码">{{ combination.code }}</el-descriptions-item>
        </el-descriptions>
        <el-table :data="combination.items" row-key="demandLineId">
          <el-table-column prop="lineNo" label="需求行" width="90" /><el-table-column prop="materialCode" label="材料" />
          <el-table-column label="固定批次"><template #default="{row}">{{ row.batches.map((batch: string | null) => batch ?? '未分批').join('、') }}</template></el-table-column>
        </el-table>
        <el-form label-position="top"><el-form-item label="本次确认产出套数（可调小）"><QuantityInput v-model="quantity" :material-id="combination.productId" required positive :disabled="busy || !!pending" @validity="valid=$event" /></el-form-item></el-form>
        <el-button :disabled="!valid || busy || !!pending" @click="query(false)">按本次数量重新计算</el-button>
        <el-alert v-if="combination.closed" title="该组合的执行已结束，仅供查询，不能再次领料" type="warning" :closable="false" />
        <el-alert v-if="!calculatedQuantity" title="数量已改变，请重新计算后确认" type="info" :closable="false" />
        <el-table v-if="calculation" :data="calculation.allocations">
          <el-table-column label="需求行"><template #default="{row}">{{ demandById.get(row.demandLineId)?.lineNo }}</template></el-table-column><el-table-column label="材料"><template #default="{row}">{{ demandById.get(row.demandLineId)?.materialCode }}</template></el-table-column><el-table-column prop="batchNo" label="批次" />
          <el-table-column label="仓库"><template #default="{row}">{{ calculation.warehouses?.find(warehouse => warehouse.id === row.warehouseId)?.name || row.warehouseId }}</template></el-table-column><el-table-column prop="binCode" label="库位" /><el-table-column label="本次出库数量"><template #default="{row}"><QuantityText :value="row.quantity" /></template></el-table-column>
        </el-table>
        <el-alert v-if="pathError" :title="pathError" type="error" :closable="false"><el-button @click="loadPath(sequence, combination.workorderId)">重试读取路径</el-button></el-alert>
        <template v-if="preview">
          <h3>生产路径</h3>
          <RoutingGraphPreview v-if="preview.definition" :nodes="preview.definition.nodes" :edges="preview.definition.edges" :selected-node-ids="selected" />
          <el-alert v-if="!preview.definition" title="此工单无工艺，无需工序报工；领料成功后按确认套数办理成品入库。" type="info" :closable="false" />
          <template v-if="preview.definition && !preview.actual">
            <el-select v-model="nextNode" placeholder="选择起点或下一相邻工序" :disabled="busy || !!pending"><el-option v-for="node in pathCandidates" :key="node.id" :value="node.id!" :label="node.nodeCode+' · '+node.operationName" /></el-select>
            <el-button :disabled="!nextNode || busy || !!pending" @click="selected.push(nextNode);nextNode=''">加入路径</el-button>
            <el-button :disabled="!selected.length || busy || !!pending" @click="selected.pop()">撤回末节点</el-button>
          </template>
          <el-button type="primary" :disabled="!pathComplete || !valid || !calculatedQuantity || busy || !!pending" :loading="busy" @click="submit">确认领料并投入</el-button>
        </template>
      </template>
      <el-result v-if="result" :icon="result.stockApplied ? 'success' : 'warning'" :title="result.stockApplied ? '领料成功' : '该笔领料已撤销'">
        <template #sub-title>执行 {{ result.executionId }} · 累计正式投入 <QuantityText :value="result.confirmedInputQty" /> · 出库单 {{ result.documentId }}</template>
        <template #extra><el-button @click="query()">读取下一次可领数量</el-button></template>
      </el-result>
    </template>
  </section>
</template>

<style scoped>
.production-input :deep(.el-descriptions), .production-input :deep(.el-table) { margin-block: var(--ui-space-3); }
</style>
