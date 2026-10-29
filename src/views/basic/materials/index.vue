<script setup lang="ts">
import { usePageMessageBox } from '@/lib/pageMessageBox'

import PageDialog from '@/components/page/PageDialog.vue'
import PageDrawer from '@/components/page/PageDrawer.vue'

import { computed, nextTick, onActivated, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import CrudPage from '@/components/CrudPage.vue'
import PageHeader from '@/components/PageHeader.vue'
import DocumentFields from '@/components/document/DocumentFields.vue'
import MaterialBomPanel from '@/components/business/material/MaterialBomPanel.vue'
import UnitMeasureSelect from '@/components/business/material/UnitMeasureSelect.vue'
import { api as materials, sync as syncMaterials } from '@/api/basic/material'
import { tree, type MaterialCategoryVo } from '@/api/basic/materialCategory'
import { api as units } from '@/api/basic/unitMeasure'
import { categoryTree } from '@/lib/materialCategories'
import { commandFromDraft, type CrudApi, type Field, type Row } from '@/lib/crud'
import { useAuth } from '@/stores/auth'
const ElMessageBox = usePageMessageBox()

const auth = useAuth(), page = ref<InstanceType<typeof CrudPage> | null>(null)
const can = (object:'material' | 'category', action:string) => auth.hasPermission('business:material' + (object === 'category' ? ':category' : '') + ':' + action, 'factory')
const categoryRows = ref<MaterialCategoryVo[]>([]), categoryError = ref(''), categoryLoading = ref(false), categoryKeyword = ref('')
const treeRef = ref(), selected = ref('all'), includeDescendants = ref(true), unitNames = ref<Record<string, string>>({}), unitError = ref('')
const editorOpen = ref(false), editorId = ref(''), editorError = ref(''), saving = ref(false)
const draft = reactive<Row>({}), bomMaterial = ref<Row | null>(null), bomPanel = ref<InstanceType<typeof MaterialBomPanel> | null>(null)
const bomKey = ref(0), syncBusy = ref(false)
let generation = 0, categoryGeneration = 0, editRequest = 0, savedDraft = '{}'
const nodes = computed(() => categoryTree(categoryRows.value))
const selectedCategory = computed(() => categoryRows.value.find(row => row.id === selected.value))
const categoryNames = computed(() => Object.fromEntries(categoryRows.value.map(row => [row.id, row.name])))
const workspaceApi = computed<CrudApi>(() => {
  const category = selected.value, descendants = includeDescendants.value
  return { ...materials, list: q => materials.list({ ...q, ...(category === 'all' ? {} : category === 'uncategorized' ? { uncategorized: 'true' } : { categoryId: category, includeDescendants: String(descendants) }) }) }
})
const materialFields = computed<Field[]>(() => [
  { key: 'code', label: '物料编码', kind: 'text', required: true, searchable: true, maxLength: 64, columnMinWidth: 150 },
  { key: 'name', label: '物料名称', kind: 'text', required: true, searchable: true, maxLength: 255, columnMinWidth: 180 },
  { key: 'specification', label: '规格型号', kind: 'text', maxLength: 500, columnMinWidth: 160 },
  { key: 'categoryId', label: '分类', kind: 'text', format: value => value ? categoryNames.value[String(value)] ?? String(value) : '未分类' },
  { key: 'unitId', label: '基本单位', kind: 'text', required: true, format: value => unitNames.value[String(value)] ?? String(value) },
  { key: 'status', label: '状态', kind: 'select', required: true, options: [{ value: 'ENABLED', label: '启用', tone: 'success' }, { value: 'DISABLED', label: '停用', tone: 'info' }] }
])
const editorFields = materialFields
const editorReadonly = computed(() => !can('material', editorId.value ? 'update' : 'create'))
async function loadCategories() {
  if (!can('category', 'list')) return
  const current = ++categoryGeneration;categoryLoading.value = true;categoryError.value = ''
  try { const result = await tree();if (current === categoryGeneration) categoryRows.value = result.items } catch(e) { if (current === categoryGeneration) categoryError.value = e instanceof Error ? e.message : '分类读取失败' } finally { if (current === categoryGeneration) categoryLoading.value = false }
}
async function loadUnitNames() {
  if (!auth.hasPermission('business:unit:measure:list', 'factory')) return
  const current = generation;unitError.value = ''
  try {
    const result:Record<string, string> = {};let offset = 0
    do {
      const data = await units.list({ offset, limit: 100 })
      if (current !== generation) return
      for (const row of data.items) result[row.id] = row.name
      offset += data.items.length
      if (!data.items.length || offset >= data.total || offset >= 1000) break
    } while (offset < 1000)
    unitNames.value = result
  } catch(e) { if (current === generation) unitError.value = e instanceof Error ? e.message : '基本单位名称读取失败' }
}
function resetDraft() { Object.keys(draft).forEach(key => delete draft[key]) }
async function openEditor(row?:Row) {
  if (row ? !can('material', 'query') : !can('material', 'create')) return
  const current = generation;const request = ++editRequest;editorOpen.value = false;editorId.value = '';editorError.value = '';resetDraft()
  if (row) {
    try {
      const data = await materials.detail(String(row.id))
      if (current !== generation || request !== editRequest) return
      Object.assign(draft, data);editorId.value = String(data.id)
    } catch(e) { if (current === generation && request === editRequest) ElMessage.error(e instanceof Error ? e.message : '记录读取失败');return }
  } else Object.assign(draft, { categoryId: selectedCategory.value?.id ?? null, status: 'ENABLED', externalId: null, externalCode: null })
  savedDraft = JSON.stringify(draft);editorOpen.value = true
}
async function closeEditor(done:() => void) {
  if (saving.value) return
  const current = generation
  if (JSON.stringify(draft) !== savedDraft) {
    try { await ElMessageBox.confirm('有未保存的修改，确认放弃？', '未保存的修改', { type: 'warning' }) } catch { return }
  }
  if (current === generation) { editRequest++;editorOpen.value = false;resetDraft();done() }
}
async function save() {
  if (saving.value || editorReadonly.value) return
  for (const field of editorFields.value) if (field.required && (draft[field.key] == null || String(draft[field.key]).trim() === '')) { ElMessage.warning('请填写' + field.label);return }
  const current = generation;const api = materials
  saving.value = true;editorError.value = ''
  try {
    const body = commandFromDraft(editorFields.value, draft, !!editorId.value, 'id')
    body.externalId = draft.externalId ?? null;body.externalCode = draft.externalCode ?? null
    if (editorId.value) await api.update(editorId.value, body);else await api.create(body)
    if (current !== generation) return
    editorOpen.value = false;resetDraft();await loadCategories();await page.value?.load();ElMessage.success('物料已保存')
  } catch(e) { if (current === generation) editorError.value = e instanceof Error ? e.message : '保存失败' } finally { if (current === generation) saving.value = false }
}
function openBom(row:Row) { if (can('material', 'query')) { bomKey.value++;bomMaterial.value = row } }
async function closeBom(done:() => void) {
  const current = generation
  if (bomPanel.value?.hasUnsavedChanges()) { try { await ElMessageBox.confirm('BOM有未保存修改，确认放弃？', '未保存的修改', { type: 'warning' }) } catch { return } }
  if (current === generation) { bomMaterial.value = null;done() }
}
async function sync(kind:'material') {
  if (!can(kind, 'sync') || syncBusy.value) return
  const current = generation;syncBusy.value = true
  try { await syncMaterials();if (current === generation) { await loadCategories();await page.value?.load();ElMessage.success('同步完成') } } catch(e) { if (current === generation) ElMessage.error(e instanceof Error ? e.message : '同步失败') } finally { if (current === generation) syncBusy.value = false }
}
function clear() { generation++;editRequest++;categoryGeneration++;categoryRows.value = [];unitNames.value = {};unitError.value = '';selected.value = 'all';categoryError.value = '';categoryLoading.value = false;editorOpen.value = false;bomMaterial.value = null;saving.value = false;syncBusy.value = false;resetDraft() }
watch(() => [auth.revision, auth.factoryId, auth.factoryPermissions.join('|')], () => { clear();void loadCategories();void loadUnitNames() }, { immediate: true, flush: 'sync' })
watch([selected, nodes], async() => {
  await nextTick()
  treeRef.value?.setCurrentKey(selectedCategory.value?.id ?? null)
}, { flush: 'post' })
watch(categoryKeyword, value => treeRef.value?.filter(value))
onActivated(() => { void loadCategories();void loadUnitNames() })
onBeforeUnmount(clear)
</script>
<template>
  <section class="app-container material-workspace">
    <PageHeader title="物料管理" description="按分类查找物料，维护物料与多阶BOM" />
    <div class="workspace-grid">
      <aside class="panel categories" aria-label="物料分类">
        <div class="table-toolbar"><strong>物料分类</strong><router-link v-if="can('category','list')" to="/basic/materialCategory">管理分类</router-link></div>
        <el-input v-model="categoryKeyword" clearable placeholder="搜索分类" aria-label="搜索分类" />
        <div class="category-scope"><el-button :type="selected==='all'?'primary':'default'" link @click="selected='all'">全部物料</el-button><el-button :type="selected==='uncategorized'?'primary':'default'" link @click="selected='uncategorized'">未分类</el-button></div>
        <el-alert v-if="!can('category','list')" title="没有分类读取权限，仍可读取已授权的物料。" type="info" :closable="false" />
        <el-alert v-if="categoryError" :title="categoryError" type="error" :closable="false" /><el-button v-if="categoryError" link @click="loadCategories">重试分类</el-button>
        <el-tree v-if="can('category','list')" ref="treeRef" v-loading="categoryLoading" :data="nodes" node-key="id" highlight-current default-expand-all :expand-on-click-node="false" :filter-node-method="(value:string,data:any)=>!value || data.label.includes(value)" @node-click="(node:MaterialCategoryVo)=>selected=node.id" />
        <el-empty v-if="!categoryLoading && !categoryError && can('category','list') && !categoryRows.length" description="尚无分类" :image-size="50" />
      </aside>
      <div class="material-content"><el-alert v-if="unitError" :title="unitError" type="error" :closable="false" /><el-button v-if="unitError" link @click="loadUnitNames">重试基本单位名称</el-button>
        <div class="table-toolbar scope-toolbar"><span>{{ selectedCategory?.name ?? (selected==='uncategorized'?'未分类':'全部物料') }}</span><el-checkbox v-if="selectedCategory" v-model="includeDescendants">包含下级分类</el-checkbox></div>
        <CrudPage
          ref="page"
          embedded
          managed-editing
          title="物料"
          table-key="business:materials:workspace"
          permission="business:material"
          permission-scope="factory"
          list-action="list"
          detail-action="query"
          :api="workspaceApi"
          :fields="materialFields"
        >
          <template #toolbar><el-button v-if="can('material','create')" type="primary" icon="Plus" @click="openEditor()">新增物料</el-button><el-button v-if="can('material','sync')" :loading="syncBusy" @click="sync('material')">同步物料</el-button></template>
          <template #actions="{row}"><el-button v-if="can('material','query')" link type="primary" @click="openEditor(row)">维护</el-button><el-button v-if="can('material','query')" link @click="openBom(row)">BOM</el-button></template>
        </CrudPage>
      </div>
    </div>
    <PageDialog v-model="editorOpen" :title="(editorId?'维护':'新增')+'物料'" width="760px" :before-close="closeEditor" destroy-on-close>
      <el-alert v-if="editorError" :title="editorError" type="error" :closable="false" />
      <DocumentFields :fields="editorFields" :draft="draft" :disabled="saving || editorReadonly" @submit="save">
        <template #field-categoryId="{disabled}"><el-tree-select v-model="draft.categoryId as string" :data="nodes" node-key="id" clearable filterable check-strictly :disabled="disabled || !can('category','list')" placeholder="选择分类（可留空）" /></template>
        <template #field-unitId="{disabled}"><UnitMeasureSelect v-model="draft.unitId as string" :disabled="disabled" /></template>
      </DocumentFields>
      <template #footer><el-button @click="closeEditor(()=>{})">关闭</el-button><el-button v-if="!editorReadonly" type="primary" :loading="saving" @click="save">保存</el-button></template>
    </PageDialog>
    <PageDrawer :model-value="!!bomMaterial" title="物料BOM" size="min(1180px, 96vw)" :before-close="closeBom" destroy-on-close>
      <MaterialBomPanel v-if="bomMaterial" :key="bomKey" ref="bomPanel" :material="bomMaterial" :unit-names="unitNames" />
    </PageDrawer>
  </section>
</template>
<style scoped>
.workspace-grid{display:grid;grid-template-columns:260px minmax(0,1fr);gap:16px;align-items:start}.categories{padding:16px;height:calc(100dvh - 220px);min-height:440px;display:flex;flex-direction:column;overflow:hidden}.categories :deep(.el-tree){flex:1;min-height:0;overflow:auto}.categories .table-toolbar,.category-scope{flex-shrink:0}.categories .table-toolbar{justify-content:space-between;gap:8px}.category-scope,.category-actions{display:flex;gap:12px;align-items:center;padding:12px 0}.category-actions{border-top:1px solid var(--el-border-color-light);flex-wrap:wrap}.material-content{min-width:0}.scope-toolbar{padding:10px 16px;background:var(--el-bg-color);gap:16px;margin-bottom:0}.categories :deep(.el-tree-node__label){overflow:hidden;text-overflow:ellipsis}.material-workspace :deep(.form-grid){grid-template-columns:repeat(2,minmax(0,1fr))}@media(max-width:900px){.workspace-grid{grid-template-columns:1fr}.categories{height:320px;min-height:320px}}@media(max-width:640px){.material-workspace :deep(.form-grid){grid-template-columns:1fr}}
</style>
