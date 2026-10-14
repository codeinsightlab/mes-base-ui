<script setup lang="ts">
import CrudPage from '@/components/CrudPage.vue'
import { api } from '@/api/basic/workshop'
import type { Field } from '@/lib/crud'
import { ref } from 'vue'
import { sync } from '@/api/basic/workshop'
import SyncButton from '@/components/business/SyncButton.vue'
const page = ref<InstanceType<typeof CrudPage> | null>(null)

const fields: Field[] = [
  {
    key: 'id',
    label: '车间编号',
    kind: 'text',
    readonly: true,
    required: true,
    searchable: false,
    maxLength: 19
  },
  {
    key: 'code',
    label: '车间编码',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: true,
    maxLength: 64
  },
  {
    key: 'name',
    label: '车间名称',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: true,
    maxLength: 255
  },
  {
    key: 'status',
    label: '状态',
    kind: 'select',
    defaultValue: 'ENABLED',
    options: [{ label: '启用', value: 'ENABLED', tone: 'success' }, { label: '停用', value: 'DISABLED', tone: 'info' }],
    readonly: false,
    required: true,
    searchable: false,
    maxLength: 16
  },
  {
    key: 'remark',
    label: '备注',
    kind: 'text',
    readonly: false,
    required: false,
    searchable: false,
    maxLength: 500
  }
]
</script>

<template>
  <CrudPage
    ref="page"
    table-key="business:workshop:list"
    title="车间"
    permission="business:workshop"
    list-action="list"
    detail-action="query"
    :api="api"
    :fields="fields"
    id-key="id"
  >
    <template #toolbar>
      <SyncButton permission="business:workshop:sync" scope="factory" :run="sync" @completed="page?.load()" />
    </template>
  </CrudPage>
</template>
