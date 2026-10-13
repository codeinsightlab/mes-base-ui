<!-- MES-CODEGEN: Base Design System; shared CRUD interactions and explicit field contract. -->
<script setup lang="ts">
import CrudPage from '@/components/CrudPage.vue'
import { api } from '@/api/md/mdWorkshop'
import type { Field } from '@/lib/crud'
import { ref } from 'vue'
import { sync } from '@/api/md/mdWorkshop'
import SyncButton from '@/components/business/SyncButton.vue'
const page = ref<InstanceType<typeof CrudPage> | null>(null)

const fields: Field[] = [
  {
    key: 'workshopId',
    label: '车间主键',
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
    key: 'workshopCode',
    label: '车间编码',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: true,
    maxLength: 64
  },
  {
    key: 'workshopName',
    label: '车间名称',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: true,
    maxLength: 255
  },
  {
    key: 'area',
    label: '车间面积，沿用来源资料的计量口径',
    kind: 'decimal',
    readonly: false,
    required: false,
    searchable: false,
    maxLength: 18
  },
  {
    key: 'charge',
    label: '车间负责人说明，保留来源文本，不推断为人员编号',
    kind: 'text',
    readonly: false,
    required: false,
    searchable: false,
    maxLength: 64
  },
  {
    key: 'deptId',
    label: '关联中心人员目录中的部门编号，允许暂未关联',
    kind: 'text',
    readonly: false,
    required: false,
    searchable: false,
    maxLength: 19
  },
  {
    key: 'enableFlag',
    label: '启用标识，Y为启用，N为停用',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: false,
    maxLength: 1
  },
  {
    key: 'remark',
    label: '车间补充说明',
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
    table-key="business:md:workshop:list"
    title="车间"
    permission="business:md:workshop"
    list-action="list"
    detail-action="query"
    :api="api"
    :fields="fields"
    id-key="workshopId"
  >
    <template #toolbar>
      <SyncButton permission="business:md:workshop:sync" scope="factory" :run="sync" @completed="page?.load()" />
    </template>
  </CrudPage>
</template>
