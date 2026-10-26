<script setup lang="ts">
import { usePageMessageBox } from '@/lib/pageMessageBox'

import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import MasterDetailDocument from '@/components/document/MasterDetailDocument.vue'
import MaterialPicker from './MaterialPicker.vue'
import BomVersionSelect from './BomVersionSelect.vue'
import { bomApi, bomItemApi, structure, transition, type BomGraph } from '@/api/basic/materialBom'
import type { CrudApi, Field, Row } from '@/lib/crud'
import { displayQuantity, quantityColumn } from '@/lib/production/quantity'
import { quantityInputError, normalizedQuantityInput, positiveQuantity } from '@/lib/production/quantityRules'
import { useAuth } from '@/stores/auth'
const ElMessageBox = usePageMessageBox()

function coefficient(raw:unknown) {
  const value = normalizedQuantityInput(String(raw ?? ''))
  const error = quantityInputError(value, {mustBeWholeNumber:false,quantityPrecision:6})
  if (error || !positiveQuantity(value)) throw Error(error || 'BOM数量必须大于零')
  return value
}
const props = defineProps<{ material: Row; unitNames: Record<string, string> }>()
const auth = useAuth(), document = ref<InstanceType<typeof MasterDetailDocument> | null>(null)
const revision = ref(''), graph = ref<BomGraph | null>(null), graphId = ref(''), quantity = ref('1'), error = ref(''), graphLoading = ref(false), acting = ref(false)
let generation = 0
const canUpdate = computed(() => auth.hasPermission('business:material:update', 'factory'))
const headerApi:CrudApi = { ...bomApi,
  list: q => bomApi.list({ ...q, productId: String(props.material.id) }),
  detail: async id => { const row = await bomApi.detail!(id);revision.value = String(row.revision);return row },
  create: async body => { const row = await bomApi.create({ ...body as Row, productId: props.material.id, baseQty: coefficient((body as Row).baseQty) });revision.value = String(row.revision);return row },
  update: async(id, body) => { const row = await bomApi.update(id, { ...body as Row, revision: revision.value, baseQty: coefficient((body as Row).baseQty) });revision.value = String(row.revision);return row }
}
const picker = ref<InstanceType<typeof MaterialPicker> | null>(null)
const materialLabels = ref<Record<string, string>>({})
async function chooseComponent() {
  const selected = await picker.value?.choose()
  if (!selected) return null
  materialLabels.value[String(selected.id)] = String(selected.code) + ' · ' + String(selected.name)
  return { materialId: selected.id, specification: selected.specification, unitName: props.unitNames[String(selected.unitId)] ?? String(selected.unitId) }
}
const itemApi:CrudApi = { ...bomItemApi,
  create: async body => { const result = await bomItemApi.create({ ...body as Row, quantity: coefficient((body as Row).quantity) });clearGraph();return result },
  update: async(id, body) => { const result = await bomItemApi.update(id, { ...body as Row, quantity: coefficient((body as Row).quantity) });clearGraph();return result },
  remove: async id => { await bomItemApi.remove(id);clearGraph() },
  delids: async ids => { await bomItemApi.delids!(ids);clearGraph() },
  list: async query => {
    const result = await bomItemApi.list(query)
    for (const row of result.items) if (row.materialCode && row.materialName) materialLabels.value[String(row.materialId)] = String(row.materialCode) + ' · ' + String(row.materialName)
    return result
  } }

