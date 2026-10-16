<script setup lang="ts">
import ColumnSettings from '@/components/ColumnSettings.vue'
import { useTableColumns } from '@/lib/useTableColumns'
import { tableRouteUrl } from '@/lib/tableColumns'
import PageHeader from '@/components/PageHeader.vue'
import DocumentFields from '@/components/document/DocumentFields.vue'
import StatusTag from '@/components/StatusTag.vue'
import CodeText from '@/components/CodeText.vue'
import RightToolbar from '@/components/RightToolbar/index.vue'
import Pagination from '@/components/Pagination/index.vue'
import { computed, reactive, ref, watch, onMounted, onBeforeUnmount, inject } from 'vue'
import { routeLocationKey } from 'vue-router'
import { isPlatformMenu } from '@/lib/menuWorkspaces'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuth } from '@/stores/auth'
import { commandFromDraft, formatValue } from '@/lib/crud'
import type { CrudApi, Field, Row } from '@/lib/crud'
import type { PermissionScope } from '@/lib/request'

const props = withDefaults(defineProps<{
  embedded?: boolean;
  managedEditing?: boolean;
  editorWidth?: string;
  actionColumnWidth?: number;
  editorAccess?: boolean;
  keepEditorOpen?: boolean;
  editorDirty?: boolean;
  editorBusy?: boolean;
  saveLabel?: string;
  fixedValues?: Record<string, string>;
  tableKey?: string;
  tableConfigUrl?: string;
  title: string;
  permission: string;
  permissionScope?: PermissionScope;
  listAction?: string;
  detailAction?: string;
  api: CrudApi;
  fields: Field[];
  idKey?: string;
  readonly?: boolean;
  searchable?: boolean
}>(), { idKey: 'id', fixedValues: undefined, permissionScope: undefined, searchable: true, listAction: 'read', detailAction: 'read' })
const emit = defineEmits<{ changed: [] }>()
const auth = useAuth()
const route = inject(routeLocationKey, undefined)
const resolvedPermissionScope = computed<PermissionScope>(() => props.permissionScope ??
  (isPlatformMenu(route?.path ?? '/' + props.permission.replaceAll(':', '/')) ? 'platform' : 'factory'))
const rows = ref<Row[]>([]), total = ref(0), page = ref(1), limit = ref(20), loading = ref(false), saving = ref(false),
  error = ref(''), dialog = ref(false), editId = ref<string | null>(null)
const showSearch = ref(true)
const draft = reactive<Row>({}), search = reactive<Record<string, string>>({})
let generation = 0, contextGeneration = 0
let savedDraft = ''
const defaultColumns = computed(() => props.fields.filter(f => !f.hidden && !(f.key in (props.fixedValues ?? {})) && f.kind !== 'password' && f.key !== 'factoryId'))
const columnSettings = useTableColumns(defaultColumns, () => props.tableKey, () => tableRouteUrl(route, props.tableConfigUrl))
const columns = columnSettings.columns
const searchFields = computed(() => props.searchable ? props.fields.filter(f => !(f.key in (props.fixedValues ?? {})) && (f.searchable ?? ['code', 'name'].includes(f.key))) : [])
const editable = computed(() => props.fields.filter(f => !f.readonly && !(f.key in (props.fixedValues ?? {})) && (!f.showWhen || draft[f.showWhen.key] === f.showWhen.value) && !(editId.value && f.kind === 'password')))
const selectedIds = ref<string[]>([])
const deleting = ref(false)
watch(() => columns.value.map(column => column.key).join('|'), () => { selectedIds.value = [] })
const can = (action: string) => auth.hasPermission(props.permission + ':' + action, resolvedPermissionScope.value)
const writeAllowed = computed(() => editId.value ? can('update') : can('create'))

