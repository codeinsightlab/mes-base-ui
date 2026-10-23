<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import CrudPage from '@/components/CrudPage.vue'
import PageHeader from '@/components/PageHeader.vue'
import DocumentFields from './DocumentFields.vue'
import { commandFromDraft } from '@/lib/crud'
import type { CrudApi, Field, Row } from '@/lib/crud'
import { useAuth } from '@/stores/auth'

const props = defineProps<{
  title: string; headerApi: CrudApi; itemApi: CrudApi;
  headerFields: Field[]; itemFields: Field[];
  headerPermission: string; itemPermission: string; parentKey: string;
  headerTableKey?: string; itemTableKey?: string;
  headerReadonly?: (row: Row) => boolean;
  itemPermissionOverrides?: Record<string, string>;
  itemsReadonlyWhenDirty?: boolean;
  itemVersionField?: string;
  itemBeforeCreate?: () => Promise<Row | null>;
}>()
const auth = useAuth()
const opened = ref(false), id = ref<string | null>(null), loading = ref(false), saving = ref(false), error = ref('')
const draft = reactive<Row>({})
let generation = 0
let savedDraft = '{}'
const can = (action: string) => auth.hasPermission(props.headerPermission + ':' + action, 'factory')
const readonly = computed(() => !!id.value && !!props.headerReadonly?.(draft))
const writable = computed(() => !readonly.value && (id.value ? can('update') : can('create')))
const fixedValues = computed(() => id.value ? { [props.parentKey]: id.value } : {})
function clear() {
  generation++
  opened.value = false
  id.value = null
  loading.value = false
  saving.value = false
  error.value = ''
  Object.keys(draft).forEach(key => delete draft[key])
  savedDraft = JSON.stringify(draft)
}
async function back() {
  const current = generation
  if (JSON.stringify(draft) !== savedDraft) {
    try {
      await ElMessageBox.confirm('主单有未保存的修改，确认返回列表并放弃这些修改？', '未保存的修改', { confirmButtonText: '放弃修改', cancelButtonText: '继续编辑', type: 'warning' })
    } catch { return }
  }
  if (current === generation) clear()
}
async function open(row?: Row) {
  if (row ? !can('query') : !can('create')) return
  clear()
  opened.value = true
  if (!row) {
    Object.assign(draft, Object.fromEntries(props.headerFields.filter(f => f.defaultValue !== undefined).map(f => [f.key, f.defaultValue])))
    savedDraft = JSON.stringify(draft)
    return
  }
  const current = generation
  loading.value = true
  try {
    const result = props.headerApi.detail ? await props.headerApi.detail(String(row.id)) : row
    if (current !== generation) return
    id.value = String(result.id)
    Object.assign(draft, result)
    savedDraft = JSON.stringify(draft)
  } catch(reason) {
    if (current === generation) error.value = reason instanceof Error ? reason.message : '主单加载失败'
  } finally {
    if (current === generation) loading.value = false
  }
}
async function refresh() {
  if (!id.value || !props.headerApi.detail) return
  const current = generation
  const result = await props.headerApi.detail(id.value)
  if (current !== generation) return
  Object.assign(draft, result)
  savedDraft = JSON.stringify(draft)
}
async function save() {
  if (!writable.value || loading.value || saving.value) return
  for (const field of props.headerFields.filter(f => !f.readonly && f.required)) {
    if (draft[field.key] == null || String(draft[field.key]).trim() === '') {
      ElMessage.warning('请填写' + field.label)
      return
    }
  }
  const current = generation
  saving.value = true
  error.value = ''
  try {
    const body = commandFromDraft(props.headerFields, draft, !!id.value, 'id')
    const result = id.value ? await props.headerApi.update(id.value, body) : await props.headerApi.create(body)
    if (current !== generation) return
    id.value = String(result.id)
    Object.assign(draft, result)
    savedDraft = JSON.stringify(draft)
    ElMessage.success('主单已保存')
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
    await ElMessageBox.confirm('确认删除当前主单？有明细的单据将由服务端拒绝删除。', '删除主单', { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' })
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
defineExpose({ open, refresh, back, hasUnsavedChanges: () => JSON.stringify(draft) !== savedDraft })
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
    <template #toolbar><el-button v-if="can('create')" type="primary" icon="Plus" @click="open()">新增单据</el-button></template>
    <template #actions="{ row }"><el-button v-if="can('query')" text type="primary" @click="open(row)">打开单据</el-button></template>
  </CrudPage>
  <section v-else class="app-container">
    <PageHeader :title="title" :description="id ? '单据编号 ' + id : '新增单据'">
      <el-button :disabled="saving" @click="back">返回列表</el-button>
      <el-button v-if="id && !readonly && can('delete')" type="danger" plain :disabled="saving || loading" @click="remove">删除主单</el-button>
      <slot name="header-actions" :row="draft" :refresh="refresh" :dirty="JSON.stringify(draft) !== savedDraft" />
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
      <el-alert v-if="!id" title="先保存主单，再新增明细。" type="info" :closable="false" />
      <CrudPage
        v-else
        :key="id + (itemVersionField ? ':' + draft[itemVersionField] : '')"
        embedded
        :readonly="readonly || !!itemsReadonlyWhenDirty && JSON.stringify(draft) !== savedDraft"
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
    </section>
  </section>
</template>
<style scoped>
.document-header, .document-items { margin-bottom: 16px; padding: 16px; }
h2 { margin: 0 0 16px; font-size: 16px; }
.document-header :deep(.form-grid) { grid-template-columns: repeat(3, minmax(0, 1fr)); }
@media (max-width: 1280px) {
  .document-header :deep(.form-grid) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 640px) {
  .document-header :deep(.form-grid) { grid-template-columns: minmax(0, 1fr); }
  .document-header :deep(.span-2) { grid-column: auto; }
}
</style>
