<script setup lang="ts">
import MaterialSelect from '@/components/business/MaterialSelect.vue'
import MasterDetailDocument from '@/components/document/MasterDetailDocument.vue'
import { productionPlanApi } from '@/api/production/plan'
import { displayQuantity } from '@/lib/production/quantity'
import type { Field, Row } from '@/lib/crud'

const statusOptions = [{ label: '草稿', value: 'DRAFT', tone: 'info' as const }]
const statusLabel = (value: unknown) => statusOptions.find(option => option.value === value)?.label
  ?? (value == null || value === '' ? '状态待确认' : `未知状态（${String(value)}）`)
const quantityLabel = (value: unknown) => displayQuantity(typeof value === 'string' || typeof value === 'number' ? value : null)

const headerFields: Field[] = [
  { key: 'planNo', label: '计划编号', kind: 'text', readonly: true, columnMinWidth: 220 },
  { key: 'planDate', label: '计划日期', kind: 'date', required: true, columnMinWidth: 130 },
  { key: 'status', label: '状态', kind: 'select', readonly: true, options: statusOptions, format: statusLabel, columnMinWidth: 100 },
  { key: 'remark', label: '备注', kind: 'textarea', maxLength: 500, columnMinWidth: 240 }
]
const itemFields: Field[] = [
  { key: 'materialId', label: '产品', kind: 'text', required: true },
  { key: 'plannedQty', label: '计划数量', kind: 'decimal', fractionDigits: 2, format: quantityLabel, required: true },
  { key: 'plannedStartAt', label: '计划开始', kind: 'datetime' },
  { key: 'plannedEndAt', label: '计划完成', kind: 'datetime' },
  { key: 'priority', label: '优先级', kind: 'number' },
  { key: 'remark', label: '备注', kind: 'textarea', maxLength: 500 }
]

function validate(items: Row[]) {
  for (const [index, item] of items.entries()) {
    const quantity = String(item.plannedQty ?? '')
    if (!/^\d{1,14}(?:\.\d{1,2})?$/.test(quantity) || Number(quantity) <= 0) {
      return `第${index + 1}行计划数量必须大于0且最多保留两位小数`
    }
    if (item.plannedStartAt && item.plannedEndAt && String(item.plannedEndAt) < String(item.plannedStartAt)) {
      return `第${index + 1}行计划完成时间不得早于开始时间`
    }
  }
  return null
}
</script>

<template>
  <MasterDetailDocument
    title="生产计划"
    :header-api="productionPlanApi"
    :item-api="productionPlanApi"
    :aggregate-api="{ detail: productionPlanApi.document, create: productionPlanApi.create, update: productionPlanApi.update }"
    :header-fields="headerFields"
    :item-fields="itemFields"
    header-permission="business:mes:production:plan"
    item-permission="business:mes:production:plan:item"
    parent-key="planId"
    revision-field="revision"
    :validate-aggregate-items="validate"
    header-table-key="production-plan"
    :header-readonly="row => row.status !== 'DRAFT'"
  >
    <template #items="{ items, writable, saving, remove }">
      <div class="document-toolbar">
        <el-button
          type="primary"
          plain
          :disabled="!writable"
          @click="items.push({ materialId: null, plannedQty: '', plannedStartAt: null, plannedEndAt: null, priority: 0, remark: '' })"
        >添加计划行</el-button>
        <span class="document-toolbar-hint">数量最多两位小数，整数不显示小数位</span>
      </div>
      <el-table :data="items" border stripe>
        <el-table-column type="index" label="#" width="64" />
        <el-table-column label="产品" min-width="220">
          <template #default="{ row }"><MaterialSelect v-model="row.materialId as any" :disabled="!writable" /></template>
        </el-table-column>
        <el-table-column label="计划数量" width="150" align="right">
          <template #default="{ row }">
            <el-input v-model="row.plannedQty as any" inputmode="decimal" maxlength="17" :disabled="!writable" placeholder="最多两位小数" />
          </template>
        </el-table-column>
        <el-table-column label="计划开始" min-width="190">
          <template #default="{ row }">
            <el-date-picker v-model="row.plannedStartAt as any" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" :disabled="!writable" />
          </template>
        </el-table-column>
        <el-table-column label="计划完成" min-width="190">
          <template #default="{ row }">
            <el-date-picker v-model="row.plannedEndAt as any" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" :disabled="!writable" />
          </template>
        </el-table-column>
        <el-table-column label="优先级" width="120" align="center">
          <template #default="{ row }"><el-input-number v-model="row.priority as any" :disabled="!writable" /></template>
        </el-table-column>
        <el-table-column label="备注" min-width="200">
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
</style>
