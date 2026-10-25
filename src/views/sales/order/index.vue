<script setup lang="ts">
import CustomerSelect from '@/components/business/CustomerSelect.vue'
import MaterialSelect from '@/components/business/MaterialSelect.vue'
import MasterDetailDocument from '@/components/document/MasterDetailDocument.vue'
import { salesOrderApi } from '@/api/sales/order'
import { displayQuantity } from '@/lib/production/quantity'
import type { Field, Row } from '@/lib/crud'

const statusOptions = [{ label: '草稿', value: 'DRAFT', tone: 'info' as const }]
const sourceOptions = [
  { label: '本地', value: 'LOCAL' },
  { label: '外部 ERP', value: 'EXTERNAL' }
]
const statusLabel = (value: unknown) => statusOptions.find(option => option.value === value)?.label
  ?? (value == null || value === '' ? '状态待确认' : `未知状态（${String(value)}）`)
const quantityLabel = (value: unknown) => displayQuantity(typeof value === 'string' || typeof value === 'number' ? value : null)

const headerFields: Field[] = [
  { key: 'orderNo', label: '订单编号', kind: 'text', readonly: true, searchable: true, columnMinWidth: 220 },
  { key: 'customerId', label: '客户', kind: 'text', required: true, searchable: true, columnMinWidth: 200 },
  { key: 'orderDate', label: '订单日期', kind: 'date', required: true, searchable: true, columnMinWidth: 130 },
  { key: 'status', label: '状态', kind: 'select', readonly: true, searchable: true, options: statusOptions, format: statusLabel, columnMinWidth: 100 },
  { key: 'sourceType', label: '来源', kind: 'select', readonly: true, searchable: true, options: sourceOptions, columnMinWidth: 120 },
  { key: 'remark', label: '备注', kind: 'textarea', maxLength: 500, columnMinWidth: 220 }
]
const itemFields: Field[] = [
  { key: 'materialId', label: '产品', kind: 'text', required: true },
  { key: 'orderedQty', label: '订购数量', kind: 'decimal', fractionDigits: 2, format: quantityLabel, required: true },
  { key: 'requiredDate', label: '要求交期', kind: 'date' },
  { key: 'remark', label: '备注', kind: 'textarea', maxLength: 500 }
]

function validate(items: Row[]) {
  for (const [index, item] of items.entries()) {
    const quantity = String(item.orderedQty ?? '')
    if (!/^\d{1,14}(?:\.\d{1,2})?$/.test(quantity) || Number(quantity) <= 0) {
      return `第${index + 1}行订购数量必须大于0且最多保留两位小数`
    }
  }
  return null
}
</script>

<template>
  <MasterDetailDocument
    title="销售订单"
    :header-api="salesOrderApi"
    :item-api="salesOrderApi"
    :aggregate-api="{ detail: salesOrderApi.document, create: salesOrderApi.create, update: salesOrderApi.update }"
    :header-fields="headerFields"
    :item-fields="itemFields"
    header-permission="business:mes:sales:order"
    item-permission="business:mes:sales:order:item"
    parent-key="salesOrderId"
    revision-field="revision"
    :validate-aggregate-items="validate"
    header-table-key="sales-order"
    :header-readonly="row => row.status !== 'DRAFT'"
  >
    <template #field-customerId="{ draft, disabled }">
      <CustomerSelect v-model="draft.customerId as any" :disabled="disabled" />
    </template>
    <template #search-customerId="{ search }">
      <CustomerSelect :model-value="search.customerId || null" @update:model-value="search.customerId = $event || ''" />
    </template>
    <template #items="{ items, writable, saving, add, remove }">
      <div class="document-toolbar">
        <el-button type="primary" plain :disabled="!writable" @click="add({ materialId: null, orderedQty: '', requiredDate: null, remark: '' })">
          添加产品行
        </el-button>
        <span class="document-toolbar-hint">数量最多两位小数，整数不显示小数位</span>
      </div>
      <el-table :data="items" border stripe>
        <el-table-column type="index" label="#" width="64" />
        <el-table-column label="产品" min-width="220">
          <template #default="{ row }"><MaterialSelect v-model="row.materialId as any" :disabled="!writable" /></template>
        </el-table-column>
        <el-table-column label="订购数量" width="160" align="right">
          <template #default="{ row }">
            <el-input v-model="row.orderedQty as any" inputmode="decimal" maxlength="17" :disabled="!writable" placeholder="最多两位小数" />
          </template>
        </el-table-column>
        <el-table-column label="要求交期" width="190">
          <template #default="{ row }">
            <el-date-picker v-model="row.requiredDate as any" type="date" value-format="YYYY-MM-DD" :disabled="!writable" />
          </template>
        </el-table-column>
        <el-table-column label="备注" min-width="220">
          <template #default="{ row }"><el-input v-model="row.remark as any" maxlength="500" :disabled="!writable" /></template>
        </el-table-column>
        <el-table-column label="操作" width="88" fixed="right">
          <template #default="{ $index }"><el-button link type="danger" :disabled="!writable || saving" @click="remove($index)">移除</el-button></template>
        </el-table-column>
      </el-table>
    </template>
    <template #header-actions="{ row }">
      <el-tag type="info" effect="plain">{{ statusLabel(row.status || 'DRAFT') }}</el-tag>
    </template>
  </MasterDetailDocument>
</template>

<style scoped>
.document-toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.document-toolbar-hint { color: var(--ui-text-muted); font-size: 12px; }
.document-items :deep(.el-date-editor), .document-items :deep(.el-select), .document-items :deep(.el-input) { width: 100%; }
</style>
