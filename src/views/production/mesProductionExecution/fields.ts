import { executionStatusOptions } from '@/lib/production/executionState'
import { displayQuantity } from '@/lib/production/quantity'
import type { Field } from '@/lib/crud'

export const fields: Field[] = [
  {
    key: 'id',
    label: '执行ID',
    kind: 'text',
    readonly: true,
    required: true,
    searchable: true,
    maxLength: 19
  },
  {
    key: 'workorderId',
    label: '工单 ID',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: true,
    maxLength: 19
  },
  {
    key: 'productCode',
    label: '产出品号',
    columnMinWidth: 180,
    format: value => typeof value === 'string' && value.length ? value : '品号未记录',
    kind: 'text',
    readonly: true,
    required: false,
    searchable: false,
    maxLength: 64
  },
  {
    key: 'routingId',
    columnMinWidth: 360,
    label: '实际工艺版本',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: true,
    maxLength: 19
  },
  {
    key: 'targetQty',
    label: '计划执行数量',
    kind: 'decimal',
    fractionDigits: 2,
    format: value => displayQuantity(typeof value === 'string' || typeof value === 'number' ? value : null),
    readonly: false,
    required: true,
    searchable: false,
    maxLength: 20
  },
  {
    key: 'status',
    readonly: true,
    defaultValue: 'READY',
    options: [...executionStatusOptions],
    label: '执行状态',
    kind: 'text',
    required: true,
    searchable: true,
    maxLength: 20
  },
  {
    key: 'startTime',
    label: '开始时间',
    kind: 'datetime',
    readonly: true,
    required: false,
    searchable: false,
    maxLength: 19
  },
  {
    key: 'endTime',
    label: '结束时间',
    kind: 'datetime',
    readonly: true,
    required: false,
    searchable: false,
    maxLength: 19
  },
  {
    key: 'remark',
    label: '生产执行备注',
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
    label: '订正人',
    kind: 'text',
    readonly: true,
    required: false,
    searchable: false,
    maxLength: 64
  },
  {
    key: 'updateTime',
    label: '最后订正时间',
    kind: 'datetime',
    readonly: true,
    required: false,
    searchable: false,
    maxLength: 19
  }
]
