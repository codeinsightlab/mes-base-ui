<script setup lang="ts">
import CrudPage from '@/components/CrudPage.vue'
import { api } from '@/api/basic/safetyStock'
import type { Field } from '@/lib/crud'
import { ref } from 'vue'
import { sync } from '@/api/basic/safetyStock'
import SyncButton from '@/components/business/SyncButton.vue'
const page = ref<InstanceType<typeof CrudPage> | null>(null)

const fields: Field[] = [
  {
    key: 'id',
    label: '本地业务主键',
    kind: 'text',
    readonly: true,
    required: true,
    searchable: false,
    maxLength: 19
  },
  {
    key: 'materialId',
    label: '物料产品本地主键',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: false,
    maxLength: 19
  },
  {
    key: 'minQty',
    label: '最低库存量，安全库存下限',
    kind: 'decimal',
    readonly: false,
    required: true,
    searchable: false,
    maxLength: 18
  },
  {
    key: 'maxQty',
    label: '最高库存量，空值表示未设上限',
    kind: 'decimal',
    readonly: false,
    required: false,
    searchable: false,
    maxLength: 18
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
    table-key="business:safety:stock:list"
    title="安全库存配置"
    permission="business:safety:stock"
    list-action="list"
    detail-action="query"
    :api="api"
    :fields="fields"
    id-key="id"
  >
    <template #toolbar>
      <SyncButton permission="business:safety:stock:sync" scope="factory" :run="sync" @completed="page?.load()" />
    </template>
  </CrudPage>
</template>
