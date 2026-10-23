import { displayQuantity } from '@/lib/production/quantity'
import type { Field } from '@/lib/crud'

export const headerFields: Field[] = [
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
    options: [{ label: '草稿', value: 'DRAFT', tone: 'info' }, { label: '提交中', value: 'SUBMITTING', tone: 'warning' }, { label: '提交待核实', value: 'SUBMIT_UNKNOWN', tone: 'warning' }, { label: '提交被拒绝', value: 'SUBMIT_REJECTED', tone: 'danger' }, { label: '领料已确认', value: 'CONFIRMED', tone: 'success' }, { label: '已记录', value: 'RECORDED', tone: 'success' }, { label: '作废处理中', value: 'VOID_PENDING', tone: 'warning' }, { label: '外部结果待核实', value: 'VOID_UNKNOWN', tone: 'warning' }, { label: '已作废', value: 'VOIDED', tone: 'info' }],
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

export const itemFields: Field[] = [
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
    kind: 'decimal', fractionDigits: 2, format: value => displayQuantity(typeof value === 'string' || typeof value === 'number' ? value : null),
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
