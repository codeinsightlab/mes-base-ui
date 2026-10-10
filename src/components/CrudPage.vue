<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import CodeText from '@/components/CodeText.vue'
import RightToolbar from '@/components/RightToolbar/index.vue'
import Pagination from '@/components/Pagination/index.vue'
import { computed, reactive, ref, watch, onMounted, inject } from 'vue'
import { routeLocationKey } from 'vue-router'
import { isPlatformMenu } from '@/lib/menuWorkspaces'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuth } from '@/stores/auth'
import { commandFromDraft, formatValue } from '@/lib/crud'
import type { CrudApi, Field, Row } from '@/lib/crud'
import type { PermissionScope } from '@/lib/request'

const props = withDefaults(defineProps<{
  title: string;
  permission: string;
  permissionScope?: PermissionScope;
  api: CrudApi;
  fields: Field[];
  idKey?: string;
  readonly?: boolean;
  searchable?: boolean
}>(), { idKey: 'id', permissionScope: undefined, searchable: true })
const auth = useAuth()
const route = inject(routeLocationKey, undefined)
const resolvedPermissionScope = computed<PermissionScope>(() => props.permissionScope ??
  (isPlatformMenu(route?.path ?? '/' + props.permission.replaceAll(':', '/')) ? 'platform' : 'factory'))
const rows = ref<Row[]>([]), total = ref(0), page = ref(1), limit = ref(20), loading = ref(false), saving = ref(false),
  error = ref(''), dialog = ref(false), editId = ref<string | null>(null)
const showSearch = ref(true)
const draft = reactive<Row>({}), search = reactive<Record<string, string>>({})
let generation = 0
const columns = computed(() => props.fields.filter(f => !f.hidden && f.kind !== 'password' && f.key !== 'factoryId'))
const searchFields = computed(() => props.searchable ? props.fields.filter(f => f.searchable ?? ['code', 'name'].includes(f.key)) : [])
const editable = computed(() => props.fields.filter(f => !f.readonly && (!f.showWhen || draft[f.showWhen.key] === f.showWhen.value) && !(editId.value && f.kind === 'password')))
const selectedIds = ref<string[]>([])
const deleting = ref(false)
const can = (action: string) => auth.hasPermission(props.permission + ':' + action, resolvedPermissionScope.value)
const writeAllowed = computed(() => editId.value ? can('update') : can('create'))

