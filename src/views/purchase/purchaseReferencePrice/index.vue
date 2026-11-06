<script setup lang="ts">
import CrudPage from '@/components/CrudPage.vue'
import SupplierSelect from '@/components/business/SupplierSelect.vue'
import MaterialSelect from '@/components/business/MaterialSelect.vue'
import UnitMeasureSelect from '@/components/business/material/UnitMeasureSelect.vue'
import { api } from '@/api/purchase/purchaseReferencePrice'
import { api as materials } from '@/api/basic/material'
import { useAuth } from '@/stores/auth'
import { ElMessage } from 'element-plus'
import type { Field, Row } from '@/lib/crud'
const auth = useAuth()
async function selectMaterial(draft:Row, id:string | null) {
  draft.materialId = id;draft.unitId = null
  if (!id) return
  const revision = auth.revision, factory = auth.factoryId
  try { const row = await materials.detail(id);if (draft.materialId === id && revision === auth.revision && factory === auth.factoryId) draft.unitId = row.unitId } catch(e) { ElMessage.error(e instanceof Error ? e.message : '基本单位读取失败，请重试选择物料') }
}
const fields:Field[] = [
  { key: 'supplierId', label: '供应商', kind: 'text', required: true, searchable: true, columnMinWidth: 200 },
  { key: 'materialId', label: '物料', kind: 'text', required: true, searchable: true, columnMinWidth: 220 },
  { key: 'unitId', label: '基本单位', kind: 'text', required: true },
  { key: 'unitPrice', label: '参考单价', kind: 'decimal', required: true, fractionDigits: 6 },
  { key: 'currency', label: '币种', kind: 'select', required: true, defaultValue: 'CNY', options: [{ value: 'CNY', label: '人民币 CNY' }] },
  { key: 'effectiveDate', label: '生效日期', kind: 'date', required: true, searchable: true },
  { key: 'remark', label: '调价说明（零价必填）', kind: 'textarea', maxLength: 500, columnMinWidth: 200 },
  { key: 'id', label: '修订序号', kind: 'text', readonly: true },
  { key: 'createdAt', label: '录入时间', kind: 'datetime', readonly: true },
  { key: 'createdBy', label: '录入人', kind: 'text', readonly: true, columnVisible: false }
]
</script>
<template>
  <CrudPage title="参考报价历史" table-key="business:purchase:reference:price:list" permission="business:purchase:reference:price" list-action="list" detail-action="query" :api="api" :fields="fields" append-only>
    <template #toolbar><span class="secondary">调价请新增报价；同日以最后追加的报价为准，历史保留。</span></template>
    <template #search-supplierId="{search}"><SupplierSelect v-model="search.supplierId" /></template>
    <template #search-materialId="{search}"><MaterialSelect v-model="search.materialId" /></template>
    <template #field-supplierId="{draft,disabled}"><SupplierSelect v-model="draft.supplierId" :disabled="disabled" status="ENABLED" /></template>
    <template #field-materialId="{draft,disabled}"><MaterialSelect :model-value="draft.materialId" :disabled="disabled" status="ENABLED" @update:model-value="selectMaterial(draft,$event)" /></template>
    <template #field-unitId="{draft}"><UnitMeasureSelect :model-value="draft.unitId" disabled /></template>
    <template #cell-supplierId="{row}">{{ row.supplierName ? `${row.supplierCode} · ${row.supplierName}` : `待确认（${row.supplierId}）` }}</template>
    <template #cell-materialId="{row}">{{ row.materialName ? `${row.materialCode} · ${row.materialName}` : `待确认（${row.materialId}）` }}</template>
    <template #cell-unitId="{row}">{{ row.unitName || `待确认（${row.unitId}）` }}</template>
  </CrudPage>
</template>
