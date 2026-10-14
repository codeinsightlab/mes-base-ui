<script setup lang="ts">
import CrudPage from '@/components/CrudPage.vue'
import { api } from '@/api/issue/mesMaterialIssue'
import type { Field } from '@/lib/crud'
import MaterialSelect from '@/components/business/MaterialSelect.vue'
import IssueRecordDetails from '@/components/business/issue/IssueRecordDetails.vue'

const fields: Field[] = [
  { key: 'executionId', label: '生产执行 ID', kind: 'text', required: false, searchable: true, maxLength: 19 },
  {
    key: 'id',
    label: '编号',
    kind: 'text',
    readonly: true,
    required: true,
    searchable: false,
    maxLength: 19
  },
  {
    key: 'issueNo',
    columnMinWidth: 200,
    label: '领料单号',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: true,
    maxLength: 64
  },
  {
    key: 'workorderId',
    label: '工单编号 ID',
    kind: 'text',
    readonly: false,
    required: false,
    searchable: false,
    maxLength: 19
  },
  {
    key: 'workorderCode',
    columnMinWidth: 200,
    label: '工单号',
    kind: 'text',
    readonly: false,
    required: false,
    searchable: true,
    maxLength: 64
  },
  {
    key: 'productId',
    label: '产出产品',
    kind: 'text',
    readonly: false,
    required: false,
    searchable: true,
    maxLength: 19
  },
  {
    key: 'productCode',
    columnMinWidth: 200,
    label: '产出品号',
    kind: 'text',
    readonly: false,
    required: false,
    searchable: true,
    maxLength: 64
  },
  {
    key: 'flowCardNo',
    columnMinWidth: 200,
    label: '流程卡号',
    kind: 'text',
    readonly: false,
    required: false,
    searchable: true,
    maxLength: 128
  },
  {
    key: 'routingId',
    label: '工艺版本 ID',
    kind: 'text',
    readonly: false,
    required: false,
    searchable: true,
    maxLength: 19
  },
  {
    key: 'issueTime',
    label: '领料时间',
    kind: 'datetime',
    readonly: false,
    required: false,
    searchable: false,
    maxLength: 19
  },
  {
    key: 'status',
    defaultValue: 'DRAFT',
    options: [{ label: '草稿', value: 'DRAFT', tone: 'info' }, { label: '已记录', value: 'RECORDED', tone: 'success' }],
    label: '资料状态',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: true,
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
  },
  {
    key: 'createBy',
    label: '创建人',
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
    label: '修改人',
    kind: 'text',
    readonly: true,
    required: false,
    searchable: false,
    maxLength: 64
  },
  {
    key: 'updateTime',
    label: '修改时间',
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
    table-key="business:mes:material:issue:list"
    title="领料出库单"
    permission="business:mes:material:issue"
    list-action="list"
    detail-action="query"
    :api="api"
    :fields="fields"
    id-key="id"
  >
    <template #field-productId="{ draft }">
      <MaterialSelect v-model="draft.productId as string | null" />
    </template>
    <template #actions="{ row }">
      <IssueRecordDetails :id="String(row.id)" :api="api" :fields="fields" permission="business:mes:material:issue:query" :with-items="true" />
    </template>
  </CrudPage>
</template>
