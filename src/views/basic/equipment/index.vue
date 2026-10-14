<script setup lang="ts">
import CrudPage from '@/components/CrudPage.vue'
import { api } from '@/api/basic/equipment'
import type { Field } from '@/lib/crud'
import WorkstationSelect from '@/components/business/WorkstationSelect.vue'

const fields: Field[] = [
  { key: 'id', label: '编号', kind: 'text', readonly: true, hidden: true },

  { key: 'code', label: '编码', kind: 'text', required: true, searchable: true, maxLength: 64 },
  { key: 'name', label: '名称', kind: 'text', required: true, searchable: true, maxLength: 255 },
  { key: 'model', label: '规格型号', kind: 'text', maxLength: 255 },
  { key: 'workstationId', label: '工作站', kind: 'text' },
  { key: 'status', label: '状态', kind: 'select', required: true, searchable: true,
    defaultValue: 'ENABLED', options: [
      { label: '启用', value: 'ENABLED', tone: 'success' },
      { label: '停用', value: 'DISABLED', tone: 'info' }
    ] },
  { key: 'remark', label: '备注', kind: 'textarea', maxLength: 500 }
]
</script>

<template>
  <CrudPage
    table-key="business:equipment:list"
    title="设备"
    permission="business:equipment"
    list-action="read"
    detail-action="read"
    :api="api"
    :fields="fields"
    id-key="id"
  >
    <template #field-workstationId="{ draft }">
      <WorkstationSelect v-model="draft.workstationId as string | null" />
    </template>
  </CrudPage>
</template>
