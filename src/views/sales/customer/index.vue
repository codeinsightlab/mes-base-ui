<script setup lang="ts">
import CrudPage from '@/components/CrudPage.vue'
import { customerApi } from '@/api/sales/customer'
import type { Field } from '@/lib/crud'
const statusOptions = [
  { label: '启用', value: 'ENABLED', tone: 'success' as const },
  { label: '停用', value: 'DISABLED', tone: 'info' as const }
]
const statusLabel = (value: unknown) => statusOptions.find(option => option.value === value)?.label
  ?? (value == null || value === '' ? '状态待确认' : `未知状态（${String(value)}）`)
const fields: Field[] = [
  { key: 'code', label: '客户编码', kind: 'text', required: true, maxLength: 64, searchable: true, columnMinWidth: 180 },
  { key: 'name', label: '客户名称', kind: 'text', required: true, maxLength: 255, searchable: true, columnMinWidth: 200 },
  { key: 'shortName', label: '客户简称', kind: 'text', maxLength: 128, columnMinWidth: 160 },
  { key: 'contactPerson', label: '联系人', kind: 'text', maxLength: 128, columnMinWidth: 140 },
  { key: 'contactPhone', label: '联系电话', kind: 'text', maxLength: 64, columnMinWidth: 150 },
  { key: 'address', label: '联系地址', kind: 'textarea', maxLength: 500, columnMinWidth: 220 },
  { key: 'status', label: '状态', kind: 'select', required: true, defaultValue: 'ENABLED', options: statusOptions, format: statusLabel, columnMinWidth: 100 },
  { key: 'remark', label: '备注', kind: 'textarea', maxLength: 500, columnMinWidth: 200 }
]
</script>
<template><CrudPage title="客户管理" :api="customerApi" :fields="fields" permission="business:mes:customer" permission-scope="factory" list-action="list" detail-action="query" revision-field="revision" editor-width="min(880px,92vw)" /></template>
