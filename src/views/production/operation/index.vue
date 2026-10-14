<script setup lang="ts">
import { ref, watch } from 'vue'
import CrudPage from '@/components/CrudPage.vue'
import SyncButton from '@/components/business/SyncButton.vue'
import { api as generatedApi } from '@/api/production/operation'
import { request } from '@/lib/request'
import type { Field, Row } from '@/lib/crud'
import { useAuth } from '@/stores/auth'
const page = ref<InstanceType<typeof CrudPage> | null>(null)
const auth = useAuth()
let editingRevision: { id: string; revision: number } | null = null
watch(() => auth.revision, () => { editingRevision = null }, { flush: 'sync' })
const fields: Field[] = [
  { key: 'id', label: '编号', kind: 'text', readonly: true, hidden: true },

  { key: 'code', label: '工序编码', kind: 'text', required: true, searchable: true, maxLength: 64 },
  { key: 'name', label: '工序名称', kind: 'text', required: true, searchable: true, maxLength: 255 },
  { key: 'status', label: '状态', kind: 'select', required: true, searchable: true, defaultValue: 'ENABLED', options: [
    { label: '启用', value: 'ENABLED', tone: 'success' }, { label: '停用', value: 'DISABLED', tone: 'info' }
  ] },
  { key: 'sort', label: '排序', kind: 'number', required: true, defaultValue: 0 },
  { key: 'description', label: '工艺要求', kind: 'textarea', maxLength: 1000 },
  { key: 'externalId', label: '来源标识', kind: 'text', maxLength: 128, columnVisible: false },
  { key: 'revision', label: '修订号', kind: 'number', hidden: true, readonly: true }
]
const api = {
  ...generatedApi,
  detail: async(id: string) => {
    const detail = await generatedApi.detail(id)
    editingRevision = { id, revision: detail.revision }
    return detail
  },
  create: (body: unknown) => {
    const row = body as Row
    return generatedApi.create({ code: row.code, name: row.name, status: row.status, sort: row.sort,
      description: row.description, externalId: row.externalId })
  },
  update: (id: string, body: unknown) => {
    if (editingRevision?.id !== id) throw new Error('请重新打开记录后编辑')
    return generatedApi.update(id, { ...(body as Row), revision: editingRevision.revision })
  }
}
const sync = () => request<{ fetched: number; created: number; updated: number; skipped: number }>(
  '/api/production/operation/actions/sync', { method: 'POST', scope: 'factory' })
</script>
<template>
  <CrudPage
    ref="page"
    title="工序"
    table-key="operation:list"
    permission="operation"
    permission-scope="factory"
    list-action="list"
    detail-action="query"
    :api="api"
    :fields="fields"
  >
    <template #toolbar><SyncButton permission="operation:sync" scope="factory" :run="sync" @completed="page?.load()" /></template>
  </CrudPage>
</template>
