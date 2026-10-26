<script setup lang="ts">
import { usePageMessageBox } from '@/lib/pageMessageBox'

import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import CrudPage from '@/components/CrudPage.vue'
import PageHeader from '@/components/PageHeader.vue'
import DocumentFields from './DocumentFields.vue'
import { commandFromDraft } from '@/lib/crud'
import type { CrudApi, Field, Row } from '@/lib/crud'
import { useAuth } from '@/stores/auth'
const ElMessageBox = usePageMessageBox()

const props = withDefaults(defineProps<{
  creatable?: boolean;
  title: string; headerApi: Omit<CrudApi,'create'|'update'> & { create(body:unknown):Promise<Row>; update(id:string,body:unknown):Promise<Row> }; itemApi: CrudApi;
  aggregateApi?: { detail(id:string):Promise<{header:Row;items:Row[]}>; create(body:unknown):Promise<{header:Row;items:Row[]}>; update(id:string,body:unknown):Promise<{header:Row;items:Row[]}> };
  headerFields: Field[]; itemFields: Field[];
  headerPermission: string; itemPermission: string; parentKey: string;
  revisionField?: string;
  validateAggregateItems?: (items:Row[]) => string | null;
  headerTableKey?: string; itemTableKey?: string;
  headerReadonly?: (row: Row) => boolean;
  itemsReadonly?: (row: Row) => boolean;
  itemPermissionOverrides?: Record<string, string>;
  itemsReadonlyWhenDirty?: boolean;
  itemVersionField?: string;
  itemBeforeCreate?: () => Promise<Row | null>;
}>(), { creatable: true })
const auth = useAuth()
const opened = ref(false), id = ref<string | null>(null), loading = ref(false), saving = ref(false), error = ref('')
const draft = reactive<Row>({})
const aggregateItems = ref<Row[]>([])
let generation = 0
let savedDraft = '{}'
const can = (action: string) => auth.hasPermission(props.headerPermission + ':' + action, 'factory')
const readonly = computed(() => !!id.value && !!props.headerReadonly?.(draft))
const writable = computed(() => !readonly.value && (id.value ? can('update') : can('create')))
const fixedValues = computed(() => id.value ? { [props.parentKey]: id.value } : {})
const atomic = computed(() => !!props.aggregateApi)
function snapshot() { return JSON.stringify({ header:draft, items:atomic.value ? aggregateItems.value : [] }) }
function editableItems(items: Row[]) {
  return items.map(item => {
    const result = { ...item }
    for (const field of props.itemFields) {
      const value = result[field.key]
      if (field.kind === 'decimal' && typeof value === 'string' && value.includes('.')) {
        result[field.key] = value.replace(/0+$/, '').replace(/\.$/, '')
      }
    }
    return result
  })
}
function clear() {
  generation++
  opened.value = false
  id.value = null
  loading.value = false
  saving.value = false
  error.value = ''
  Object.keys(draft).forEach(key => delete draft[key])
  aggregateItems.value = []
  savedDraft = snapshot()
}
async function back() {
  const current = generation
  if (snapshot() !== savedDraft) {
    try {
      await ElMessageBox.confirm('主单有未保存的修改，确认返回列表并放弃这些修改？', '未保存的修改', { confirmButtonText: '放弃修改', cancelButtonText: '继续编辑', type: 'warning' })
    } catch { return }
  }
  if (current === generation) clear()
}
async function open(row?: Row) {
  if (row ? !can('query') : props.creatable === false || !can('create')) return
  clear()
  opened.value = true
  if (!row) {
    Object.assign(draft, Object.fromEntries(props.headerFields.filter(f => f.defaultValue !== undefined).map(f => [f.key, f.defaultValue])))
    aggregateItems.value = []
    savedDraft = snapshot()
    return
  }
  const current = generation
  loading.value = true
  try {
    const aggregate = props.aggregateApi ? await props.aggregateApi.detail(String(row.id)) : null
    const result = aggregate?.header ?? (props.headerApi.detail ? await props.headerApi.detail(String(row.id)) : row)
    if (current !== generation) return
    id.value = String(result.id)
    Object.assign(draft, result)
    aggregateItems.value = aggregate ? editableItems(aggregate.items) : []
    savedDraft = snapshot()
  } catch(reason) {
    if (current === generation) error.value = reason instanceof Error ? reason.message : '主单加载失败'
  } finally {
    if (current === generation) loading.value = false
  }
}
async function refresh() {
  if (!id.value || !props.aggregateApi && !props.headerApi.detail) return
  const current = generation
  const aggregate = props.aggregateApi ? await props.aggregateApi.detail(id.value) : null
  const result = aggregate?.header ?? await props.headerApi.detail!(id.value)
  if (current !== generation) return
  Object.assign(draft, result)
  if (aggregate) aggregateItems.value = editableItems(aggregate.items)
  savedDraft = snapshot()
}
async function save() {
  if (!writable.value || loading.value || saving.value) return
  for (const field of props.headerFields.filter(f => !f.readonly && f.required)) {
    if (draft[field.key] == null || String(draft[field.key]).trim() === '') {
      ElMessage.warning('请填写' + field.label)
      return
    }
  }
  if (atomic.value) {
    if (!aggregateItems.value.length) { ElMessage.warning('至少添加一条明细'); return }
    const invalid = props.validateAggregateItems?.(aggregateItems.value)
    if (invalid) { ElMessage.warning(invalid); return }
    for (const [index, item] of aggregateItems.value.entries()) {
      for (const field of props.itemFields.filter(f => f.required)) {
        if (item[field.key] == null || String(item[field.key]).trim() === '') {
          ElMessage.warning(`第${index + 1}行请填写${field.label}`)
          return
        }
      }
    }
  }
  const current = generation
  saving.value = true
  error.value = ''
  try {
    const body = commandFromDraft(props.headerFields, draft, !!id.value, 'id')
    if (id.value && props.revisionField) body[props.revisionField] = draft[props.revisionField]
    const requestItems = aggregateItems.value.map(item => ({
      id: item.id ?? null,
      ...commandFromDraft(props.itemFields, item, false, 'id')
    }))
    const result: Row | { header: Row; items: Row[] } = atomic.value
      ? (id.value ? await props.aggregateApi!.update(id.value, { ...body, items:requestItems }) : await props.aggregateApi!.create({ ...body, items:requestItems }))
      : await (id.value ? props.headerApi.update(id.value, body) : props.headerApi.create(body))
    if (current !== generation) return
    if (atomic.value) {
      const document = result as { header: Row; items: Row[] }
      id.value = String(document.header.id)
      Object.assign(draft, document.header)
      aggregateItems.value = editableItems(document.items)
    } else {
      const header = result as Row
      id.value = String(header.id)
      Object.assign(draft, header)
    }
    savedDraft = snapshot()
    ElMessage.success(atomic.value ? '单据及明细已原子保存' : '主单已保存')
  } catch(reason) {
    if (current === generation) error.value = reason instanceof Error ? reason.message : '主单保存失败'
  } finally {
    if (current === generation) saving.value = false
  }
}
async function remove() {
  if (!id.value || !can('delete') || saving.value) return
  const current = generation, recordId = id.value
  try {
    await ElMessageBox.confirm(atomic.value ? '确认删除当前草稿单据及全部明细？' : '确认删除当前主单？有明细的单据将由服务端拒绝删除。', '删除主单', { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' })
    if (current !== generation || !can('delete')) return
    saving.value = true
    await props.headerApi.remove(recordId)
    if (current === generation) { clear(); ElMessage.success('主单已删除') }
  } catch(reason) {
    if (current === generation && reason !== 'cancel' && reason !== 'close') error.value = reason instanceof Error ? reason.message : '删除失败'
  } finally {
    if (current === generation) saving.value = false
  }
}
watch(() => [auth.revision, auth.factoryId, auth.factoryPermissions.join('|')], clear)
defineExpose({ open, refresh, back, hasUnsavedChanges: () => snapshot() !== savedDraft })
onBeforeUnmount(clear)
</script>
<template>
  <CrudPage
    v-if="!opened"
    :title="title"
    :api="headerApi"
    :fields="headerFields"
    :permission="headerPermission"
    permission-scope="factory"
    list-action="list"
    detail-action="query"
    managed-editing
    :table-key="headerTableKey"
  >
    <template #toolbar><el-button v-if="creatable !== false && can('create')" type="primary" icon="Plus" @click="open()">新增单据</el-button></template>
    <template #actions="{ row }"><el-button v-if="can('query')" text type="primary" @click="open(row)">打开单据</el-button></template>
  </CrudPage>
  <section v-else class="app-container">
    <PageHeader :title="title" :description="id ? '单据编号 ' + id : '新增单据'">
      <template #status><slot name="header-actions" :row="draft" :refresh="refresh" :dirty="snapshot() !== savedDraft" /></template>
      <el-button :disabled="saving" @click="back">返回列表</el-button>
      <el-button v-if="id && !readonly && can('delete')" type="danger" plain :disabled="saving || loading" @click="remove">删除主单</el-button>
      <el-button v-if="writable" type="primary" :loading="saving" :disabled="loading" @click="save">保存主单</el-button>
    </PageHeader>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <section v-loading="loading" class="panel document-header" aria-label="主单信息">
      <h2>主单信息</h2>
      <DocumentFields :fields="headerFields" :draft="draft" :disabled="!writable || loading || saving" @submit="save">
        <template v-for="(_, name) in $slots" #[name]="slotProps"><slot :name="name" v-bind="slotProps" /></template>
      </DocumentFields>
    </section>
    <section class="panel document-items" aria-label="单据明细">
      <h2>单据明细</h2>
      <template v-if="atomic">
        <el-alert v-if="!writable" title="当前单据只读。" type="info" :closable="false" />
        <slot name="items" :items="aggregateItems" :writable="writable && !loading && !saving" :saving="saving" :add="(row: Row) => aggregateItems.push(row)" :remove="(index: number) => aggregateItems.splice(index, 1)" />
      </template>
      <template v-else>
      <el-alert v-if="!id" title="先保存主单，再新增明细。" type="info" :closable="false" />
      <CrudPage
        v-else
        :key="id + (itemVersionField ? ':' + draft[itemVersionField] : '')"
        embedded
        :readonly="readonly || !!itemsReadonly?.(draft) || !!itemsReadonlyWhenDirty && snapshot() !== savedDraft"
        title="明细"
        :api="itemApi"
        :fields="itemFields"
        :permission="itemPermission"
        :permission-overrides="itemPermissionOverrides"
        permission-scope="factory"
        list-action="list"
        detail-action="query"
        :fixed-values="fixedValues"
        :before-create="itemBeforeCreate"
        :table-key="itemTableKey"
      >
        <template v-for="(_, name) in $slots" #[name]="slotProps"><slot :name="name" v-bind="slotProps" /></template>
      </CrudPage>
      </template>
    </section>
  </section>
</template>
<style scoped>
.document-header, .document-items { margin-bottom: 16px; padding: 16px; }
h2 { margin: 0 0 16px; font-size: 16px; }
.document-header :deep(.form-grid) { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 24px; }
.document-header :deep(.el-form-item__content > *) { width: 100%; min-width: 0; }
.document-items :deep(.toolbar) { display: flex; justify-content: flex-start; gap: 8px; margin: 0 0 12px; }
.document-items :deep(.el-table) { width: 100%; }
.document-items :deep(.el-input), .document-items :deep(.el-select), .document-items :deep(.el-date-editor) { width: 100%; }
@media (max-width: 640px) {
  .document-header :deep(.form-grid) { grid-template-columns: minmax(0, 1fr); }
  .document-header :deep(.span-2) { grid-column: auto; }
}
</style>
