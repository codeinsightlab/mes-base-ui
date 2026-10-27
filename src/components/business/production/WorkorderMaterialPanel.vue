<script setup lang="ts">
import { usePageMessageBox } from '@/lib/pageMessageBox'

import PageDialog from '@/components/page/PageDialog.vue'

import QuantityText from '@/components/business/production/QuantityText.vue'
import { onBeforeUnmount, reactive, ref, watch } from 'vue'

import { useAuth } from '@/stores/auth'
import MaterialSelect from '@/components/business/MaterialSelect.vue'
import WarehouseSelect from '@/components/business/WarehouseSelect.vue'
import BomVersionSelect from '@/components/business/material/BomVersionSelect.vue'
import UnitMeasureSelect from '@/components/business/material/UnitMeasureSelect.vue'
import { bomApi, defaultBom, type Bom } from '@/api/basic/materialBom'
import { workorderMaterial, type WorkorderMaterial } from '@/api/production/workorderMaterial'
const ElMessageBox = usePageMessageBox()

const props = defineProps<{ workorderId: string; productId: string; readonly?: boolean }>(), auth = useAuth()
const data = ref<WorkorderMaterial | null>(null), bom = ref<Bom | null>(null), selectedBom = ref<Bom | null>(null), bomError = ref(''), defaultError = ref(''), error = ref(''), busy = ref(false), editing = ref(false), defaultLoading = ref(false), defaultResolved = ref(false), defaultExists = ref(false)
const form = reactive({ bomId: null as string | null, warehouseIds: [] as string[], workCenter: '', enabled: true })
const canRead = () => !!auth.factoryId && !auth.factorySwitching && auth.hasPermission('workorder:query', 'factory')
const canWrite = () => canRead() && !props.readonly && auth.hasPermission('workorder:material:update', 'factory')
let generation = 0, bomGeneration = 0, defaultGeneration = 0, defaultSelectionPristine = false, automaticDefaultId: string | null = null
function clear() { generation++; bomGeneration++; defaultGeneration++; data.value = null; bom.value = null; selectedBom.value = null; bomError.value = ''; defaultError.value = ''; defaultLoading.value = false; defaultResolved.value = false; defaultExists.value = false; error.value = ''; busy.value = false; editing.value = false; defaultSelectionPristine = false; automaticDefaultId = null; Object.assign(form, { bomId: null, warehouseIds: [], workCenter: '', enabled: true }) }
async function loadBom() {
  const ticket = ++bomGeneration; bom.value = null; bomError.value = ''
  if (!data.value?.bomId || !auth.hasPermission('business:material:query', 'factory')) return
  try { const value = await bomApi.detail!(data.value.bomId) as Bom; if (ticket === bomGeneration) { if (value.productId === props.productId && value.status === 'PUBLISHED') { bom.value = value; selectedBom.value = value } else bomError.value = '已保存的BOM版本不属于当前产品或已不可用，请刷新工单核对' } } catch(e) { if (ticket === bomGeneration) bomError.value = e instanceof Error ? e.message : 'BOM版本名称读取失败' }
}
function fill(value: WorkorderMaterial) { Object.assign(form, { bomId: value.bomId, warehouseIds: JSON.parse(value.warehouseIds), workCenter: value.workCenter, enabled: value.status === 'ENABLED' }); selectedBom.value = null; if (value.bomId) void loadBom() }
async function loadDefault() {
  const ticket = ++defaultGeneration, context = generation, productId = props.productId
  defaultLoading.value = true; defaultError.value = ''; defaultResolved.value = false
  try {
    const value = await defaultBom(productId)
    if (ticket !== defaultGeneration || context !== generation || productId !== props.productId) return
    defaultResolved.value = true
    defaultExists.value = value !== null
    if (value && value.productId === productId && value.status === 'PUBLISHED') {
      selectedBom.value = value
      if (defaultSelectionPristine && !form.bomId) { defaultSelectionPristine = false; automaticDefaultId = value.id; form.bomId = value.id }
    } else if (value) {
      defaultError.value = '产品默认BOM响应与当前产品不匹配，请刷新重试'
    }
  } catch(e) {
    if (ticket === defaultGeneration && context === generation) defaultError.value = e instanceof Error ? e.message : '默认BOM读取失败'
  } finally { if (ticket === defaultGeneration && context === generation) defaultLoading.value = false }
}
function onBomSelected(value:Bom | null) {
  if (value && value.id === automaticDefaultId) { selectedBom.value = value; return }
  automaticDefaultId = null
  defaultSelectionPristine = false
  defaultGeneration++
  selectedBom.value = value
}
async function load() {
  if (!canRead()) return
  const ticket = ++generation; busy.value = true; error.value = ''
  try { const value = await workorderMaterial.get(props.workorderId); if (ticket !== generation) return; data.value = value; if (value) fill(value); void loadBom() } catch(e) { if (ticket === generation) error.value = e instanceof Error ? e.message : '读取用料失败' } finally { if (ticket === generation) busy.value = false }
}
async function closeEditor(done: () => void) {
  try { await ElMessageBox.confirm('关闭并放弃未保存的用料编辑？', '关闭用料维护', { type: 'warning' }); generation++; busy.value = false; editing.value = false; done() } catch { return }
}
function edit() { if (data.value) fill(data.value); editing.value = true; defaultSelectionPristine = !form.bomId; if (!form.bomId) void loadDefault() }
async function save() {
  if (!canWrite() || busy.value || data.value?.frozenAt) return
  if (!form.bomId) { error.value = '请选择该产出物料的已发布BOM版本'; return }
  if (!selectedBom.value || selectedBom.value.id !== form.bomId || !selectedBom.value.revision) { error.value = '正在核对BOM版本及修订号，请稍后重试'; return }
  const ticket = generation; busy.value = true; error.value = ''
  try {
    const value = await workorderMaterial.save(props.workorderId, { ...form, bomId: form.bomId, warehouseIds: [...form.warehouseIds], expectedRevision: data.value?.revision ?? '0', expectedBomRevision: selectedBom.value.revision })
    if (ticket !== generation) return
    data.value = value; editing.value = false; void loadBom()
  } catch(e) { if (ticket === generation) error.value = (e instanceof Error ? e.message : '保存结果未知') + '；请刷新核对当前版本后继续维护' } finally { if (ticket === generation) busy.value = false }
}
watch(() => [props.workorderId, props.productId, auth.factoryId, auth.revision, auth.factoryPermissions.join('|'), canRead(), canWrite()], () => { clear(); void load() }, { immediate: true, flush: 'sync' })
onBeforeUnmount(clear)
</script>
<template>
  <section class="panel" aria-label="工单BOM用料">
    <div class="table-toolbar"><strong>工单BOM用料</strong><el-button :disabled="busy" @click="load">刷新用料</el-button><el-button v-if="canWrite()" :disabled="busy || !!data?.frozenAt" @click="edit">选择BOM与领料范围</el-button></div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <p v-if="!data?.bomId" class="secondary">尚未选择BOM。下达不会固定用料；首次正式领料前可选择默认版本或人工选择其他已发布版本，服务端按当前计划计算单材料需求。</p>
    <el-descriptions v-if="data" :column="2" border>
      <el-descriptions-item label="BOM版本">{{ bom ? `${bom.code} · ${bom.version}` : data.bomId || '尚未选择' }}</el-descriptions-item>
      <el-descriptions-item label="用料依据">{{ data.frozenAt ? '已固定 · ' + data.frozenAt : '首次正式领料前可调整' }}</el-descriptions-item>
      <el-descriptions-item label="直接材料"><MaterialSelect :model-value="data.materialId" disabled /></el-descriptions-item>
      <el-descriptions-item label="材料基本单位"><UnitMeasureSelect :model-value="data.unitId" disabled /></el-descriptions-item>
      <el-descriptions-item label="BOM标准比例"><QuantityText :value="data.bomBaseQty" /> 产出基本单位 → <QuantityText :value="data.bomComponentQty" /> 材料基本单位</el-descriptions-item>
      <el-descriptions-item label="保存时计划 / 材料需求"><QuantityText :value="data.plannedQty" /> / <QuantityText :value="data.totalRequiredQty" /></el-descriptions-item>
    </el-descriptions>
    <el-alert v-if="bomError" :title="bomError" type="error" :closable="false"><el-button link @click="loadBom">重试BOM名称</el-button></el-alert>
    <PageDialog v-model="editing" title="选择工单BOM用料" width="min(760px,94vw)" append-to-body :before-close="closeEditor">
      <el-form v-if="canWrite()" label-width="120px" :disabled="busy">
        <el-form-item label="已发布BOM"><BomVersionSelect :model-value="form.bomId" :material-id="productId" placeholder="选择默认版本或其他已发布版本" @update:model-value="form.bomId=$event" @selected="onBomSelected" /><el-alert v-if="defaultLoading" title="正在读取产品默认BOM…" type="info" :closable="false" /><el-alert v-if="defaultError" :title="defaultError" type="error" :closable="false"><el-button link :disabled="defaultLoading" @click="void loadDefault()">重试读取默认BOM</el-button></el-alert><el-alert v-else-if="defaultResolved && !defaultExists && !defaultLoading && !form.bomId" title="产品尚未设置默认BOM，可人工选择任一已发布版本。" type="info" :closable="false" /></el-form-item>
        <el-form-item label="允许领料仓库"><WarehouseSelect v-for="(_, index) in form.warehouseIds" :key="index" v-model="form.warehouseIds[index]" source="LOCAL" /><el-button @click="form.warehouseIds.push('')">添加仓库</el-button><el-button :disabled="!form.warehouseIds.length" @click="form.warehouseIds.pop()">移除末项</el-button></el-form-item>
        <el-form-item label="工作中心"><el-input v-model="form.workCenter" maxlength="100" /></el-form-item><el-form-item label="需求启用"><el-switch v-model="form.enabled" /></el-form-item>
        <el-alert title="当前正式领料要求一个直接组件。比例和基本单位取自BOM，累计领料不得超过计划额度；已有正式领料后保留原依据。" type="info" :closable="false" />
        <el-button type="primary" :loading="busy" @click="save">保存工单用料</el-button>
      </el-form>
    </PageDialog>
  </section>
</template>
