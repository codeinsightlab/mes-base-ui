<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import QueryForm from '@/components/QueryForm.vue'
import CodeScanner from '@/components/scanner/CodeScanner.vue'
import QuantityInput from '@/components/business/material/QuantityInput.vue'
import QuantityText from '@/components/business/production/QuantityText.vue'
import { extendInputPath, inputPathCandidates, inputPathComplete } from '@/lib/production/inputRoutingPath'
import RoutingGraphPreview from '@/components/business/RoutingGraphPreview.vue'
import { useAuth } from '@/stores/auth'
import { ApiError } from '@/lib/request'
import { normalizedQuantityInput } from '@/lib/production/quantityRules'
import { productionInput as api, inputPermission, type Preview, type Command, type Result } from '@/api/production/productionInput'
import { productionCombination as combinations, type Calculation, type Combination } from '@/api/production/productionCombination'
const auth = useAuth()
const allowed = computed(() => auth.hasPermission(inputPermission, 'factory') && auth.runtimeMode === 'LOCAL')
const code = ref(''), quantity = ref(''), valid = ref(false)
const combination = ref<Combination | null>(null)
const calculation = ref<Calculation | null>(null), preview = ref<Preview | null>(null)
const selected = ref<string[]>([]), pending = ref<Command | null>(null), result = ref<Result | null>(null)
const error = ref(''), pathError = ref(''), busy = ref(false)
const demandById = computed(() => new Map(combination.value?.items.map(item => [item.demandLineId, item]) ?? []))
let sequence = 0
const storageKey = () => `mes-combination-input:${auth.username}:${auth.factoryId}`
const pathCandidates = computed(() => preview.value?.definition ? inputPathCandidates(preview.value.definition, selected.value) : [])
const pathComplete = computed(() => {
  if (!preview.value) return false
  if (!preview.value.definition) return true
  return inputPathComplete(preview.value.definition, selected.value)
})
const selectedNodes = computed(() => selected.value.map(id => preview.value?.definition?.nodes.find(node => node.id === id)).filter(node => !!node))
const hasBranchChoice = computed(() => {
  const graph = preview.value?.definition
  return !!graph && selected.value.some((_, index) => inputPathCandidates(graph, selected.value.slice(0, index)).length > 1)
})
const pathBusy = ref(false)
const submitHint = computed(() => {
  if (combination.value?.closed) return '该码对应的生产执行已结束，仅供查询。'
  if (!calculation.value) return '请先读取当前可领数量。'
  if (!valid.value) return '请填写符合产出单位规则的正数量。'
  if (!calculatedQuantity.value) return '数量已改变，请重新计算出库明细。'
  if (pathBusy.value) return '正在读取本批次的生产工艺。'
  if (pathError.value || !preview.value) return '请重试读取生产工艺后确认。'
  if (!pathComplete.value) return pathCandidates.value.length > 1 ? '请选择本批次的工艺分支。' : '路径未满足完整性或关键工序要求，请核对工艺。'
  return '确认后将审核领料出库，并记录本次正式投入。'
})
const canSubmit = computed(() => !!combination.value && !combination.value.closed && !!calculation.value && !!preview.value && pathComplete.value && valid.value && calculatedQuantity.value && !pathBusy.value && !busy.value && !pending.value)

function chooseBranch(id: string) {
  const graph = preview.value?.definition
  if (!graph || preview.value?.actual || busy.value || pending.value || !pathCandidates.value.some(node => node.id === id)) return
  selected.value = extendInputPath(graph, [...selected.value, id])
}

function resetBranches() {
  if (!preview.value?.definition || preview.value.actual || busy.value || pending.value) return
  selected.value = extendInputPath(preview.value.definition)
}

const calculatedQuantity = computed(() => !!calculation.value && normalizedQuantityInput(calculation.value.outputQty) === normalizedQuantityInput(quantity.value))

function reset() {
  combination.value = null
  sequence++
  calculation.value = null
  preview.value = null
  selected.value = []
  pathBusy.value = false
  quantity.value = ''
  pending.value = null
  result.value = null
  error.value = ''
  pathError.value = ''
  busy.value = false
}

function restore() {
  if (!allowed.value) return
  try {
    const saved = sessionStorage.getItem(storageKey())
    if (saved) {
      pending.value = JSON.parse(saved) as Command
      code.value = pending.value.code
      error.value = '有领料请求尚未确认结果，请使用原请求重查。'
    }
  } catch {
    error.value = '待确认请求无法读取，请管理员核对原单据后处理。'
  }
}

watch(() => [auth.factoryId, auth.revision, auth.factoryPermissions.join('|'), auth.runtimeMode], () => {
  reset()
  code.value = ''
  restore()
}, { flush: 'sync' })
watch(code, () => {
  if (!pending.value) reset()
}, { flush: 'sync' })
onBeforeUnmount(reset)
restore()

