<script setup lang="ts">
import CrudPage from '@/components/CrudPage.vue'
import { api } from '@/api/purchase/purchaseSupplier'
import type { Field } from '@/lib/crud'
const fields: Field[] = [
  { key: 'code', label: '供应商编码', kind: 'text', required: true, searchable: true, maxLength: 64 },
  { key: 'name', label: '供应商名称', kind: 'text', required: true, searchable: true, maxLength: 200, columnMinWidth: 200 },
  { key: 'contactPerson', label: '联系人', kind: 'text', maxLength: 100 },
  { key: 'contactPhone', label: '联系电话', kind: 'text', maxLength: 64 },
  { key: 'address', label: '地址', kind: 'text', maxLength: 500, columnMinWidth: 200 },
  { key: 'status', label: '状态', kind: 'select', required: true, searchable: true, defaultValue: 'ENABLED', options: [{ value: 'ENABLED', label: '启用' }, { value: 'DISABLED', label: '停用' }] },
  { key: 'remark', label: '备注', kind: 'textarea', maxLength: 500 },
  { key: 'createdBy', label: '创建人', kind: 'text', readonly: true, columnVisible: false },
  { key: 'createdAt', label: '创建时间', kind: 'datetime', readonly: true },
  { key: 'updatedBy', label: '修改人', kind: 'text', readonly: true, columnVisible: false },
  { key: 'updatedAt', label: '修改时间', kind: 'datetime', readonly: true }
]
</script>
<template><CrudPage title="供应商" table-key="business:purchase:supplier:list" permission="business:purchase:supplier" list-action="list" detail-action="query" :api="api" :fields="fields" /></template>
