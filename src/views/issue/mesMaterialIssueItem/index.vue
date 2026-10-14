<script setup lang="ts">
import CrudPage from '@/components/CrudPage.vue'
import { api } from '@/api/issue/mesMaterialIssueItem'
import type { Field } from '@/lib/crud'
import WarehouseSelect from '@/components/business/WarehouseSelect.vue'
import MaterialSelect from '@/components/business/MaterialSelect.vue'
import IssueRecordDetails from '@/components/business/issue/IssueRecordDetails.vue'

const fields: Field[] = [
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
    key: 'issueId',
    label: '领料单 ID',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: true,
    maxLength: 19
  },
  {
    key: 'materialId',
    label: '领用材料',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: false,
    maxLength: 19
  },
  {
    key: 'materialCode',
    columnMinWidth: 200,
    label: '材料品号',
    kind: 'text',
    readonly: true,
    required: false,
    searchable: true,
    maxLength: 64
  },
  {
    key: 'batchNo',
    columnMinWidth: 200,
    label: '材料批次号',
    kind: 'text',
    readonly: false,
    required: false,
    searchable: true,
    maxLength: 128
  },
  {
    key: 'quantity',
    columnMinWidth: 200,
    label: '领料数量',
    kind: 'decimal',
    readonly: false,
    required: true,
    searchable: true,
    maxLength: 18
  },
  {
    key: 'unitId',
    label: '单位 ID',
    kind: 'text',
    readonly: false,
    required: false,
    searchable: false,
    maxLength: 19
  },
  {
    key: 'unitCode',
    label: '单位编码',
    kind: 'text',
    readonly: true,
    required: false,
    searchable: true,
    maxLength: 64
  },
  {
    key: 'warehouseId',
    label: '来源仓库',
    kind: 'text',
    readonly: false,
    required: false,
    searchable: false,
    maxLength: 19
  },
  {
    key: 'warehouseCode',
    label: '仓库编码',
    kind: 'text',
    readonly: true,
    required: false,
    searchable: true,
    maxLength: 64
  },
  {
    key: 'remark',
    label: '备注',
    kind: 'text',
    readonly: false,
    required: false,
    searchable: true,
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
    table-key="business:mes:material:issue:item:list"
    title="领料出库明细"
    permission="business:mes:material:issue:item"
    list-action="list"
    detail-action="query"
    :api="api"
    :fields="fields"
    id-key="id"
  >
    <template #field-materialId="{ draft }">
      <MaterialSelect v-model="draft.materialId as string | null" />
    </template>
    <template #field-warehouseId="{ draft }">
      <WarehouseSelect v-model="draft.warehouseId as string | null" />
    </template>
    <template #field-issueId="{ draft }">
      <el-input v-model="draft.issueId as string" :disabled="!!draft.id" placeholder="填写本厂领料单 ID" />
    </template>
    <template #actions="{ row }">
      <IssueRecordDetails :id="String(row.id)" :api="api" :fields="fields" permission="business:mes:material:issue:item:query" />
    </template>
  </CrudPage>
</template>