async function load() {
  const current = ++generation
  selectedIds.value = []
  if (!can(props.listAction)) {
    rows.value = []
    total.value = 0
    error.value = ''
    loading.value = false
    return
  }
  loading.value = true
  error.value = ''
  try {
    const q: Record<string, string | number> = { offset: (page.value - 1) * limit.value, limit: limit.value }
    for (const [k, v] of Object.entries(search)) if (v.trim()) q[k] = v.trim()
    Object.assign(q, props.fixedValues)
    const result = await props.api.list(q)
    if (current !== generation) return
    if (!result || !Array.isArray(result.items) || typeof result.total !== 'number') {
      throw new Error('列表响应格式无效')
    }
    rows.value = result.items
    total.value = result.total
  } catch(e) {
    if (current === generation) {
      rows.value = []
      total.value = 0
      error.value = e instanceof Error ? e.message : '加载失败'
    }
  } finally {
    if (current === generation) loading.value = false
  }
}

async function open(row?: Row) {
  if (props.readonly || props.managedEditing || (row ? (!can('update') && !props.editorAccess) || !can(props.detailAction) : !can('create'))) return
  const revision = auth.revision
  const context = contextGeneration
  error.value = ''
  editId.value = row ? String(row[props.idKey]) : null
  Object.keys(draft).forEach(k => delete draft[k])
  if (!row) Object.assign(draft, Object.fromEntries(props.fields.filter(field => field.defaultValue !== undefined).map(field => [field.key, field.defaultValue])))
  if (row) {
    try {
      const detail = props.api.detail ? await props.api.detail(editId.value!) : row
      if (auth.revision !== revision || context !== contextGeneration) return
      Object.assign(draft, detail)
    } catch(e) {
      error.value = e instanceof Error ? e.message : '资源加载失败'
      return
    }
  }
  if (auth.revision !== revision || context !== contextGeneration) return
  Object.assign(draft, props.fixedValues)
  savedDraft = JSON.stringify(draft)
  dialog.value = true
}

async function save() {
  if (!writeAllowed.value || saving.value) return
  for (const field of editable.value) {
    if (field.required && (draft[field.key] === null || draft[field.key] === undefined || String(draft[field.key]).trim() === '')) {
      ElMessage.warning('请填写' + field.label)
      return
    }
  }
  const revision = auth.revision
  const context = contextGeneration
  const scopeValues = JSON.stringify(props.fixedValues)
  saving.value = true
  try {
    const body = { ...commandFromDraft(props.fields, draft, !!editId.value, props.idKey), ...props.fixedValues }
    if (editId.value) {
      await props.api.update(editId.value, body)
    } else {
      await props.api.create(body)
    }
    if (auth.revision !== revision || context !== contextGeneration || JSON.stringify(props.fixedValues) !== scopeValues) return
    if (props.keepEditorOpen && editId.value) {
      savedDraft = JSON.stringify(draft)
    } else dialog.value = false
    ElMessage.success('已保存')
    emit('changed')
    await load()
  } catch(e) {
    if (auth.revision === revision && context === contextGeneration && JSON.stringify(props.fixedValues) === scopeValues) ElMessage.error(e instanceof Error ? e.message : '保存失败')
  } finally {
    if (context === contextGeneration) saving.value = false
  }
}

