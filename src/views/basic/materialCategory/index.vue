<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import CrudPage from '@/components/CrudPage.vue'
import SyncButton from '@/components/business/SyncButton.vue'
import { api, tree, sync, type MaterialCategoryVo } from '@/api/basic/materialCategory'
import { categoryTree } from '@/lib/materialCategories'
import type { CrudApi, Field } from '@/lib/crud'
import { useAuth } from '@/stores/auth'
const auth = useAuth(), page = ref<InstanceType<typeof CrudPage> | null>(null)
const rows = ref<MaterialCategoryVo[]>([]), error = ref('')
let generation = 0
const nodes = computed(() => categoryTree(rows.value))
const names = computed(() => Object.fromEntries(rows.value.map(row => [row.id, row.name])))
async function loadTree() {
  if (!auth.hasPermission('business:material:category:list', 'factory')) return
  const current = ++generation;error.value = ''
  try { const result = await tree();if (current === generation) rows.value = result.items } catch(reason) { if (current === generation) error.value = reason instanceof Error ? reason.message : '上级分类读取失败' }
}
const categoryApi:CrudApi = {
  ...api,
  create: async body => { const result = await api.create(body);await loadTree();return result },
  update: async(id, body) => { const result = await api.update(id, body);await loadTree();return result },
  remove: async id => { await api.remove(id);await loadTree() },
  delids: async ids => { await api.delids(ids);await loadTree() }
}
const fields = computed<Field[]>(() => [
  { key: 'code', label: '分类编码', kind: 'text', required: true, searchable: true, maxLength: 64 },
  { key: 'name', label: '分类名称', kind: 'text', required: true, searchable: true, maxLength: 255 },
  { key: 'parentId', label: '上级分类', kind: 'text', format: value => value ? names.value[String(value)] ?? String(value) : '根分类' },
  { key: 'sort', label: '显示顺序', kind: 'number', required: true, defaultValue: 0 },
  { key: 'status', label: '状态', kind: 'select', required: true, defaultValue: 'ENABLED', options: [{ value: 'ENABLED', label: '启用', tone: 'success' }, { value: 'DISABLED', label: '停用', tone: 'info' }] },
  { key: 'remark', label: '备注', kind: 'textarea', maxLength: 500 }
])
watch(() => [auth.revision, auth.factoryId, auth.factoryPermissions.join('|')], () => { generation++;rows.value = [];error.value = '';void loadTree() }, { immediate: true, flush: 'sync' })
onBeforeUnmount(() => { generation++ })
async function synced() { await loadTree();await page.value?.load() }
</script>
<template>
  <section>
    <el-alert v-if="error" :title="error" type="error" :closable="false" /><el-button v-if="error" link @click="loadTree">重试上级分类</el-button>
    <CrudPage ref="page" title="物料分类" table-key="business:material:category:list" permission="business:material:category" permission-scope="factory" list-action="list" detail-action="query" :api="categoryApi" :fields="fields">
      <template #toolbar><SyncButton permission="business:material:category:sync" scope="factory" :run="sync" @completed="synced" /></template>
      <template #field-parentId="{draft,disabled}"><el-tree-select v-model="draft.parentId as string" :data="nodes" node-key="id" clearable filterable check-strictly :disabled="disabled || !!error" placeholder="留空表示根分类" /></template>
    </CrudPage>
  </section>
</template>
