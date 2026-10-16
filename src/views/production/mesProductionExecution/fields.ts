import type { Field } from '@/lib/crud'

export const fields: Field[] = [
  {
    key: 'id',
    label: 'ID',
    kind: 'text',
    readonly: true,
    required: true,
    searchable: false,
    maxLength: 19
  },
  {
    key: 'executionNo',
    columnMinWidth: 200,
    label: '执行编号',
    kind: 'text',
    readonly: true,
    required: false,
    searchable: true,
    maxLength: 64
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
    key: 'productId',
    label: '产出产品 ID',
    kind: 'text',
    readonly: true,
    required: false,
    searchable: false,
    maxLength: 19
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
    readonly: false,
    required: true,
    searchable: false,
    maxLength: 20
  },
  {
    key: 'status',
    readonly: true,
    defaultValue: 'READY',
    options: [{ label: '待执行', value: 'READY', tone: 'info' }, { label: '执行中', value: 'RUNNING', tone: 'warning' }, { label: '已结束', value: 'COMPLETED', tone: 'success' }, { label: '已取消', value: 'CANCELLED', tone: 'danger' }],
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
