<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import DocumentFields from '@/components/document/DocumentFields.vue'
import WorkorderBomSelect from '@/components/business/material/WorkorderBomSelect.vue'
import MaterialSelect from '@/components/business/MaterialSelect.vue'
import WarehouseSelect from '@/components/business/WarehouseSelect.vue'
import UnitMeasureSelect from '@/components/business/material/UnitMeasureSelect.vue'
import QuantityInput from '@/components/business/material/QuantityInput.vue'
import QuantityText from './QuantityText.vue'
import { api as materials } from '@/api/basic/material'
import { directComponents } from '@/api/basic/materialBom'
import { emptyMaterialDemand, type MaterialDemandSave, type WorkorderMaterialItem } from '@/api/production/workorderMaterial'
import type { Field, Row } from '@/lib/crud'
import { normalizedQuantityInput, positiveQuantity } from '@/lib/production/quantityRules'
import { usePageMessageBox } from '@/lib/pageMessageBox'
import { useAuth } from '@/stores/auth'
const props = defineProps<{ modelValue: MaterialDemandSave; productId: string; plannedQty: string; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [MaterialDemandSave] }>()
const auth = useAuth(), messageBox = usePageMessageBox()
const scopeInvalid = ref(false)
const loading = ref(false), error = ref(''), confirmationPending = ref(false), selectionKey = ref(0)
const validity = ref<Record<string, boolean>>({}), materialLoading = ref<Record<string, boolean>>({})
const fields: Field[] = [{ key: 'bomId', label: 'BOM版本', kind: 'select', required: true },
  { key: 'workCenter', label: '工作中心', kind: 'text', maxLength: 100 },
  { key: 'warehouseIds', label: '允许领料仓库', kind: 'text' }]
