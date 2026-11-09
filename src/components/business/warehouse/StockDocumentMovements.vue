<script setup lang="ts">
import { computed } from 'vue'
import type { StockMovement } from '@/api/wm/stockDocuments'
import { formatQuantity } from '@/lib/quantity'

const props = defineProps<{ movements?: unknown }>()
const rows = computed(() => Array.isArray(props.movements) ? props.movements as StockMovement[] : [])

const labels: Record<string, string> = {
  ISSUE: '原始出库',
  OTHER_ISSUE: '原始出库',
  OTHER_RECEIPT: '原始入库',
  RETURN: '正常退料',
  REVERSAL: '撤销冲销'
}

function isDecrease(value: unknown) {
  return formatQuantity(value).startsWith('-')
}

function signed(value: unknown) {
  const quantity = formatQuantity(value)
  if (quantity === '—') return quantity
  return quantity.startsWith('-') ? quantity : `+${quantity}`
}
</script>

<template>
  <section class="stock-movements" aria-label="库存变动记录">
    <h3>库存变动记录</h3>
    <el-empty v-if="!rows.length" description="暂无库存动作" :image-size="48" />
    <el-table v-else :data="rows" size="small" border>
      <el-table-column label="动作" min-width="110">
        <template #default="{ row }">{{ labels[row.actionType] || '库存动作' }}</template>
      </el-table-column>
      <el-table-column label="库存变化" width="130" align="right">
        <template #default="{ row }"><span :class="isDecrease(row.quantityDelta) ? 'decrease' : 'increase'">{{ signed(row.quantityDelta) }}</span></template>
      </el-table-column>
      <el-table-column label="明细 / 批次" min-width="150">
        <template #default="{ row }">#{{ row.documentLineId }} · {{ row.batchNo || '无批次' }}{{ row.binCode ? ` / ${row.binCode}` : '' }}</template>
      </el-table-column>
      <el-table-column label="时间" min-width="175" prop="occurredAt" />
      <el-table-column label="关联原动作" min-width="180">
        <template #default="{ row }">{{ row.referenceActionId || '—' }}</template>
      </el-table-column>
      <el-table-column label="操作组" min-width="180">
        <template #default="{ row }">{{ row.operationId || '—' }}</template>
      </el-table-column>
      <el-table-column label="操作人" width="100">
        <template #default="{ row }">{{ row.operatorUserId ? `用户 ${row.operatorUserId}` : '—' }}</template>
      </el-table-column>
      <el-table-column label="原因" min-width="180" show-overflow-tooltip prop="reason" />
    </el-table>
  </section>
</template>

<style scoped>
.stock-movements { margin-top: var(--ui-space-4); }
.stock-movements h3 { margin: 0 0 var(--ui-space-2); }
.increase { color: var(--el-color-success); }
.decrease { color: var(--el-color-warning); }
</style>