async function loadPath(ticket: number, workorderId: string) {
  pathError.value = ''
  pathBusy.value = true
  try {
    const data = await api.preview(code.value, workorderId)
    if (ticket !== sequence) return
    const sameVersion = preview.value?.definition?.routing.id === data.definition?.routing.id
      && preview.value?.definition?.routing.version === data.definition?.routing.version
    const previous = selected.value
    preview.value = data
    if (data.actual) selected.value = [...data.actual.selectedNodeIds]
    else if (data.definition) selected.value = extendInputPath(data.definition, sameVersion ? previous : [])
    else selected.value = []
  } catch (e) {
    if (ticket === sequence) {
      preview.value = null
      selected.value = []
      pathError.value = e instanceof Error ? e.message : '工艺路径读取失败'
    }
  } finally {
    if (ticket === sequence) pathBusy.value = false
  }
}

async function query(defaultMaximum = true) {
  if (!allowed.value || pending.value || busy.value) return
  const ticket = ++sequence
  busy.value = true
  error.value = ''
  result.value = null
  try {
    const raw = await combinations.resolve(code.value)
    if (ticket !== sequence) return
    combination.value = raw
    void loadPath(ticket, raw.workorderId)
    const data = await combinations.calculate(code.value, defaultMaximum ? undefined : normalizedQuantityInput(quantity.value))
    if (ticket !== sequence) return
    calculation.value = data
    if (defaultMaximum) quantity.value = normalizedQuantityInput(data.outputQty)
  } catch (e) {
    if (ticket === sequence) {
      calculation.value = null
      error.value = e instanceof Error ? e.message : '固定组合计算失败'
    }
  } finally {
    if (ticket === sequence) busy.value = false
  }
}

