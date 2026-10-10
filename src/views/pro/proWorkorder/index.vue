<!-- MES-CODEGEN: Base Design System; shared CRUD interactions and explicit field contract. -->
<script setup lang="ts">
import CrudPage from '@/components/CrudPage.vue'
import { api } from '@/api/pro/proWorkorder'
import type { Field } from '@/lib/crud'

const fields: Field[] = [
  {
    key: 'workorderId',
    label: '工单ID',
    kind: 'text',
    readonly: true,
    required: true,
    searchable: false,
    maxLength: 19
  },
  {
    key: 'workorderCode',
    label: '工单编码',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: true,
    maxLength: 64
  },
  {
    key: 'workorderName',
    label: '工单名称',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: true,
    maxLength: 255
  },
  {
    key: 'orderSource',
    label: '来源类型',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: false,
    maxLength: 64
  },
  {
    key: 'sourceCode',
    label: '来源单据',
    kind: 'text',
    readonly: false,
    required: false,
    searchable: true,
    maxLength: 64
  },
  {
    key: 'productId',
    label: '产品ID',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: false,
    maxLength: 19
  },
  {
    key: 'productCode',
    label: '产品编号',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: true,
    maxLength: 64
  },
  {
    key: 'productName',
    label: '产品名称',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: true,
    maxLength: 255
  },
  {
    key: 'productSpc',
    label: '规格型号',
    kind: 'text',
    readonly: false,
    required: false,
    searchable: false,
    maxLength: 255
  },
  {
    key: 'unitOfMeasure',
    label: '单位',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: false,
    maxLength: 64
  },
  {
    key: 'quantity',
    label: '生产数量',
    kind: 'number',
    readonly: false,
    required: true,
    searchable: false,
    maxLength: 14
  },
  {
    key: 'quantityProduced',
    label: '已生产数量',
    kind: 'number',
    readonly: false,
    required: false,
    searchable: false,
    maxLength: 14
  },
  {
    key: 'quantityChanged',
    label: '调整数量',
    kind: 'number',
    readonly: false,
    required: false,
    searchable: false,
    maxLength: 14
  },
  {
    key: 'quantityScheduled',
    label: '已排产数量',
    kind: 'number',
    readonly: false,
    required: false,
    searchable: false,
    maxLength: 14
  },
  {
    key: 'clientId',
    label: '客户ID',
    kind: 'text',
    readonly: false,
    required: false,
    searchable: false,
    maxLength: 19
  },
  {
    key: 'clientCode',
    label: '客户编码',
    kind: 'text',
    readonly: false,
    required: false,
    searchable: true,
    maxLength: 64
  },
  {
    key: 'clientName',
    label: '客户名称',
    kind: 'text',
    readonly: false,
    required: false,
    searchable: true,
    maxLength: 255
  },
  {
    key: 'batchCode',
    label: '批次号',
    kind: 'text',
    readonly: false,
    required: false,
    searchable: true,
    maxLength: 64
  },
  {
    key: 'requestDate',
    label: '需求日期',
    kind: 'datetime',
    readonly: false,
    required: true,
    searchable: false,
    maxLength: 19
  },
  {
    key: 'parentId',
    label: '父工单',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: false,
    maxLength: 19
  },
  {
    key: 'ancestors',
    label: '所有父节点ID',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: false,
    maxLength: 500
  },
  {
    key: 'finishDate',
    label: '完成时间',
    kind: 'datetime',
    readonly: false,
    required: false,
    searchable: false,
    maxLength: 19
  },
  {
    key: 'status',
    label: '单据状态',
    kind: 'text',
    readonly: false,
    required: false,
    searchable: false,
    maxLength: 64
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
    key: 'attr1',
    label: '预留字段1',
    kind: 'text',
    readonly: false,
    required: false,
    searchable: false,
    maxLength: 64
  },
  {
    key: 'attr2',
    label: '预留字段2',
    kind: 'text',
    readonly: false,
    required: false,
    searchable: false,
    maxLength: 255
  },
  {
    key: 'attr3',
    label: '预留字段3',
    kind: 'number',
    readonly: false,
    required: false,
    searchable: false,
    maxLength: 10
  },
  {
    key: 'attr4',
    label: '预留字段4',
    kind: 'number',
    readonly: false,
    required: false,
    searchable: false,
    maxLength: 10
  },
  {
    key: 'createBy',
    label: '创建者',
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
    label: '更新者',
    kind: 'text',
    readonly: true,
    required: false,
    searchable: false,
    maxLength: 64
  },
  {
    key: 'updateTime',
    label: '更新时间',
    kind: 'datetime',
    readonly: true,
    required: false,
    searchable: false,
    maxLength: 19
  },
  {
    key: 'transactionDate',
    label: '审核日期',
    kind: 'datetime',
    readonly: false,
    required: false,
    searchable: false,
    maxLength: 19
  },
  {
    key: 'moId',
    label: 'ERP订单id',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: false,
    maxLength: 39
  }
]
</script>

<template>
  <CrudPage
    title="生产工单"
    permission="business:pro:workorder"
    :api="api"
    :fields="fields"
    id-key="workorderId"
  />
</template>
