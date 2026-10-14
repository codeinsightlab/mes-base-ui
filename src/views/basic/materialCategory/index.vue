<script setup lang="ts">
import CrudPage from '@/components/CrudPage.vue'
import { api } from '@/api/basic/materialCategory'
import type { Field } from '@/lib/crud'
import { ref } from 'vue'
import { sync } from '@/api/basic/materialCategory'
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
    key: 'code',
    label: '工厂内业务编码',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: true,
    maxLength: 64
  },
  {
    key: 'name',
    label: '业务名称',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: true,
    maxLength: 255
  },
  {
    key: 'parentId',
    label: '父分类本地主键，空值表示根分类',
    kind: 'text',
    readonly: false,
    required: false,
    searchable: false,
    maxLength: 19
  },
  {
    key: 'sort',
    label: '分类显示顺序',
    kind: 'number',
    readonly: false,
    required: true,
    searchable: false,
    maxLength: 10
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
    label: '业务备注',
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
    table-key="business:material:category:list"
    title="物料产品分类"
    permission="business:material:category"
    list-action="list"
    detail-action="query"
    :api="api"
    :fields="fields"
    id-key="id"
  >
    <template #toolbar>
      <SyncButton permission="business:material:category:sync" scope="factory" :run="sync" @completed="page?.load()" />
    </template>
  </CrudPage>
</template>