const headerFields:Field[] = [
  { key: 'code', label: 'BOM编码', kind: 'text', required: true, maxLength: 64, searchable: true },
  { key: 'version', label: '版本', kind: 'text', required: true, maxLength: 32, searchable: true },
  { key: 'baseQty', label: '基准产出数量（物料基本单位）', kind: 'decimal', required: true, format: v=>displayQuantity(v as string) },
  { key: 'status', label: '状态', kind: 'select', readonly: true, options: [{ value: 'DRAFT', label: '草稿' }, { value: 'PUBLISHED', label: '已发布' }, { value: 'DISABLED', label: '停用' }] },
  { key: 'remark', label: '备注', kind: 'textarea', maxLength: 500 }
]
const itemFields:Field[] = [
  { key: 'bomId', label: '所属BOM', kind: 'text', required: true },
  { key: 'materialId', label: '组件物料', kind: 'text', required: true, columnMinWidth: 220, format: value => materialLabels.value[String(value)] ?? String(value) },
  { key: 'specification', label: '规格型号', kind: 'text', readonly: true, columnMinWidth: 150 },
  { key: 'unitName', label: '基本单位', kind: 'text', readonly: true, columnMinWidth: 110 },
  { key: 'quantity', label: '标准用量（组件基本单位）', kind: 'decimal', required: true, format: v=>displayQuantity(v as string) },
  { key: 'childBomId', label: '子BOM版本', kind: 'text' },
  { key: 'sort', label: '显示顺序', kind: 'number', required: true, defaultValue: 0 }
]
async function act(row:Row, action:'publish' | 'disable', refresh:() => Promise<void>) {
  const current = generation
  try {
    await ElMessageBox.confirm(action === 'publish' ? '发布后组成与用量不能直接修改，确认发布？' : '停用后不能被新业务选用，已有记录保留。确认停用？', 'BOM版本', { type: 'warning' })
    if (current !== generation || !canUpdate.value) return
    acting.value = true
    await refresh()
    if (current !== generation) return
    await transition(String(row.id), action, String(row.revision))
    if (current === generation) { await refresh(); ElMessage.success(action === 'publish' ? 'BOM已发布' : 'BOM已停用') }
  } catch(e) { if (current === generation && e !== 'cancel' && e !== 'close') ElMessage.error(e instanceof Error ? e.message : '操作失败') } finally { if (current === generation) acting.value = false }
}
async function loadGraph(id = graphId.value) {
  if (!id) return
  const current = ++generation;graphId.value = id;graphLoading.value = true;graph.value = null;error.value = ''
  try { const result = await structure(id, coefficient(quantity.value));if (current === generation) graph.value = result } catch(e) { if (current === generation) error.value = e instanceof Error ? e.message : '组成计算失败' } finally { if (current === generation) graphLoading.value = false }
}
function clearGraph() { graph.value = null;graphId.value = '';error.value = '' }
function clear() { picker.value?.cancel();materialLabels.value = {};generation++;graph.value = null;graphId.value = '';error.value = '';graphLoading.value = false;acting.value = false }
watch(() => [auth.revision, auth.factoryId, props.material.id], clear)
defineExpose({ hasUnsavedChanges: () => document.value?.hasUnsavedChanges() ?? false })
onBeforeUnmount(clear)
</script>
<template>
  <MaterialPicker ref="picker" :unit-names="unitNames" />
  <MasterDetailDocument
    ref="document"
    :title="`BOM · ${material.code} ${material.name}`"
    :header-api="headerApi"
    :item-api="itemApi"
    :item-before-create="chooseComponent"
    :header-fields="headerFields"
    :item-fields="itemFields"
    header-permission="business:material"
    item-permission="business:material"
    :item-permission-overrides="{create:'business:material:update',update:'business:material:update',delete:'business:material:update'}"
    parent-key="bomId"
    header-table-key="material:bom:versions"
    item-table-key="material:bom:components"
    :header-readonly="row=>row.status!=='DRAFT'"
  >
    <template #header-actions="{row,refresh,dirty}">
      <el-button v-if="row.id" :disabled="dirty || acting" @click="refresh">刷新版本</el-button>
      <el-button v-if="row.id" :disabled="dirty" @click="loadGraph(String(row.id))">多阶结构与需求</el-button>
      <el-button v-if="row.id && row.status==='DRAFT' && canUpdate" :disabled="dirty || acting" type="primary" plain @click="act(row,'publish',refresh)">发布</el-button>
      <el-button v-if="row.id && row.status==='PUBLISHED' && canUpdate" :disabled="acting" @click="act(row,'disable',refresh)">停用</el-button>
    </template>
    <template #field-baseQty="{draft,disabled}"><el-input v-model="draft.baseQty" inputmode="decimal" :disabled="disabled" @blur="draft.baseQty=normalizedQuantityInput(String(draft.baseQty))" /><span class="secondary">BOM基准数量，最多六位有效小数</span></template>
    <template #field-quantity="{draft,disabled}"><el-input v-model="draft.quantity" inputmode="decimal" :disabled="disabled" @blur="draft.quantity=normalizedQuantityInput(String(draft.quantity))" /><span class="secondary">用量系数允许小数，不套库存整数限制</span></template>
    <template #field-materialId="{draft,disabled}"><span>{{ materialLabels[String(draft.materialId)] ?? draft.materialId }}</span><el-button :disabled="disabled" link @click="async()=>{const selected=await chooseComponent();if(selected){draft.materialId=selected.materialId;draft.specification=selected.specification;draft.unitName=selected.unitName;draft.childBomId=null}}">选择物料</el-button></template>
    <template #field-childBomId="{draft,disabled}"><BomVersionSelect v-model="draft.childBomId as string" :material-id="draft.materialId as string" :disabled="disabled" /></template>
  </MasterDetailDocument>
  <section v-if="graphId" class="panel graph-panel" aria-label="多阶BOM结构与需求">
    <div class="table-toolbar"><strong>多阶结构与展开需求</strong><el-input v-model="quantity" aria-label="预计产出数量" style="width:160px" /><el-button :loading="graphLoading" @click="loadGraph()">计算</el-button><el-button @click="clear">收起</el-button></div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <p v-if="!graph && !error">正在读取组成结构…</p>
    <template v-if="graph">
      <el-table :data="graph.items" row-key="path" default-expand-all><el-table-column prop="code" label="组件编码" min-width="180" /><el-table-column prop="name" label="组件名称" min-width="160" /><el-table-column :formatter="quantityColumn" prop="quantity" label="本次需求" min-width="130" /><el-table-column prop="unitName" label="基本单位" width="110" /><el-table-column prop="childBomId" label="子BOM版本ID" min-width="120" /></el-table>
      <h3>展开汇总（不产生库存动作）</h3><el-table :data="graph.totals"><el-table-column prop="code" label="物料编码" /><el-table-column prop="name" label="名称" /><el-table-column :formatter="quantityColumn" prop="quantity" label="需求数量" /><el-table-column prop="unitName" label="基本单位" /></el-table>
    </template>
  </section>
</template>
<style scoped>.graph-panel {margin:16px;padding:16px}.graph-panel .table-toolbar{gap:12px;flex-wrap:wrap}h3{font-size:14px;margin:18px 0 10px}</style>