async function submit() {
  if (!allowed.value || busy.value) return
  if (!pending.value) {
    if (!canSubmit.value || !preview.value || !calculation.value) return
    pending.value = { requestId: crypto.randomUUID(), code: code.value, outputQty: normalizedQuantityInput(quantity.value), routingId: preview.value.definition?.routing.id ?? null, routingNodeIds: [...selected.value], calculationKey: calculation.value.calculationKey }
  }
  const key = storageKey(), ticket = sequence
  sessionStorage.setItem(key, JSON.stringify(pending.value))
  busy.value = true
  error.value = ''
  try {
    const data = await api.submit(pending.value)
    if (data.status === 'POSTED') sessionStorage.removeItem(key)
    if (ticket !== sequence) return
    result.value = data
    if (data.status === 'POSTED') {
      pending.value = null
      calculation.value = null
    }
  } catch (e) {
    const rejected = e instanceof ApiError && ['BAD_REQUEST', 'PRODUCTION_INPUT_STALE', 'PRODUCTION_COMBINATION_STOCK_CHANGED', 'PRODUCTION_COMBINATION_CLOSED', 'PRODUCTION_INPUT_QUOTA_EXCEEDED', 'WORKORDER_NOT_RELEASED', 'WORKORDER_CANCELLED', 'BUSINESS_SOURCE_CONFLICT'].includes(e.code)
    if (rejected) sessionStorage.removeItem(key)
    if (ticket !== sequence) return
    if (rejected) {
      pending.value = null
      calculation.value = null
    }
    error.value = (e instanceof ApiError && e.maximumQty ? `库存已变化，当前最大可领 ${e.maximumQty} 套` : e instanceof Error ? e.message : '未取得处理结果') + (rejected ? '；本次未形成投入，请重新读取当前可领数量后确认。' : '；请使用原请求重查，避免重复领料。')
  } finally {
    if (ticket === sequence) busy.value = false
  }
}
</script>
<template>
  <section class="page-shell production-input">
    <PageHeader title="扫码生产领料" description="扫描材料组合码，核对本次产出数量与出库明细，确认领料并投产。" />
    <el-alert v-if="!allowed" title="需要本地工厂生产领料权限" type="warning" :closable="false" />
    <template v-else>
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <section class="panel input-section" aria-labelledby="scan-title">
        <h2 id="scan-title">1. 扫码读取</h2>
        <QueryForm label-position="top" class="scan-form" @submit="query()">
          <el-form-item class="scan-field">
            <el-input v-model="code" placeholder="扫描或粘贴工单生成的材料组合码" :disabled="busy || !!pending" aria-label="材料组合二维码" />
          </el-form-item>
          <div class="input-actions">
            <CodeScanner v-model="code" :disabled="busy || !!pending" :context-key="auth.factoryId + ':' + auth.revision" @confirm="query()" />
            <el-button native-type="submit" type="primary" :disabled="!code || !!pending" :loading="busy">读取当前可领数量</el-button>
          </div>
        </QueryForm>
        <p class="secondary">二维码固定材料及批次；可领数量按当前库存计算。</p>
      </section>
      <section v-if="pending" class="panel input-section" aria-label="待确认的领料请求">
        <h2>领料结果待确认</h2>
        <p>请先核实上一笔领料结果，再办理下一笔。</p>
        <el-button type="primary" :loading="busy" @click="submit">使用原请求重查结果</el-button>
      </section>
      <div v-if="combination" class="input-workspace">
        <section class="panel input-section" aria-labelledby="quantity-title">
          <div class="section-heading">
            <h2 id="quantity-title">2. 核对数量与用料</h2>
            <el-tag :type="combination.closed ? 'warning' : 'info'">{{ combination.closed ? '执行已结束' : combination.executionCode ? '追加领料' : '首次领料' }}</el-tag>
          </div>
          <el-descriptions :column="3" direction="vertical" border>
            <el-descriptions-item label="工单">{{ combination.workorderCode }}</el-descriptions-item>
            <el-descriptions-item label="生产执行">{{ combination.executionCode ? '沿用该码的生产执行' : '首次成功领料后创建' }}</el-descriptions-item>
            <el-descriptions-item label="当前最大可领"><QuantityText v-if="calculation" :value="calculation.maximumQty" /><span v-else>待重新计算</span><span v-if="calculation"> 套</span></el-descriptions-item>
          </el-descriptions>
          <el-alert v-if="combination.closed" title="该组合的执行已结束，仅供查询，不能再次领料" type="warning" :closable="false" />
          <div class="quantity-row">
            <el-form label-position="top" @submit.prevent="query(false)">
              <el-form-item label="本次产出数量" class="quantity-field">
                <QuantityInput v-model="quantity" :material-id="combination.productId" show-unit required positive :disabled="busy || !!pending || combination.closed" aria-label="本次产出数量" @validity="valid=$event" />
              </el-form-item>
            </el-form>
            <el-button :disabled="!valid || busy || !!pending || combination.closed" @click="query(false)">重新计算用料</el-button>
          </div>
          <p class="secondary">按当前最大完整配套量带出，可调小。修改后重新计算；下方为本次数量对应的材料出库量。</p>
          <el-alert v-if="calculation && !calculatedQuantity" title="数量已改变，请重新计算后确认" type="info" :closable="false" />
          <h3>材料与固定批次</h3>
          <el-table :data="combination.items" row-key="demandLineId">
            <el-table-column prop="lineNo" label="行号" width="65" />
            <el-table-column prop="materialCode" label="材料品号" min-width="145" />
            <el-table-column label="原料批次" min-width="150"><template #default="{row}">{{ row.batches.map((batch: string | null) => batch ?? '未分批').join('、') }}</template></el-table-column>
          </el-table>
          <h3>本次出库明细</h3>
          <el-table v-if="calculation" :data="calculation.allocations">
            <el-table-column label="材料品号" min-width="145"><template #default="{row}">{{ demandById.get(row.demandLineId)?.materialCode }}</template></el-table-column>
            <el-table-column label="批次" min-width="140"><template #default="{row}">{{ row.batchNo ?? '未分批' }}</template></el-table-column>
            <el-table-column label="仓库" min-width="100"><template #default="{row}">{{ calculation.warehouses?.find(warehouse => warehouse.id === row.warehouseId)?.name || '仓库名称待确认' }}</template></el-table-column>
            <el-table-column label="库位" min-width="100"><template #default="{row}">{{ row.binCode ?? '未指定库位' }}</template></el-table-column>
            <el-table-column label="出库数量" min-width="110" align="right"><template #default="{row}"><QuantityText :value="row.quantity" /></template></el-table-column>
          </el-table>
          <el-alert v-else title="出库明细待重新计算，请读取当前可领数量。" type="info" :closable="false" />
        </section>
        <section class="panel input-section path-section" aria-labelledby="path-title">
          <h2 id="path-title">3. 确认生产路径</h2>
          <p class="secondary">沿用工单已选工艺。直线路径自动带出，仅有分支时选择本批次走向；领料成功后锁定，供后续报工使用。</p>
          <el-alert v-if="pathError" :title="pathError" type="error" :closable="false"><el-button :disabled="pathBusy || busy || !!pending" @click="loadPath(sequence, combination.workorderId)">重试读取路径</el-button></el-alert>
          <p v-else-if="pathBusy" role="status">正在读取生产工艺…</p>
          <template v-else-if="preview">
            <template v-if="preview.definition">
              <div class="section-heading">
                <strong>{{ preview.definition.routing.name }} · V{{ preview.definition.routing.version }}</strong>
                <el-tag :type="pathComplete ? 'success' : 'warning'">{{ preview.actual ? '沿用已有路径' : pathComplete ? '路径已就绪' : '待选择分支' }}</el-tag>
              </div>
              <ol v-if="selectedNodes.length" class="path-list" aria-label="本批次工序顺序">
                <li v-for="node in selectedNodes" :key="node.id"><span>{{ node.operationName || node.operationCode || node.nodeCode }}</span><small v-if="node.isKey" class="secondary">关键工序</small></li>
              </ol>
              <div v-if="!preview.actual && pathCandidates.length > 1" class="branch-picker" role="group" aria-label="选择工艺分支">
                <strong>{{ selected.length ? '请选择下一分支' : '请选择起始分支' }}</strong>
                <el-button v-for="node in pathCandidates" :key="node.id" :disabled="busy || !!pending || combination.closed" @click="chooseBranch(node.id!)">{{ node.operationName || node.operationCode || node.nodeCode }} · {{ node.nodeCode }}</el-button>
              </div>
              <p v-if="!pathComplete && !pathCandidates.length" role="alert">路径未满足完整性或关键工序要求，请核对工艺或重新选择分支。</p>
              <el-button v-if="!preview.actual && hasBranchChoice" :disabled="busy || !!pending || combination.closed" @click="resetBranches">重新选择分支</el-button>
              <p v-if="pathComplete && !preview.actual && !hasBranchChoice" class="secondary">直线工艺已自动带出完整路径，无需逐个选择工序。</p>
              <el-collapse class="graph-details"><el-collapse-item title="查看完整工艺图" name="graph"><RoutingGraphPreview :nodes="preview.definition.nodes" :edges="preview.definition.edges" :selected-node-ids="selected" /></el-collapse-item></el-collapse>
            </template>
            <el-alert v-else title="此工单无工艺，无需工序报工；领料成功后按确认套数办理成品入库。" type="info" :closable="false" />
          </template>
          <div class="confirm-area">
            <p role="status">{{ submitHint }}</p>
            <el-button type="primary" :disabled="!canSubmit" :loading="busy" @click="submit">确认领料并投入</el-button>
          </div>
        </section>
      </div>
      <el-empty v-else-if="!pending && !result" description="扫描工单材料组合码后，查看可领数量和材料明细" :image-size="70" />
      <el-result v-if="result" :icon="result.stockApplied ? 'success' : 'warning'" :title="result.stockApplied ? '领料成功' : '该笔领料已撤销'">
        <template #sub-title><p class="result-code">生产码 {{ result.executionCode }}</p><p>累计正式投入 <QuantityText :value="result.confirmedInputQty" /> 套</p></template>
        <template #extra><el-button @click="query()">读取下一次可领数量</el-button></template>
      </el-result>
    </template>
  </section>
