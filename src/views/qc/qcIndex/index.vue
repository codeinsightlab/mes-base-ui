<!-- MES-CODEGEN: Base Design System; shared CRUD interactions and explicit field contract. -->
<script setup lang="ts">
import CrudPage from '@/components/CrudPage.vue'
import { api } from '@/api/qc/qcIndex'
import type { Field } from '@/lib/crud'
import { ref } from 'vue'
import { sync } from '@/api/qc/qcIndex'
import SyncButton from '@/components/business/SyncButton.vue'
const page = ref<InstanceType<typeof CrudPage> | null>(null)

const fields: Field[] = [
  {
    key: 'indexId',
    label: '质量检测项主键',
    kind: 'text',
    readonly: true,
    required: true,
    searchable: false,
    maxLength: 19
  },
  {
    key: 'factoryId',
    label: '所属工厂标识，由服务端当前工厂上下文填写',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: false,
    maxLength: 64
  },
  {
    key: 'indexCode',
    label: '质量检测项编码',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: true,
    maxLength: 64
  },
  {
    key: 'indexName',
    label: '质量检测项名称',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: true,
    maxLength: 255
  },
  {
    key: 'indexType',
    label: '检测项类型编码，保留来源字典语义',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: false,
    maxLength: 64
  },
  {
    key: 'qcTool',
    label: '用于检测的工具说明',
    kind: 'text',
    readonly: false,
    required: false,
    searchable: false,
    maxLength: 255
  },
  {
    key: 'remark',
    label: '质量检测项补充说明',
    kind: 'text',
    readonly: false,
    required: false,
    searchable: false,
    maxLength: 500
  },
  {
    key: 'createBy',
    label: '创建人账号标识',
    kind: 'text',
    readonly: true,
    required: false,
    searchable: false,
    maxLength: 64
  },
  {
    key: 'createTime',
    label: '创建时间',
    kind: 'datetime',
    readonly: true,
    required: false,
    searchable: false,
    maxLength: 19
  },
  {
    key: 'updateBy',
    label: '最近修改人账号标识',
    kind: 'text',
    readonly: true,
    required: false,
    searchable: false,
    maxLength: 64
  },
  {
    key: 'updateTime',
    label: '最近修改时间',
    kind: 'datetime',
    readonly: true,
    required: false,
    searchable: false,
    maxLength: 19
  }
]
</script>

<template>
  <CrudPage
    ref="page"
    table-key="business:qc:index:list"
    title="质量检测项"
    permission="business:qc:index"
    list-action="list"
    detail-action="query"
    :api="api"
    :fields="fields"
    id-key="indexId"
  >
    <template #toolbar>
      <SyncButton permission="business:qc:index:sync" scope="factory" :run="sync" @completed="page?.load()" />
    </template>
  </CrudPage>
</template>
