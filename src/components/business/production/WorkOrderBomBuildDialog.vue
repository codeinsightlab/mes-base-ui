<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import MaterialSelect from '@/components/business/MaterialSelect.vue'
import QuantityInput from '@/components/business/material/QuantityInput.vue'
import { normalizedQuantityInput, positiveQuantity } from '@/lib/production/quantityRules'
import { request } from '@/lib/request'
import { api, type BomBuildChoice, type BomBuildOrder, type BomBuildPreview, type NumberingRuleOption } from '@/api/production/workorder'
import { defaultBom, type Bom } from '@/api/basic/materialBom'
import { useAuth } from '@/stores/auth'
import { executePendingBomBuild, pendingBomBuildKey, restorePendingBomBuild, type PendingBomBuild } from '@/lib/production/pendingBomBuild'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; completed: [] }>()
interface Choice { ruleCode: string; routingId: string; plannedStartAt: string | null; plannedEndAt: string | null; remark: string }
const productId = ref(''), bomId = ref(''), plannedQty = ref('1'), quantityValid = ref(false)
const versions = ref<Bom[]>([]), rules = ref<NumberingRuleOption[]>([]), preview = ref<BomBuildPreview | null>(null)
const choices = ref<Record<string, Choice>>({}), loadingVersions = ref(false), busy = ref(false), error = ref('')
const requestId = ref(''), storageBlocked = ref(false)
const retryConfirmation = ref<PendingBomBuild | null>(null)
const auth = useAuth()
const source = computed(() => ({ productId: productId.value, bomId: bomId.value, plannedQty: normalizedQuantityInput(plannedQty.value) }))
let generation = 0
let restoring = false
const pendingKey = () => pendingBomBuildKey(auth.userId, auth.factoryId)

function reset() {
  generation++; productId.value = ''; bomId.value = ''; plannedQty.value = '1'; quantityValid.value = false
  versions.value = []; rules.value = []; preview.value = null; choices.value = {}; error.value = ''; busy.value = false
  requestId.value = ''; retryConfirmation.value = null
}
async function loadVersions(value: string) {
  if (!value || !auth.factoryId || auth.factorySwitching) return
  const current = ++generation
  loadingVersions.value = true
  try {
    const [page, defaultVersion] = await Promise.all([
      request<{ items: Bom[] }>('/api/basic/material-bom', { query: { productId: value, status: 'PUBLISHED', offset: 0, limit: 100 }, scope: 'factory' }),
      defaultBom(value)
    ])
    if (current !== generation || value !== productId.value) return
    versions.value = page.items
    if (defaultVersion?.status === 'PUBLISHED') {
      if (!page.items.some(row => row.id === defaultVersion.id)) versions.value = [...page.items, defaultVersion]
      if (!bomId.value) bomId.value = defaultVersion.id
    }
  } catch(reason) {
    if (current === generation) error.value = reason instanceof Error ? reason.message : '读取已发布BOM版本失败'
  } finally {
    if (current === generation) loadingVersions.value = false
  }
}

function restorePending() {
  storageBlocked.value = false
  if (!auth.userId || !auth.factoryId) return
  const restored = restorePendingBomBuild(window.localStorage, pendingKey())
  if (restored.invalid) {
    storageBlocked.value = true
    error.value = '存在无法读取的展阶待确认请求；请核对工单记录后再开始新提交'
    return
  }
  const pending = restored.pending
  if (!pending) return
  restoring = true
  productId.value = pending.source.productId
  bomId.value = pending.source.bomId
  plannedQty.value = pending.source.plannedQty
  preview.value = null
  retryConfirmation.value = pending
  choices.value = Object.fromEntries(pending.confirmation.orders.map(choice => [choice.path, {
    ruleCode: choice.ruleCode || '', routingId: choice.routingId || '',
    plannedStartAt: choice.plannedStartAt, plannedEndAt: choice.plannedEndAt, remark: choice.remark || ''
  }]))
  void nextTick().then(() => { restoring = false })
  error.value = '已恢复未确认结果的原请求；重试将使用相同请求键和完整内容'
}
watch(() => props.modelValue, async visible => {
  if (!visible) { reset(); return }
  restorePending()
  try {
    rules.value = await api.numberingRules()
  } catch(reason) {
    error.value = reason instanceof Error ? reason.message : '读取工单编码规则失败'
  }
})
watch(() => [auth.userId, auth.factoryId, auth.revision], () => {
  if (!props.modelValue) return
  generation++
  reset()
  restorePending()
}, { flush: 'sync' })
watch(productId, async value => {
  if (restoring) return
  bomId.value = ''; versions.value = []; preview.value = null; choices.value = {}; error.value = ''
  requestId.value = ''; retryConfirmation.value = null
  if (!value) return
  await loadVersions(value)
})
watch(bomId, () => { if (!restoring) { preview.value = null; choices.value = {} } })
watch(() => [productId.value, bomId.value, plannedQty.value], () => {
  if (busy.value || restoring) return
  preview.value = null; choices.value = {}; requestId.value = ''; retryConfirmation.value = null
})

