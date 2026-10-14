<script setup lang="ts">
import CrudPage from '@/components/CrudPage.vue'
import { api } from '@/api/dv/dvSubject'
import type { Field } from '@/lib/crud'
import { ref } from 'vue'
import { sync } from '@/api/dv/dvSubject'
import SyncButton from '@/components/business/SyncButton.vue'
const page = ref<InstanceType<typeof CrudPage> | null>(null)

const fields: Field[] = [
  {
    key: 'subjectId',
    label: '设备点检保养项目主键',
    kind: 'text',
    readonly: true,
    required: true,
    searchable: false,
    maxLength: 19
  },
  {
    key: 'subjectCode',
    label: '设备点检保养项目编码',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: true,
    maxLength: 64
  },
  {
    key: 'subjectName',
    label: '设备点检保养项目名称，允许仅填写项目内容',
    kind: 'text',
    readonly: false,
    required: false,
    searchable: true,
    maxLength: 255
  },
  {
    key: 'subjectType',
    label: '点检或保养类型编码，保留来源字典语义',
    kind: 'text',
    readonly: false,
    required: false,
    searchable: false,
    maxLength: 64
  },
  {
    key: 'subjectContent',
    label: '需要执行的点检或保养内容',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: false,
    maxLength: 500
  },
  {
    key: 'subjectStandard',
    label: '项目执行或判定标准',
    kind: 'text',
    readonly: false,
    required: false,
    searchable: false,
    maxLength: 255
  },
  {
    key: 'enableFlag',
    label: '状态',
    kind: 'select',
    defaultValue: 'Y',
    options: [{ label: '启用', value: 'Y', tone: 'success' }, { label: '停用', value: 'N', tone: 'info' }],
    readonly: false,
    required: true,
    searchable: false,
    maxLength: 1
  },
  {
    key: 'remark',
    label: '点检保养项目补充说明',
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
    table-key="business:dv:subject:list"
    title="设备点检保养项目"
    permission="business:dv:subject"
    list-action="list"
    detail-action="query"
    :api="api"
    :fields="fields"
    id-key="subjectId"
  >
    <template #toolbar>
      <SyncButton permission="business:dv:subject:sync" scope="factory" :run="sync" @completed="page?.load()" />
    </template>
  </CrudPage>
</template>