const fieldDraft = computed(() => props.modelValue as unknown as Row)
let generation = 0, loadedBasis = '', previousPlan = props.plannedQty
const materialAttempts = new Map<string, number>()
const key = (row: WorkorderMaterialItem) => row.id ? 'id:' + row.id : row.bomItemId ? 'bom:' + row.bomItemId : 'new:' + row.clientKey
function patch(value: Partial<MaterialDemandSave>) { emit('update:modelValue', { ...props.modelValue, ...value }) }
function updateRow(index: number, value: Partial<WorkorderMaterialItem>) {
  patch({ items: props.modelValue.items.map((row, i) => i === index ? { ...row, ...value } : row), adjustmentsConfirmed: false })
}
async function confirmReset() {
  const current = generation
  if (props.modelValue.items.some(row => row.manuallyAdjusted)) {
    try { await messageBox.confirm('切换产品或BOM版本将重新带出材料，并放弃当前人工调整，是否继续？', '确认重新带料', { type: 'warning', confirmButtonText: '重新带料', cancelButtonText: '保留当前明细' }) } catch { return false }
  }
  return current === generation && !props.disabled
}
async function selectBom(bomId: string | null) {
  if (bomId === props.modelValue.bomId || props.disabled) return
  if (!await confirmReset()) { selectionKey.value++; return }
  validity.value = {}; confirmationPending.value = false
  patch({ bomId, expectedBomRevision: null, items: [], adjustmentsConfirmed: true })
}
async function recalculate() {
  const current = ++generation, bomId = props.modelValue.bomId, productId = props.productId
  const quantity = normalizedQuantityInput(props.plannedQty)
  loadedBasis = ''; error.value = ''; loading.value = false
  if (previousPlan !== props.plannedQty && props.modelValue.items.some(row => row.manuallyAdjusted)) {
    confirmationPending.value = true
    patch({ adjustmentsConfirmed: false })
  }
  previousPlan = props.plannedQty
  if (scopeInvalid.value || !bomId || !productId || !positiveQuantity(quantity)) return
  loading.value = true
  try {
    const result = await directComponents(bomId, quantity)
    if (current !== generation) return
    if (result.version.productId !== productId || result.version.id !== bomId) throw new Error('BOM响应与当前产出不一致')
    const existing = new Map(props.modelValue.items.filter(row => row.bomItemId).map(row => [row.bomItemId, row]))
    const rows: WorkorderMaterialItem[] = result.items.map(component => {
      const previous = existing.get(component.lineId)
      return { ...previous, id: previous?.id ?? null, bomItemId: component.lineId,
        materialId: previous?.manuallyAdjusted ? previous.materialId : component.materialId,
        unitId: previous?.manuallyAdjusted ? previous.unitId : component.unitId,
        totalRequiredQty: previous?.manuallyAdjusted ? previous.totalRequiredQty : component.quantity,
        standardRequiredQty: component.quantity, bomBaseQty: component.baseQty, bomComponentQty: component.componentQty,
        plannedQty: quantity, outputUnitId: result.version.unitId, manuallyAdjusted: previous?.manuallyAdjusted ?? false }
    })
    rows.push(...props.modelValue.items.filter(row => !row.bomItemId))
    if (rows.length > 100) throw new Error('工单用料最多100行，请减少人工新增材料')
    patch({ expectedBomRevision: result.version.revision, items: rows })
    loadedBasis = JSON.stringify([productId, bomId, quantity])
  } catch(reason) { if (current === generation) error.value = reason instanceof Error ? reason.message : 'BOM直接组件读取失败' } finally { if (current === generation) loading.value = false }
}
function add() {
  if (props.disabled || props.modelValue.items.length >= 100) return
  patch({ items: [...props.modelValue.items, { id: null, bomItemId: null, materialId: '', unitId: '', totalRequiredQty: '', manuallyAdjusted: true, clientKey: crypto.randomUUID() }] })
}
async function materialChanged(index: number, materialId: string | null) {
  const row = props.modelValue.items[index]
  if (!row || props.disabled) return
  const rowKey = key(row), context = generation, attempt = (materialAttempts.get(rowKey) ?? 0) + 1
  materialAttempts.set(rowKey, attempt)
  updateRow(index, { materialId: materialId ?? '', unitId: '', manuallyAdjusted: true })
  validity.value[rowKey] = false
  if (!materialId) return
  materialLoading.value[rowKey] = true
  try {
    const material = await materials.detail(materialId)
    if (context !== generation || materialAttempts.get(rowKey) !== attempt) return
    const currentIndex = props.modelValue.items.findIndex(item => key(item) === rowKey)
    if (currentIndex < 0 || props.modelValue.items[currentIndex]?.materialId !== materialId) return
    if (material.status !== 'ENABLED' || !material.unitId) throw new Error('材料或基本单位不可用')
    updateRow(currentIndex, { unitId: material.unitId })
  } catch(reason) { if (context === generation) error.value = reason instanceof Error ? reason.message : '材料单位读取失败' } finally { if (materialAttempts.get(rowKey) === attempt) materialLoading.value[rowKey] = false }
}
async function validateAndConfirm() {
  const current = generation
  error.value = ''
  if (props.disabled || scopeInvalid.value || loading.value || !props.modelValue.bomId || !props.modelValue.expectedBomRevision
    || loadedBasis !== JSON.stringify([props.productId, props.modelValue.bomId, normalizedQuantityInput(props.plannedQty)])) {
    error.value ||= '请先选择有效BOM并等待当前产量的用料计算完成'
    return false
  }
  if (!props.modelValue.items.length || props.modelValue.items.some(row => !row.materialId || !row.unitId
    || materialLoading.value[key(row)] || !validity.value[key(row)] || !positiveQuantity(normalizedQuantityInput(row.totalRequiredQty)))) {
    error.value = '请填写每行材料、基本单位和符合单位规则的正需求量'
    return false
  }
  if (confirmationPending.value) {
    const snapshot = JSON.stringify(props.modelValue)
    try { await messageBox.confirm('产出数量已改变：未调整的BOM行已重算，人工调整及新增行保留原数量。确认按当前明细保存？', '确认工单用料', { type: 'warning', confirmButtonText: '确认当前明细', cancelButtonText: '继续检查' }) } catch { return false }
    if (current !== generation || snapshot !== JSON.stringify(props.modelValue)) return false
    patch({ adjustmentsConfirmed: true }); confirmationPending.value = false
  }
  return current === generation
}
watch(() => [auth.factoryId, auth.revision, auth.factoryPermissions.join('|')], () => {
  generation++; scopeInvalid.value = true; loadedBasis = ''; loading.value = false; validity.value = {}; error.value = ''; patch(emptyMaterialDemand())
}, { flush: 'sync' })
watch([() => props.productId, () => props.plannedQty, () => props.modelValue.bomId], () => { void recalculate() }, { immediate: true, flush: 'post' })
onBeforeUnmount(() => { generation++; materialAttempts.clear() })
defineExpose({ validateAndConfirm, confirmReset })
</script>
<template>
  <section class="panel workorder-material-editor" aria-label="工单用料明细">
    <h3>工单BOM与用料</h3>
    <DocumentFields :fields="fields" :draft="fieldDraft" :disabled="disabled">
      <template #field-bomId><WorkorderBomSelect :key="selectionKey" :model-value="modelValue.bomId" :material-id="productId" :disabled="disabled || loading" @update:model-value="selectBom" /></template>
      <template #field-workCenter><el-input :model-value="modelValue.workCenter" :disabled="disabled" maxlength="100" @update:model-value="patch({ workCenter: $event })" /></template>
      <template #field-warehouseIds><el-select :model-value="modelValue.warehouseIds" multiple :disabled="disabled" placeholder="可在正式领料前维护" @update:model-value="patch({ warehouseIds: $event })"><el-option v-for="id in modelValue.warehouseIds" :key="id" :value="id" :label="id" /></el-select><WarehouseSelect :model-value="null" source="LOCAL" :disabled="disabled" @update:model-value="value => value && !modelValue.warehouseIds.includes(value) && patch({ warehouseIds: [...modelValue.warehouseIds, value] })" /></template>
    </DocumentFields>
    <el-alert v-if="error" :title="error" type="error" :closable="false"><el-button link @click="recalculate">重新读取BOM</el-button></el-alert>
    <el-alert v-if="confirmationPending" title="产量已变化，人工调整及新增行保留原数量，保存前需要确认。" type="warning" :closable="false" />
    <div class="table-toolbar"><el-button :disabled="disabled || loading || !modelValue.bomId || modelValue.items.length >= 100" @click="add">增加材料</el-button><span class="secondary">初始数量＝产出数量×组件用量÷BOM基数。标准量按BOM原组件基本单位计算；调整只影响当前工单。</span></div>
    <el-table v-loading="loading" :data="modelValue.items" :row-key="key" :empty-text="loading ? '正在读取BOM直接组件' : error ? 'BOM明细读取失败，修复后重试' : '选择BOM并填写产量后带出材料'">
      <el-table-column label="材料" min-width="240"><template #default="{ row, $index }"><MaterialSelect :model-value="row.materialId" :disabled="disabled" @update:model-value="value => materialChanged($index, value)" /></template></el-table-column>
      <el-table-column label="基本单位" min-width="140"><template #default="{ row }"><UnitMeasureSelect :model-value="row.unitId" disabled /></template></el-table-column>
      <el-table-column label="BOM标准量" min-width="125"><template #default="{ row }"><QuantityText :value="row.standardRequiredQty" /></template></el-table-column>
      <el-table-column label="实际需求量" min-width="180"><template #default="{ row, $index }"><QuantityInput :model-value="row.totalRequiredQty" :material-id="row.materialId" required positive :disabled="disabled || !!materialLoading[key(row)]" @update:model-value="value => updateRow($index, { totalRequiredQty: value, manuallyAdjusted: true })" @validity="value => validity[key(row)] = value" /></template></el-table-column>
      <el-table-column label="来源" width="100"><template #default="{ row }">{{ row.manuallyAdjusted ? (row.bomItemId ? '人工调整' : '人工新增') : 'BOM带出' }}</template></el-table-column>
      <el-table-column label="操作" width="90"><template #default="{ row, $index }"><el-button v-if="!row.bomItemId" link type="danger" :disabled="disabled" @click="patch({ items: modelValue.items.filter((_, index) => index !== $index) })">删除</el-button></template></el-table-column>
    </el-table>
  </section>
</template>
<style scoped>
.workorder-material-editor { margin-top: 16px; padding: 16px; }
.workorder-material-editor h3 { margin-top: 0; }
</style>