async function makePreview() {
  if (storageBlocked.value || retryConfirmation.value) return
  if (!productId.value || !bomId.value || !quantityValid.value || !positiveQuantity(source.value.plannedQty)) {
    error.value = '请选择产品和已发布BOM版本，并填写有效计划数量'; return
  }
  busy.value = true; error.value = ''
  try {
    const result = await api.bomBuildPreview(source.value)
    preview.value = result
    requestId.value = crypto.randomUUID()
    retryConfirmation.value = null
    choices.value = Object.fromEntries(result.orders.map(order => [order.path, {
      ruleCode: order.defaultRuleCode || '', routingId: order.routingId || '', plannedStartAt: null, plannedEndAt: null, remark: ''
    }]))
    if (!result.complete) error.value = '展阶包含校验错误，请先处理下方问题后再提交'
  } catch(reason) {
    error.value = reason instanceof Error ? reason.message : 'BOM展阶预览失败'
    preview.value = null
  } finally {
    busy.value = false
  }
}

function validChoice(order: BomBuildOrder) {
  const choice = choices.value[order.path]
  return !!choice?.ruleCode && rules.value.some(rule => rule.ruleCode === choice.ruleCode)
    && (!order.routings.length || order.routings.some(route => route.id === choice.routingId))
}
const canConfirm = computed(() => {
  if (retryConfirmation.value) return true
  return !!preview.value?.complete && preview.value.orders.length > 0
    && preview.value.orders.every(order => validChoice(order))
})

async function confirm() {
  if ((!preview.value && !retryConfirmation.value) || !canConfirm.value || busy.value) return
  busy.value = true; error.value = ''
  if (!retryConfirmation.value) {
    const currentPreview = preview.value
    if (!currentPreview) { busy.value = false; return }
    const submittedChoices: BomBuildChoice[] = currentPreview.orders.map(order => {
      const choice = choices.value[order.path]!
      return { ...choice, path: order.path, routingId: choice.routingId || null }
    })
    retryConfirmation.value = {
      version: 1,
      source: { ...source.value },
      confirmation: { requestId: requestId.value, fingerprint: currentPreview.fingerprint, orders: submittedChoices }
    }
  }
  try {
    const pending = retryConfirmation.value
    const result = await executePendingBomBuild(window.localStorage, pendingKey(), pending,
      (savedSource, confirmation) => api.bomBuildConfirm(savedSource, confirmation))
    ElMessage.success(`已创建 ${result.orders.length} 张工单：${result.orders.map(item => item.workorder.workorder.code).join('、')}`)
    retryConfirmation.value = null
    emit('update:modelValue', false); emit('completed')
  } catch(reason) {
    error.value = reason instanceof Error ? reason.message : '批量创建失败'
  } finally {
    busy.value = false
  }
}

async function startNewAfterUnknown() {
  if (!retryConfirmation.value || busy.value) return
  try {
    await ElMessageBox.confirm('原请求结果仍未确认。放弃原请求并重新提交可能再次创建相同工单，建议先重试原请求核实结果。确定要放弃原请求吗？', '提交结果未确认', { type: 'warning', confirmButtonText: '放弃并重新预览', cancelButtonText: '继续核实' })
    const pending = restorePendingBomBuild(window.localStorage, pendingKey()).pending
    if (pending?.confirmation.requestId === retryConfirmation.value.confirmation.requestId)
      window.localStorage.removeItem(pendingKey())
    retryConfirmation.value = null; preview.value = null; choices.value = {}; requestId.value = ''; error.value = ''
  } catch { /* The original request remains available for retry. */ }
}
</script>

