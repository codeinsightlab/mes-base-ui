<script setup lang="ts">
import OperationDefectTypePanel from '@/components/business/quality/OperationDefectTypePanel.vue'
import OperatorConfigurationPanel from '@/components/business/production/OperatorConfigurationPanel.vue'
import { ref, watch } from 'vue'
import DocumentFields from '@/components/document/DocumentFields.vue'
import CrudPage from '@/components/CrudPage.vue'
import SyncButton from '@/components/business/SyncButton.vue'
import { api as generatedApi } from '@/api/production/operation'
import { request } from '@/lib/request'
import type { Field, Row } from '@/lib/crud'
import { useAuth } from '@/stores/auth'
const page = ref<InstanceType<typeof CrudPage> | null>(null)
const auth = useAuth()
const typePending = ref(false), typeBusy = ref(false)
const peoplePending = ref(false), peopleBusy = ref(false), editorTab = ref('information')
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
  update: async(id: string, body: unknown) => {
    if (editingRevision?.id !== id) throw new Error('请重新打开记录后编辑')
    const result = await generatedApi.update(id, { ...(body as Row), revision: editingRevision.revision })
    if (editingRevision?.id === id) editingRevision = { id, revision: result.revision }
    return result
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
    editor-width="min(1040px, 94vw)"
    keep-editor-open
    :editor-access="auth.hasPermission('business:mes:operation:user:list', 'factory') || auth.hasPermission('business:operation:defect:type:read', 'factory')"
    :editor-dirty="peoplePending || typePending"
    :editor-busy="peopleBusy || typeBusy"
    save-label="保存工序信息"
  >
    <template #editor="{ editId, draft, fields: editorFields, saving, readonly: metadataReadonly, save }">
      <el-tabs v-model="editorTab">
        <el-tab-pane label="工序信息" name="information">
          <p class="secondary">带 * 的字段为必填。工序信息与人员配置分别保存。</p>
          <DocumentFields :fields="editorFields" :draft="draft" :disabled="saving || metadataReadonly" @submit="save" />
        </el-tab-pane>
        <el-tab-pane label="可操作人员" name="people" lazy>
          <p class="secondary">人员配置单独保存，保存后立即生效。</p>
          <OperatorConfigurationPanel v-if="editId && auth.hasPermission('business:mes:operation:user:list', 'factory')" :key="editId" :operation-id="editId" :context-label="String(draft.code) + ' · ' + String(draft.name)" @pending="peoplePending = $event" @busy="peopleBusy = $event" />
          <p v-else class="secondary">{{ editId ? '暂无查看工序能力人员的权限。' : '请先保存工序，再编辑并配置可操作人员。' }}</p>
        </el-tab-pane>
        <el-tab-pane label="不良类型" name="defects" lazy>
          <OperationDefectTypePanel v-if="editId && auth.hasPermission('business:operation:defect:type:read', 'factory')" :operation-id="editId" @pending="typePending = $event" @busy="typeBusy = $event" />
          <p v-else class="secondary">{{ editId ? '暂无工序不良类型配置权限。' : '请先保存工序，再维护其不良类型。' }}</p>
        </el-tab-pane>
      </el-tabs>
    </template>
    <template #toolbar><SyncButton permission="operation:sync" scope="factory" :run="sync" @completed="page?.load()" /></template>
  </CrudPage>
</template>