</template>

<style scoped>
.production-input {
  display: grid;
  gap: var(--ui-space-4);
}
.input-section {
  padding: var(--ui-space-5);
  min-width: 0;
}
.input-section h2 {
  margin: 0 0 var(--ui-space-4);
  font-size: var(--ui-text-lg);
}
.input-section h3 {
  margin: var(--ui-space-5) 0 var(--ui-space-3);
  font-size: var(--ui-text-base);
}
.input-section p {
  margin: var(--ui-space-3) 0;
}
.scan-form, .input-actions, .quantity-row, .section-heading {
  display: flex;
  align-items: center;
  gap: var(--ui-space-3);
  flex-wrap: wrap;
}
.scan-form {
  align-items: flex-end;
}
.scan-field {
  flex: 1 1 360px;
  margin-bottom: 0;
}
.input-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 0.55fr);
  gap: var(--ui-space-4);
  align-items: start;
}
.section-heading {
  justify-content: space-between;
  margin-bottom: var(--ui-space-3);
}
.section-heading h2 {
  margin: 0;
}
.quantity-row {
  align-items: flex-end;
  margin-top: var(--ui-space-5);
}
.quantity-row :deep(.el-form-item) {
  margin: 0;
}
.path-list {
  padding-left: var(--ui-space-6);
  margin-block: var(--ui-space-4);
}
.path-list li {
  padding: var(--ui-space-2) 0;
}
.path-list small {
  margin-left: var(--ui-space-3);
}
.branch-picker {
  display: grid;
  gap: var(--ui-space-2);
  margin-block: var(--ui-space-4);
}
.branch-picker :deep(.el-button) {
  margin: 0;
  white-space: normal;
  height: auto;
  min-height: var(--ui-control-height);
}
.graph-details {
  margin-top: var(--ui-space-4);
}
.confirm-area {
  border-top: 1px solid var(--ui-border);
  margin-top: var(--ui-space-5);
  padding-top: var(--ui-space-3);
}
.confirm-area .el-button {
  width: 100%;
}
.result-code {
  overflow-wrap: anywhere;
}
@media (max-width: 1100px) {
  .input-workspace {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
