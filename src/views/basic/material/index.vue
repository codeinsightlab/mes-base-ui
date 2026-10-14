<script setup lang="ts">
import CrudPage from '@/components/CrudPage.vue'
import { api } from '@/api/basic/material'
import type { Field } from '@/lib/crud'
import { ref } from 'vue'
import { sync } from '@/api/basic/material'
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
    key: 'specification',
    label: '规格型号',
    kind: 'text',
    readonly: false,
    required: false,
    searchable: false,
    maxLength: 500
  },
  {
    key: 'categoryId',
    label: '物料分类本地主键',
    kind: 'text',
    readonly: false,
    required: false,
    searchable: false,
    maxLength: 19
  },
  {
    key: 'unitId',
    label: '计量单位本地主键',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: false,
    maxLength: 19
  },
  {
    key: 'materialType',
    label: '物料产品标识：ITEM物料、PRODUCT产品',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: false,
    maxLength: 16
  },
  {
    key: 'status',
    label: '启用状态：ENABLED启用、DISABLED停用',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: false,
    maxLength: 16
  },
  {
    key: 'externalId',
    label: '外部物料来源标识，不作为本地主键',
    kind: 'text',
    readonly: false,
    required: false,
    searchable: false,
    maxLength: 128
  },
  {
    key: 'externalCode',
    label: '外部物料来源编码',
    kind: 'text',
    readonly: false,
    required: false,
    searchable: true,
    maxLength: 128
  }
]
</script>

<template>
  <CrudPage
    ref="page"
    table-key="business:material:list"
    title="物料产品"
    permission="business:material"
    list-action="list"
    detail-action="query"
    :api="api"
    :fields="fields"
    id-key="id"
  >
    <template #toolbar>
      <SyncButton permission="business:material:sync" scope="factory" :run="sync" @completed="page?.load()" />
    </template>
  </CrudPage>
</template>
