<script setup lang="ts">
import { usePageMessageBox } from '@/lib/pageMessageBox'

import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import MasterDetailDocument from '@/components/document/MasterDetailDocument.vue'
import QuantityInput from './QuantityInput.vue'
import { bomRatio } from '@/lib/bomRatio'
import MaterialPicker from './MaterialPicker.vue'
import BomVersionSelect from './BomVersionSelect.vue'
import { bomApi, bomItemApi, copyBom, setDefaultBom, structure, transition, type BomGraph } from '@/api/basic/materialBom'
import type { CrudApi, Field, Row } from '@/lib/crud'
import { displayQuantity, quantityColumn } from '@/lib/production/quantity'
import { useAuth } from '@/stores/auth'
const ElMessageBox = usePageMessageBox()

const props = defineProps<{ material: Row; unitNames: Record<string, string> }>()
const auth = useAuth(), document = ref<InstanceType<typeof MasterDetailDocument> | null>(null)
const revision = ref(''), graph = ref<BomGraph | null>(null), graphId = ref(''), quantity = ref('1'), error = ref(''), graphLoading = ref(false), acting = ref(false)
const quantityValid = ref(false)
let initialGraphPending = false
let generation = 0
const canUpdate = computed(() => auth.hasPermission('business:material:update', 'factory'))
const canCreate = computed(() => auth.hasPermission('business:material:create', 'factory'))
const canCopy = computed(() => canCreate.value && auth.hasPermission('business:material:query', 'factory'))
const headerApi:CrudApi = { ...bomApi,
  list: q => bomApi.list({ ...q, productId: String(props.material.id) }),
  detail: async id => { const row = await bomApi.detail!(id);revision.value = String(row.revision);return row },
  create: async body => { const row = await bomApi.create({ ...body as Row, productId: props.material.id, baseQty: bomRatio((body as Row).baseQty) });revision.value = String(row.revision);return row },
  update: async(id, body) => { const row = await bomApi.update(id, { ...body as Row, revision: revision.value, baseQty: bomRatio((body as Row).baseQty) });revision.value = String(row.revision);return row }
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
  create: async body => { const result = await bomItemApi.create({ ...body as Row, quantity: bomRatio((body as Row).quantity) });clearGraph();return result },
  update: async(id, body) => { const row = body as Row;const result = await bomItemApi.update(id, { materialId: row.materialId, quantity: bomRatio(row.quantity), childBomId: row.childBomId, sort: row.sort });clearGraph();return result },
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
  { key: 'defaultVersion', label: '产品默认版本', kind: 'text', readonly: true, format: value => value ? '默认' : '—' },
  { key: 'baseQty', label: '基准产出数量（物料基本单位）', kind: 'decimal', required: true, format: v => displayQuantity(v as string) },
  { key: 'status', label: '状态', kind: 'select', readonly: true, options: [{ value: 'DRAFT', label: '草稿' }, { value: 'PUBLISHED', label: '已发布' }, { value: 'DISABLED', label: '停用' }] },
  { key: 'remark', label: '备注', kind: 'textarea', maxLength: 500 }
]
const itemFields:Field[] = [
  { key: 'bomId', label: '所属BOM', kind: 'text', required: true },
  { key: 'materialId', label: '组件物料', kind: 'text', required: true, columnMinWidth: 220, format: value => materialLabels.value[String(value)] ?? String(value) },
  { key: 'specification', label: '规格型号', kind: 'text', readonly: true, columnMinWidth: 150 },
  { key: 'unitName', label: '基本单位', kind: 'text', readonly: true, columnMinWidth: 110 },
  { key: 'quantity', label: '标准用量（组件基本单位）', kind: 'decimal', required: true, format: v => displayQuantity(v as string) },
  { key: 'childBomId', label: '子BOM版本', kind: 'text' },
  { key: 'sort', label: '显示顺序', kind: 'number', required: true, defaultValue: 0 }
]
async function act(row:Row, action:'publish' | 'disable' | 'enable', refresh:() => Promise<void>) {
  const current = generation
  try {
    const message = action === 'publish' ? '发布后组成与用量不能直接修改，确认发布？' : action === 'enable' ? '启用前将重新校验BOM组成，确认启用？' : '停用后不能被新业务选用，已有记录保留。确认停用？'
    await ElMessageBox.confirm(message, 'BOM版本', { type: 'warning' })
    if (current !== generation || !canUpdate.value) return
    acting.value = true
    await refresh()
    if (current !== generation) return
    await transition(String(row.id), action, String(row.revision))
    if (current === generation) { await refresh(); ElMessage.success(action === 'publish' ? 'BOM已发布' : action === 'enable' ? 'BOM已启用' : 'BOM已停用') }
  } catch(e) { if (current === generation && e !== 'cancel' && e !== 'close') ElMessage.error(e instanceof Error ? e.message : '操作失败') } finally { if (current === generation) acting.value = false }
}
async function copyVersion(row:Row, refresh:() => Promise<void>) {
  if (acting.value || !canCopy.value) return
  let current = generation
  try {
    acting.value = true
    await refresh()
    if (current !== generation || !canCopy.value) return
    const result = await ElMessageBox.prompt('请输入新版本号。原版本和组件保持不变，新版本将保存为草稿。', '复制BOM版本', {
      inputPlaceholder: '新版本号', inputValidator: value => !!value && !!value.trim() && value.length <= 32 || '请输入不超过32字符的新版本号',
      confirmButtonText: '复制为草稿', cancelButtonText: '取消'
    })
    if (current !== generation || !canCopy.value) return
    const copied = await copyBom(String(row.id), result.value.trim(), String(row.revision))
    if (current !== generation || !canCopy.value) return
    clearGraph()
    current = generation
    acting.value = true
    await document.value?.open(copied)
    if (current === generation) ElMessage.success('已复制为草稿，可修改后发布')
  } catch(e) { if (current === generation && e !== 'cancel' && e !== 'close') ElMessage.error(e instanceof Error ? e.message : '复制失败') } finally { if (current === generation) acting.value = false }
}
async function makeDefault(row:Row, refresh:() => Promise<void>) {
  const current = generation
  if (acting.value || row.status !== 'PUBLISHED' || row.defaultVersion === true || !canUpdate.value) return
  try {
    await ElMessageBox.confirm('设为默认只影响之后首次维护的工单用料；已有工单版本和冻结依据不会改变。确认设为默认？', '产品默认BOM版本', { type: 'info' })
    if (current !== generation || !canUpdate.value) return
    acting.value = true
    await refresh()
    if (current !== generation) return
    await setDefaultBom(String(row.id), String(row.revision))
    if (current === generation) { await refresh(); ElMessage.success('产品默认BOM版本已更新') }
  } catch(e) { if (current === generation && e !== 'cancel' && e !== 'close') ElMessage.error(e instanceof Error ? e.message : '设置默认版本失败') } finally { if (current === generation) acting.value = false }
}
function openGraph(id:string) {
  graphId.value = id
  initialGraphPending = true
  if (quantityValid.value) acceptQuantityValidity(true)
}
function acceptQuantityValidity(valid:boolean) {
  quantityValid.value = valid
  if (valid && initialGraphPending) {
    initialGraphPending = false
    void loadGraph()
  }
}
async function loadGraph(id = graphId.value) {
  if (!id || !quantityValid.value) return
  const current = ++generation;graphId.value = id;graphLoading.value = true;graph.value = null;error.value = ''
  try { const result = await structure(id, bomRatio(quantity.value));if (current === generation) graph.value = result } catch(e) { if (current === generation) error.value = e instanceof Error ? e.message : '组成计算失败' } finally { if (current === generation) graphLoading.value = false }
}
function clearGraph() { initialGraphPending = false;quantityValid.value = false;generation++;graphLoading.value = false;graph.value = null;graphId.value = '';error.value = '' }
function clear() { initialGraphPending = false;quantityValid.value = false;picker.value?.cancel();materialLabels.value = {};generation++;graph.value = null;graphId.value = '';error.value = '';graphLoading.value = false;acting.value = false }
watch(() => [auth.revision, auth.factoryId, auth.factorySwitching, auth.token, auth.userId, auth.factoryPermissions.join('|'), props.material.id], clear)
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
    hide-item-refresh
    :header-readonly="row=>row.status!=='DRAFT'"
    @back="clearGraph"
  >
    <template #header-list-actions="{row}"><el-button v-if="canCopy" :disabled="acting" text type="primary" @click="copyVersion(row, async()=>{})">复制为草稿</el-button></template>
    <template #header-actions="{row,refresh,dirty}">
      <el-button v-if="row.id && canCopy" :disabled="dirty || acting" @click="copyVersion(row,refresh)">复制为草稿</el-button>
      <el-button v-if="row.id" :disabled="dirty" @click="openGraph(String(row.id))">多阶结构与需求</el-button>
      <el-button v-if="row.id && row.status==='DRAFT' && canUpdate" :disabled="dirty || acting" type="primary" plain @click="act(row,'publish',refresh)">发布</el-button>
      <el-button v-if="row.id && row.status==='PUBLISHED' && row.defaultVersion!==true && canUpdate" :disabled="dirty || acting" @click="makeDefault(row,refresh)">设为默认</el-button>
      <el-tag v-if="row.id && row.defaultVersion===true" type="success">产品默认版本</el-tag>
      <el-button v-if="row.id && row.status==='PUBLISHED' && canUpdate" :disabled="acting" @click="act(row,'disable',refresh)">停用</el-button>
      <el-button v-if="row.id && row.status==='DISABLED' && canUpdate" :disabled="dirty || acting" @click="act(row,'enable',refresh)">启用</el-button>
    </template>
    <template #field-baseQty="{draft,disabled}"><QuantityInput v-model="draft.baseQty" semantic="bom-ratio" show-unit :material-id="String(material.id)" :disabled="disabled" /><span class="secondary">BOM基准数量，最多六位有效小数</span></template>
    <template #field-quantity="{draft,disabled}"><QuantityInput v-model="draft.quantity" semantic="bom-ratio" show-unit :material-id="draft.materialId as string" :disabled="disabled" /><span class="secondary">用量系数允许小数，不套库存整数限制</span></template>
    <template #field-materialId="{draft,disabled}"><span>{{ materialLabels[String(draft.materialId)] ?? draft.materialId }}</span><el-button :disabled="disabled" link @click="async()=>{const selected=await chooseComponent();if(selected){draft.materialId=selected.materialId;draft.specification=selected.specification;draft.unitName=selected.unitName;draft.childBomId=null}}">选择物料</el-button></template>
    <template #field-childBomId="{draft,disabled}"><BomVersionSelect v-model="draft.childBomId as string" :material-id="draft.materialId as string" :disabled="disabled" /></template>
  </MasterDetailDocument>
  <section v-if="graphId" class="panel graph-panel" aria-label="多阶BOM结构与需求">
    <div class="table-toolbar"><strong>多阶结构与展开需求</strong><QuantityInput v-model="quantity" positive required show-unit :material-id="String(material.id)" aria-label="预计产出数量" style="width:240px" @validity="acceptQuantityValidity" /><el-button :loading="graphLoading" :disabled="!quantityValid || graphLoading" @click="loadGraph()">计算</el-button><el-button @click="clear">收起</el-button></div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <p v-if="!graph && !error">{{ graphLoading ? '正在读取组成结构…' : '请输入符合物料单位规则的产出数量后计算' }}</p>
    <template v-if="graph">
      <el-table :data="graph.items" row-key="path" default-expand-all><el-table-column prop="code" label="组件编码" min-width="180" /><el-table-column prop="name" label="组件名称" min-width="160" /><el-table-column :formatter="quantityColumn" prop="quantity" label="本次需求" min-width="130" /><el-table-column prop="unitName" label="基本单位" width="110" /><el-table-column prop="childBomId" label="子BOM版本ID" min-width="120" /></el-table>
      <h3>展开汇总（不产生库存动作）</h3><el-table :data="graph.totals"><el-table-column prop="code" label="物料编码" /><el-table-column prop="name" label="名称" /><el-table-column :formatter="quantityColumn" prop="quantity" label="需求数量" /><el-table-column prop="unitName" label="基本单位" /></el-table>
    </template>
  </section>
</template>
<style scoped>.graph-panel {margin:16px;padding:16px}.graph-panel .table-toolbar{gap:12px;flex-wrap:wrap}h3{font-size:14px;margin:18px 0 10px}</style>
