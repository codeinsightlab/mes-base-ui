<!-- MES-CODEGEN: Base Design System; shared CRUD interactions and explicit field contract. -->
<script setup lang="ts">
import CrudPage from '@/components/CrudPage.vue'
import { api } from '@/api/qc/qcDefect'
import type { Field } from '@/lib/crud'
import { ref } from 'vue'
import { sync } from '@/api/qc/qcDefect'
import SyncButton from '@/components/business/SyncButton.vue'
const page = ref<InstanceType<typeof CrudPage> | null>(null)

const fields: Field[] = [
  {
    key: 'defectId',
    label: '常见质量缺陷主键',
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
    key: 'defectCode',
    label: '缺陷编码，来源系统使用流水号生成',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: true,
    maxLength: 64
  },
  {
    key: 'defectName',
    label: '缺陷描述',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: true,
    maxLength: 500
  },
  {
    key: 'indexType',
    label: '对应检测项类型编码，保留来源字典语义',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: false,
    maxLength: 64
  },
  {
    key: 'defectLevel',
    label: '缺陷等级编码，保留来源字典语义',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: false,
    maxLength: 64
  },
  {
    key: 'remark',
    label: '缺陷字典补充说明',
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
    title="质量缺陷"
    permission="business:qc:defect"
    :api="api"
    :fields="fields"
    id-key="defectId"
  >
    <template #toolbar>
      <SyncButton permission="business:qc:defect:sync" scope="factory" :run="sync" @completed="page?.load()" />
    </template>
  </CrudPage>
</template>
