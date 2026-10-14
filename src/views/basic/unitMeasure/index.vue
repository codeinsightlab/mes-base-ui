<script setup lang="ts">
import CrudPage from '@/components/CrudPage.vue'
import { api } from '@/api/basic/unitMeasure'
import type { Field } from '@/lib/crud'
import { ref } from 'vue'
import { sync } from '@/api/basic/unitMeasure'
import SyncButton from '@/components/business/SyncButton.vue'
const page = ref<InstanceType<typeof CrudPage> | null>(null)

const fields: Field[] = [
  {
    key: 'id',
    label: '单位编号',
    kind: 'text',
    readonly: true,
    required: true,
    searchable: false,
    maxLength: 19
  },
  {
    key: 'code',
    label: '单位编码',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: true,
    maxLength: 64
  },
  {
    key: 'name',
    label: '单位名称',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: true,
    maxLength: 255
  },
  {
    key: 'symbol',
    label: '单位符号',
    kind: 'text',
    readonly: false,
    required: false,
    searchable: false,
    maxLength: 32
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
  }
]
</script>

<template>
  <CrudPage
    ref="page"
    table-key="business:unit:measure:list"
    title="计量单位"
    permission="business:unit:measure"
    list-action="list"
    detail-action="query"
    :api="api"
    :fields="fields"
    id-key="id"
  >
    <template #toolbar>
      <SyncButton permission="business:unit:measure:sync" scope="factory" :run="sync" @completed="page?.load()" />
    </template>
  </CrudPage>
</template>