<template>
  <el-dialog :model-value="modelValue" title="BOM展阶创建工单" width="min(1200px,96vw)" destroy-on-close @update:model-value="emit('update:modelValue', $event)">
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <el-form label-width="120px">
      <el-form-item label="顶级产品" required><MaterialSelect :model-value="productId || null" :disabled="busy || !!retryConfirmation" status="ENABLED" @update:model-value="productId = $event || ''" /></el-form-item>
      <el-form-item label="BOM版本" required><el-select v-model="bomId" :disabled="!productId || busy || !!retryConfirmation" :loading="loadingVersions" placeholder="请选择已发布版本"><el-option v-for="bom in versions" :key="bom.id" :value="bom.id" :label="`${bom.code} / V${bom.version}${bom.defaultVersion ? '（默认）' : ''}`" /></el-select></el-form-item>
      <el-form-item label="计划数量" required><QuantityInput v-model="plannedQty" :material-id="productId" :disabled="busy || !!retryConfirmation" required positive @validity="quantityValid = $event" /></el-form-item>
      <el-form-item><el-button type="primary" :loading="busy" :disabled="!productId || !bomId || !!retryConfirmation || storageBlocked" @click="makePreview">展开并预览</el-button></el-form-item>
    </el-form>
    <template v-if="preview || retryConfirmation">
      <el-alert v-if="preview?.complete" title="以下数量、产品和BOM结构来自本次预览；请检查每张工单的编码规则及工艺后统一确认。预览不会创建工单或取正式编号。" type="info" :closable="false" />
      <el-alert v-if="preview && rules.length === 0" title="当前没有可用的工单编码规则，无法创建工单。" type="error" :closable="false" />
      <el-alert v-if="retryConfirmation" title="此请求结果未确认。关闭或刷新不会丢失原请求；请先用原请求键重试核实。" type="warning" :closable="false" />
      <el-button v-if="retryConfirmation" link type="warning" @click="startNewAfterUnknown">放弃原请求并开始新预览</el-button>
      <div v-if="retryConfirmation && !preview" class="pending-request">
        <p>原请求键：{{ retryConfirmation.confirmation.requestId }}</p>
        <p>产品 {{ retryConfirmation.source.productId }} · BOM {{ retryConfirmation.source.bomId }} · 计划数量 {{ retryConfirmation.source.plannedQty }}</p>
        <el-table :data="retryConfirmation.confirmation.orders" size="small">
          <el-table-column prop="path" label="BOM路径" />
          <el-table-column prop="ruleCode" label="工单编码规则" />
          <el-table-column prop="routingId" label="工艺ID" />
          <el-table-column prop="plannedStartAt" label="计划开始" />
          <el-table-column prop="plannedEndAt" label="计划结束" />
          <el-table-column prop="remark" label="备注" />
        </el-table>
      </div>
      <el-collapse v-if="preview" class="orders">
        <el-collapse-item v-for="(order, index) in preview.orders" :key="order.path" :name="order.path">
          <template #title><strong>{{ index === 0 ? '根工单' : '子工单' }} · {{ order.productCode }} {{ order.productName }}</strong><span class="title-meta">计划 {{ order.plannedQty }} · BOM {{ order.bomCode }} / V{{ order.bomVersion }}</span></template>
          <el-alert v-for="(problem, pi) in order.problems" :key="pi" :title="problem.message" type="error" :closable="false" />
          <el-form label-width="120px" class="choice-form">
            <el-form-item label="工单编码规则" required><el-select v-model="choices[order.path]!.ruleCode" :disabled="!!retryConfirmation" placeholder="请选择规则"><el-option v-for="rule in rules" :key="rule.ruleCode" :value="rule.ruleCode" :label="`${rule.ruleName}（${rule.ruleCode}）`" /></el-select><span v-if="order.defaultRuleCode" class="hint">物料默认：{{ order.defaultRuleCode }}</span></el-form-item>
            <el-form-item label="适用工艺" :required="order.routings.length > 0"><el-select v-model="choices[order.path]!.routingId" :disabled="!!retryConfirmation" clearable :placeholder="order.routings.length ? '请选择已发布工艺' : '无适用工艺' "><el-option v-for="route in order.routings" :key="route.id" :value="route.id" :label="`${route.code} / V${route.version} · ${route.name}`" /></el-select></el-form-item>
            <el-form-item label="计划开始"><el-date-picker v-model="choices[order.path]!.plannedStartAt" :disabled="!!retryConfirmation" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" /></el-form-item>
            <el-form-item label="计划结束"><el-date-picker v-model="choices[order.path]!.plannedEndAt" :disabled="!!retryConfirmation" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" /></el-form-item>
            <el-form-item label="备注"><el-input v-model="choices[order.path]!.remark" :disabled="!!retryConfirmation" maxlength="500" /></el-form-item>
          </el-form>
          <el-table :data="order.materials" size="small"><el-table-column prop="code" label="直接用料编码" /><el-table-column prop="name" label="直接用料名称" /><el-table-column prop="quantity" label="需求数量" align="right" /></el-table>
        </el-collapse-item>
      </el-collapse>
      <el-alert v-for="(problem, index) in preview?.problems || []" :key="index" :title="problem.message" type="error" :closable="false" />
    </template>
    <template #footer><el-button @click="emit('update:modelValue', false)">关闭</el-button><el-button type="primary" :disabled="!canConfirm || storageBlocked" :loading="busy" @click="confirm">{{ retryConfirmation ? '重试原请求 / 核实结果' : '确认并批量创建' }}</el-button></template>
  </el-dialog>
</template>

<style scoped>
.orders { margin-top: 16px; }
.pending-request { margin-top: 16px; }
.title-meta { margin-left: 16px; color: var(--el-text-color-secondary); }
.choice-form { margin-top: 12px; }
.hint { margin-left: 10px; color: var(--el-text-color-secondary); }
</style>