async function load() {
  const current = ++generation
  selectedIds.value = []
  if (!can('read')) {
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
  if (props.readonly || (row ? !can('update') : !can('create'))) return
  const revision = auth.revision
  error.value = ''
  editId.value = row ? String(row[props.idKey]) : null
  Object.keys(draft).forEach(k => delete draft[k])
  if (row) {
    try {
      const detail = props.api.detail ? await props.api.detail(editId.value!) : row
      if (auth.revision !== revision) return
      Object.assign(draft, detail)
    } catch(e) {
      error.value = e instanceof Error ? e.message : '资源加载失败'
      return
    }
  }
  if (auth.revision !== revision) return
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
  saving.value = true
  try {
    const body = commandFromDraft(props.fields, draft, !!editId.value, props.idKey)
    if (editId.value) {
      await props.api.update(editId.value, body)
    } else {
      await props.api.create(body)
    }
    dialog.value = false
    ElMessage.success('已保存')
    await load()
  } catch(e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  } finally {
    saving.value = false
  }
}

async function remove(row: Row) {
  if (props.readonly || !can('delete')) return
  const revision = auth.revision
  try {
    await ElMessageBox.confirm('删除后无法恢复，请确认当前记录。', '删除确认', {
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
    if (auth.revision !== revision || !can('delete')) return
    await props.api.remove(String(row[props.idKey]))
    if (rows.value.length === 1 && page.value > 1) page.value--
    ElMessage.success('已删除')
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
  const ids = [...selectedIds.value]
  try {
    await ElMessageBox.confirm('确认删除选中的 ' + ids.length + ' 条记录？删除后无法恢复。', '批量删除确认', {
      confirmButtonText: '确认删除', cancelButtonText: '取消', type: 'warning'
    })
    if (auth.revision !== revision || !can('delete')) return
    deleting.value = true
    await props.api.delids(ids)
    if (auth.revision !== revision) return
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

watch(() => can('read'), load)
watch(() => can('delete'), () => { selectedIds.value = [] })

function searchNow() {
  page.value = 1
  load()
}

function reset() {
  Object.keys(search).forEach(k => delete search[k])
  searchNow()
}

watch(() => [props.api, auth.revision], () => {
  generation++
  rows.value = []
  total.value = 0
  dialog.value = false
  editId.value = null
  Object.keys(draft).forEach(k => delete draft[k])
  page.value = 1
  load()
})
onMounted(load)
defineExpose({ load })
</script>
<template>
  <section class="app-container">
    <PageHeader :title="title" />
    <el-form
      v-if="searchFields.length && can('read')"
      v-show="showSearch"
      :inline="true"
      class="filter-panel"
      @submit.prevent="searchNow"
    >
      <el-form-item v-for="field in searchFields" :key="field.key" :label="field.label">
        <el-input v-model="search[field.key]" clearable :placeholder="'请输入'+field.label" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" native-type="submit" icon="Search">查询</el-button>
        <el-button icon="Refresh" @click="reset">重置</el-button>
      </el-form-item>
    </el-form>
    <div class="table-toolbar">
      <el-button v-if="!readonly && can('create')" type="primary" icon="Plus" @click="open()">新增
      </el-button>
      <span v-else class="secondary">{{ readonly ? '只读列表' : '记录列表' }}</span>
      <el-button
        v-if="!readonly && can('delete') && api.delids"
        type="danger"
        icon="Delete"
        :disabled="!selectedIds.length"
        :loading="deleting"
        @click="delids"
      >批量删除</el-button>
      <RightToolbar v-if="searchFields.length && can('read')" v-model:show-search="showSearch" @query-table="load" />
      <el-button v-else-if="can('read')" :loading="loading" icon="Refresh" @click="load">刷新</el-button>
    </div>
    <el-alert v-if="error && can('read')" :title="error" type="error" :closable="false" show-icon class="error">
      <el-button @click="load">重试</el-button>
    </el-alert>
    <el-alert v-if="!can('read')" title="当前范围没有读取权限" type="warning" :closable="false" show-icon />
    <el-table v-if="can('read')" v-loading="loading" :data="rows" :row-key="idKey" size="default" empty-text="暂无记录" style="width:100%" @selection-change="selectRows">
      <el-table-column v-if="!readonly && can('delete') && api.delids" type="selection" width="48" />
      <el-table-column
        v-for="field in columns"
        :key="field.key"
        :label="field.label"
        :prop="field.key"
        :min-width="field.kind==='datetime'?180:field.key===idKey?180:120"
        show-overflow-tooltip
      >
        <template #default="{row}">
          <CodeText v-if="field.key===idKey" :value="row[field.key]" />
          <StatusTag
            v-else-if="field.key==='status'"
            :fallback="field.options?.find(o=>o.value===row[field.key])?.tone"
            :label="field.options?.find(o=>o.value===row[field.key])?.label ?? formatValue(row[field.key],field.kind)"
          />
          <span
            v-else
            :class="{'tabular':field.kind==='decimal'||field.kind==='number'}"
          >{{ formatValue(row[field.key], field.kind)
          }}</span></template>
      </el-table-column>
      <el-table-column v-if="!readonly && (can('update') || can('delete') || $slots.actions)" label="操作" fixed="right" width="180">
        <template #default="{row}">
          <el-button v-if="can('update')" text type="primary" @click="open(row)">编辑</el-button>
          <el-button v-if="can('delete')" text type="danger" @click="remove(row)">删除</el-button>
          <slot name="actions" :row="row" />
        </template>
      </el-table-column>
    </el-table>
    <Pagination
      v-if="can('read')"
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
      width="min(640px,92vw)"
      :close-on-click-modal="!saving"
      :close-on-press-escape="!saving"
      :show-close="!saving"
    >
      <p class="form-caption">基础信息
        <span>{{ resolvedPermissionScope === 'factory' ? '带 * 的字段为必填；工厂身份由当前上下文确定。' : '带 * 的字段为必填；平台对象的范围按字段配置。'
        }}</span></p>
      <el-form label-position="top" class="form-grid" @submit.prevent="save">
        <el-form-item
          v-for="field in editable"
          :key="field.key"
          :label="field.label"
          :required="field.required"
          :class="{'span-2':field.kind==='textarea'||field.key==='remark'}"
        >
          <el-select v-if="field.options" v-model="draft[field.key] as any" placeholder="请选择" clearable>
            <el-option
              v-for="option in field.options"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
          <el-switch v-else-if="field.kind==='boolean'" v-model="draft[field.key] as any" />
          <el-input
            v-else
            v-model="draft[field.key] as any"
            :type="field.kind==='password'?'password':field.kind==='textarea'||field.key==='remark'?'textarea':field.kind==='datetime'?'datetime-local':field.kind==='date'?'date':field.kind==='number'?'number':'text'"
            :inputmode="field.kind==='decimal'?'decimal':undefined"
            :show-password="field.kind==='password'"
            :maxlength="field.maxLength"
            :disabled="!!editId&&field.key===idKey"
            :placeholder="'请输入'+field.label"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="saving" @click="dialog=false">取消</el-button>
        <el-button type="primary" :loading="saving" :disabled="!writeAllowed" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>
