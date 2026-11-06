<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import PageDialog from '@/components/page/PageDialog.vue'
import MaterialSelect from '@/components/business/MaterialSelect.vue'
import UnitMeasureSelect from '@/components/business/material/UnitMeasureSelect.vue'
import QuantityText from '@/components/business/production/QuantityText.vue'
import WorkorderBomDemand from './WorkorderBomDemand.vue'
import WorkorderMaterialEditor from './WorkorderMaterialEditor.vue'
import { emptyMaterialDemand, materialDemandDraft, workorderMaterial, type WorkorderMaterial } from '@/api/production/workorderMaterial'
import { usePageMessageBox } from '@/lib/pageMessageBox'
import { useAuth } from '@/stores/auth'
const props = defineProps<{ workorderId: string; productId: string; plannedQty?: string; productCode?: string; productName?: string; readonly?: boolean }>()
const emit = defineEmits<{ changed: [] }>()
const auth = useAuth(), messageBox = usePageMessageBox()
const data = ref<WorkorderMaterial | null>(null), form = ref(emptyMaterialDemand()), error = ref(''), busy = ref(false), editing = ref(false)
const editor = ref<InstanceType<typeof WorkorderMaterialEditor> | null>(null)
const confirmingSave = ref(false)
const showBomAnalysis = ref(false)
const canRead = computed(() => !!auth.factoryId && !auth.factorySwitching && auth.hasPermission('workorder:query', 'factory'))
const canWrite = computed(() => canRead.value && !props.readonly && auth.hasPermission('workorder:material:update', 'factory'))
let generation = 0
function clear() { generation++; data.value = null; form.value = emptyMaterialDemand(); error.value = ''; busy.value = false; editing.value = false; showBomAnalysis.value = false }
async function load() {
  if (!canRead.value) return
  const current = ++generation; busy.value = true; error.value = ''
  try { const value = await workorderMaterial.get(props.workorderId); if (current === generation) data.value = value } catch(reason) { if (current === generation) error.value = reason instanceof Error ? reason.message : '工单用料读取失败' } finally { if (current === generation) busy.value = false }
}
function edit() {
  if (!data.value || !canWrite.value || data.value.frozenAt) return
  form.value = materialDemandDraft(data.value); editing.value = true
}
async function closeEditor(done: () => void) {
  try { await messageBox.confirm('关闭并放弃未保存的用料修改？', '关闭用料维护', { type: 'warning' }); editing.value = false; done() } catch { return }
}
async function save() {
  const current = generation
  if (!canWrite.value || busy.value || confirmingSave.value || data.value?.frozenAt || !editor.value) return
  confirmingSave.value = true
  let valid: boolean
  try { valid = await editor.value.validateAndConfirm() } finally { confirmingSave.value = false }
  if (!valid) return
  if (current !== generation || !canWrite.value || !editing.value) return
  busy.value = true; error.value = ''
  try {
    const value = await workorderMaterial.save(props.workorderId, form.value)
    if (current !== generation) return
    data.value = value; editing.value = false; emit('changed')
  } catch(reason) { if (current === generation) error.value = reason instanceof Error ? reason.message : '用料保存结果未知，请刷新核对' } finally { if (current === generation) busy.value = false }
}
watch(() => [props.workorderId, props.productId, auth.revision, auth.factoryId, auth.factoryPermissions.join('|'), canRead.value, canWrite.value], () => { clear(); void load() }, { immediate: true, flush: 'sync' })
onBeforeUnmount(clear)
</script>
<template>
  <section class="panel" aria-label="工单BOM用料">
    <div class="table-toolbar"><strong>材料需求</strong><el-button :disabled="busy" @click="load">刷新用料</el-button><el-button v-if="canWrite" :disabled="busy || !!data?.frozenAt" @click="edit">维护工单用料</el-button></div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <template v-if="data">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="BOM版本引用">{{ data.bomId || '尚未选择' }}</el-descriptions-item>
        <el-descriptions-item label="用料依据">{{ data.frozenAt ? '已固定 · ' + data.frozenAt : '首次正式领料前可调整' }}</el-descriptions-item>
        <el-descriptions-item label="工作中心">{{ data.workCenter || '尚未设置' }}</el-descriptions-item>
        <el-descriptions-item label="允许领料仓库">{{ data.warehouseIds && data.warehouseIds !== '[]' ? data.warehouseIds : '不限仓库' }}</el-descriptions-item>
      </el-descriptions>
      <el-table :data="data.items" row-key="id">
        <el-table-column label="材料" min-width="320"><template #default="{ row }"><MaterialSelect :model-value="row.materialId" disabled /></template></el-table-column>
        <el-table-column label="基本单位" width="130"><template #default="{ row }"><UnitMeasureSelect :model-value="row.unitId" disabled /></template></el-table-column>
        <el-table-column label="BOM标准量" min-width="125" align="right"><template #default="{ row }"><QuantityText :value="row.standardRequiredQty" /></template></el-table-column>
        <el-table-column label="实际需求量" min-width="125" align="right"><template #default="{ row }"><QuantityText :value="row.totalRequiredQty" /></template></el-table-column>
        <el-table-column label="来源" width="100"><template #default="{ row }">{{ row.manuallyAdjusted ? (row.bomItemId ? '人工调整' : '人工新增') : row.bomItemId ? 'BOM带出' : '原有用料' }}</template></el-table-column>
      </el-table>
      <p class="secondary">领料按实际需求量计算；原料批次在打码时确定。</p>
      <el-collapse v-if="data.bomId" @change="showBomAnalysis = true"><el-collapse-item title="多层BOM分析（辅助查询）" name="bom-analysis">
        <WorkorderBomDemand v-if="showBomAnalysis" :key="workorderId" :bom-id="data.bomId" :product-id="productId" :product-code="productCode || productId" :product-name="productName || '顶层产出'" :planned-qty="plannedQty || '0'" />
      </el-collapse-item></el-collapse>
    </template>
    <PageDialog v-model="editing" title="维护工单用料" width="min(1220px,96vw)" append-to-body :before-close="closeEditor">
      <WorkorderMaterialEditor v-if="editing" ref="editor" v-model="form" :product-id="productId" :planned-qty="plannedQty || '0'" :disabled="busy" />
      <template #footer><el-button @click="editing=false">取消</el-button><el-button type="primary" :loading="busy" @click="save">保存用料</el-button></template>
    </PageDialog>
  </section>
</template>

<style scoped>
.panel { padding: var(--ui-space-5); }
</style>