async function remove(row: Row) {
  if (props.readonly || !can('delete')) return
  const revision = auth.revision
  const context = contextGeneration
  try {
    await ElMessageBox.confirm('删除后无法恢复，请确认当前记录。', '删除确认', {
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
    if (auth.revision !== revision || context !== contextGeneration || !can('delete')) return
    await props.api.remove(String(row[props.idKey]))
    if (auth.revision !== revision || context !== contextGeneration) return
    if (rows.value.length === 1 && page.value > 1) page.value--
    ElMessage.success('已删除')
    emit('changed')
    await load()
  } catch(e) {
    if (e === 'cancel' || e === 'close') return
    ElMessage.error(e instanceof Error ? e.message : '删除失败')
  }
}

function selectRows(selection: Row[]) {
  selectedIds.value = selection.map(row => String(row[props.idKey]))
}

async function delids() {
  if (props.readonly || !can('delete') || !props.api.delids || !selectedIds.value.length || deleting.value) return
  const revision = auth.revision
  const context = contextGeneration
  const ids = [...selectedIds.value]
  try {
    await ElMessageBox.confirm('确认删除选中的 ' + ids.length + ' 条记录？删除后无法恢复。', '批量删除确认', {
      confirmButtonText: '确认删除', cancelButtonText: '取消', type: 'warning'
    })
    if (auth.revision !== revision || context !== contextGeneration || !can('delete')) return
    deleting.value = true
    await props.api.delids(ids)
    if (auth.revision !== revision || context !== contextGeneration) return
    if (ids.length === rows.value.length && page.value > 1) page.value--
    ElMessage.success('已批量删除')
    await load()
  } catch(e) {
    if (e === 'cancel' || e === 'close') return
    ElMessage.error(e instanceof Error ? e.message : '批量删除失败')
  } finally {
    deleting.value = false
  }
}

watch(() => can(props.listAction), load)
watch(() => can('delete'), () => {
  selectedIds.value = []
})

function searchNow() {
  page.value = 1
  load()
}

function reset() {
  Object.keys(search).forEach(k => delete search[k])
  searchNow()
}

watch(() => [props.api, JSON.stringify(props.fixedValues), auth.revision], () => {
  generation++
  contextGeneration++
  saving.value = false
  rows.value = []
  total.value = 0
  dialog.value = false
  editId.value = null
  Object.keys(draft).forEach(k => delete draft[k])
  page.value = 1
  load()
})
async function closeEditor(done: () => void = () => { dialog.value = false }) {
  if (saving.value || props.editorBusy) return
  const context = contextGeneration
  if (props.editorDirty || JSON.stringify(draft) !== savedDraft) {
    try { await ElMessageBox.confirm('尚有未保存的编辑，是否放弃？', '关闭编辑', { type: 'warning' }) } catch { return }
  }
  if (context !== contextGeneration) return
  done()
}
onBeforeUnmount(() => { generation++; contextGeneration++ })
onMounted(load)
defineExpose({ load })
</script>
<template>
  <section :class="embedded ? 'document-lines' : 'app-container'">
    <PageHeader v-if="!embedded" :title="title" />
    <el-form
      v-if="searchFields.length && can(props.listAction)"
      v-show="showSearch"
      :inline="true"
      class="filter-panel"
      @submit.prevent="searchNow"
    >
      <el-form-item v-for="field in searchFields" :key="field.key" :label="field.label">
        <slot :name="`search-${field.key}`" :search="search" :field="field">
          <el-select v-if="field.options" v-model="search[field.key]" clearable :placeholder="'请选择'+field.label">
            <el-option v-for="option in field.options" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>
          <el-input v-else v-model="search[field.key]" clearable :placeholder="'请输入'+field.label" />
        </slot>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" native-type="submit" icon="Search">查询</el-button>
        <el-button icon="Refresh" @click="reset">重置</el-button>
      </el-form-item>
    </el-form>
    <div class="table-toolbar">
      <el-button v-if="!readonly && !managedEditing && can('create')" type="primary" icon="Plus" @click="open()">新增
      </el-button>
      <span v-else-if="!$slots.toolbar" class="secondary">{{ readonly ? '只读列表' : '记录列表' }}</span>
      <el-button
        v-if="!readonly && can('delete') && api.delids"
        type="danger"
        icon="Delete"
        :disabled="!selectedIds.length"
        :loading="deleting"
        @click="delids"
      >批量删除
      </el-button>
      <slot name="toolbar" />
      <ColumnSettings v-if="tableKey && can(props.listAction)" :controller="columnSettings" />
      <RightToolbar v-if="searchFields.length && can(props.listAction)" v-model:show-search="showSearch" @query-table="load" />
      <el-button v-else-if="can(props.listAction)" :loading="loading" icon="Refresh" @click="load">刷新</el-button>
    </div>
    <el-alert
      v-if="tableKey && columnSettings.state.error && !columnSettings.state.open && can(props.listAction)"
      :title="columnSettings.state.error"
      type="warning"
      :closable="false"
      show-icon
    />
    <el-alert v-if="error && can(props.listAction)" :title="error" type="error" :closable="false" show-icon class="error">
      <el-button @click="load">重试</el-button>
    </el-alert>
    <el-alert v-if="!can(props.listAction)" title="当前范围没有读取权限" type="warning" :closable="false" show-icon />
    <el-table
      v-if="can(props.listAction)"
      :key="columns.map(column => column.key).join('|')"
      v-loading="loading"
      :data="rows"
      :row-key="idKey"
      size="default"
      empty-text="暂无记录"
      style="width:100%"
      @selection-change="selectRows"
    >
      <el-table-column v-if="!readonly && can('delete') && api.delids" type="selection" width="48" />
      <el-table-column
        v-for="field in columns"
        :key="field.key"
        :label="field.label"
        :prop="field.key"
        :fixed="field.columnFixed"
        :min-width="field.columnMinWidth ?? (field.kind==='datetime'?180:field.key===idKey?180:120)"
        show-overflow-tooltip
      >
        <template #default="{row}">
          <slot :name="`cell-${field.key}`" :row="row" :field="field">
          <CodeText v-if="field.key===idKey" :value="row[field.key]" />
          <StatusTag
            v-else-if="field.key==='status'"
            :fallback="field.options?.find(o=>o.value===row[field.key])?.tone"
            :label="field.options?.find(o=>o.value===row[field.key])?.label ?? formatValue(row[field.key],field.kind)"
          />
          <span
            v-else
            :class="{'tabular':field.kind==='decimal'||field.kind==='number'}"
          >{{ field.options?.find(option => String(option.value) === String(row[field.key]))?.label ?? formatValue(row[field.key], field.kind)
          }}</span>
          </slot></template>
      </el-table-column>
      <el-table-column
        v-if="$slots.actions || (!readonly && (can('update') || editorAccess || can('delete')))"
        label="操作"
        fixed="right"
        :width="actionColumnWidth ?? 180"
      >
        <template #default="{row}">
          <el-button v-if="!readonly && !managedEditing && (can('update') || editorAccess)" text type="primary" @click="open(row)">编辑</el-button>
          <el-button v-if="!readonly && can('delete')" text type="danger" @click="remove(row)">删除</el-button>
          <slot name="actions" :row="row" />
        </template>
      </el-table-column>
    </el-table>
    <Pagination
      v-if="can(props.listAction)"
      v-model:page="page"
      v-model:limit="limit"
      :total="total"
      :page-sizes="[10,20,50,100]"
      :auto-scroll="false"
      @pagination="load"
    />
    <el-dialog
      v-model="dialog"
      :title="editId?'编辑'+title:'新增'+title"
      :width="editorWidth || 'min(640px,92vw)'"
      destroy-on-close
      :before-close="closeEditor"
      :close-on-click-modal="!saving && !editorBusy"
      :close-on-press-escape="!saving && !editorBusy"
      :show-close="!saving && !editorBusy"
    >
      <slot v-if="dialog" name="editor" :draft="draft" :edit-id="editId" :fields="editable" :saving="saving" :readonly="!writeAllowed" :save="save">
      <p class="form-caption">基础信息
        <span>{{ resolvedPermissionScope === 'factory' ? '带 * 的字段为必填；工厂身份由当前上下文确定。' : '带 * 的字段为必填；平台对象的范围按字段配置。'
        }}</span></p>
      <DocumentFields :fields="editable" :draft="draft" :disabled="saving || !writeAllowed" :disabled-keys="editId ? [idKey] : []" @submit="save">
        <template v-for="(_, name) in $slots" #[name]="slotProps"><slot :name="name" v-bind="slotProps" /></template>
      </DocumentFields>
      </slot>
      <template #footer>
        <el-button :disabled="saving || editorBusy" @click="closeEditor()">{{ keepEditorOpen ? '关闭' : '取消' }}</el-button>
        <el-button type="primary" :loading="saving" :disabled="!writeAllowed || editorBusy" @click="save">{{ saveLabel || '保存' }}</el-button>
      </template>
    </el-dialog>
  </section>
</template>
