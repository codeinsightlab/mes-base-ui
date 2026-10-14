<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useAuth } from '@/stores/auth'
import { api as itemApi, type MesMaterialIssueItemVo } from '@/api/issue/mesMaterialIssueItem'
import { formatValue, type CrudApi, type Field, type Row } from '@/lib/crud'

const props = defineProps<{ id: string; api: CrudApi; fields: Field[]; permission: string; withItems?: boolean }>()
const auth = useAuth()
const visible = ref(false), loading = ref(false), error = ref('')
const row = ref<Row | null>(null), items = ref<MesMaterialIssueItemVo[]>([])
const page = ref(1), total = ref(0)
let generation = 0
async function show() {
  if (!auth.hasPermission(props.permission, 'factory') || !props.api.detail) return
  const current = ++generation
  visible.value = true
  loading.value = true
  error.value = ''
  row.value = null
  items.value = []
  page.value = 1
  try {
    const detail = await props.api.detail(props.id)
    if (generation !== current) return
    row.value = detail
    if (props.withItems) await loadItems()
  } catch(reason) {
    if (generation === current) error.value = reason instanceof Error ? reason.message : '详情加载失败'
  } finally {
    if (generation === current) loading.value = false
  }
}
async function loadItems() {
  if (!auth.hasPermission('business:mes:material:issue:item:list', 'factory')) return
  const current = generation
  try {
    const result = await itemApi.list({ issueId: props.id, offset: (page.value - 1) * 20, limit: 20 })
    if (generation !== current) return
    items.value = result.items
    total.value = result.total
  } catch(reason) {
    if (generation === current) error.value = reason instanceof Error ? reason.message : '明细加载失败'
  }
}
function clear() {
  generation++
  visible.value = false
  row.value = null
  items.value = []
  total.value = 0
  error.value = ''
  loading.value = false
}
watch(() => [auth.revision, auth.factoryId, auth.factoryPermissions.join('|')], clear)
onBeforeUnmount(clear)
</script>

<template>
  <el-button v-if="auth.hasPermission(permission, 'factory')" text type="primary" @click="show">详情</el-button>
  <el-dialog v-model="visible" title="领料资料详情" width="min(960px,94vw)" @closed="clear">
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <div v-loading="loading">
      <el-descriptions v-if="row" :column="2" border>
        <el-descriptions-item v-for="field in fields.filter(f => f.key !== 'factoryId')" :key="field.key" :label="field.label">
          {{ field.options?.find(o => o.value === row?.[field.key])?.label ?? formatValue(row[field.key], field.kind) }}
        </el-descriptions-item>
      </el-descriptions>
      <template v-if="withItems && row">
        <p>领料明细</p>
        <el-alert v-if="!auth.hasPermission('business:mes:material:issue:item:list', 'factory')" title="当前账号没有领料明细查询权限" type="info" :closable="false" />
        <template v-else>
          <el-table :data="items" empty-text="暂无明细">
            <el-table-column prop="id" label="明细 ID" min-width="100" />
            <el-table-column prop="materialCode" label="材料品号" min-width="160" />
            <el-table-column prop="batchNo" label="材料批次号" min-width="160" />
            <el-table-column prop="quantity" label="领料数量" min-width="200" />
            <el-table-column prop="unitCode" label="单位" min-width="100" />
            <el-table-column prop="warehouseCode" label="来源仓库" min-width="130" />
          </el-table>
          <el-pagination v-model:current-page="page" :page-size="20" :total="total" layout="prev, pager, next, total" @current-change="loadItems" />
        </template>
      </template>
    </div>
  </el-dialog>
</template>
