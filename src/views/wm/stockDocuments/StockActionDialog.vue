<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import PageDialog from '@/components/page/PageDialog.vue'
import { useAuth } from '@/stores/auth'
import { localStock, type StockAction } from '@/api/wm/localStock'
import { formatQuantity } from '@/lib/quantity'
import { formatValue } from '@/lib/crud'
const auth = useAuth(), visible = ref(false), action = ref<StockAction | null>(null), error = ref(''), loading = ref(false)
let generation = 0
function clear() { generation++; visible.value = false; action.value = null; error.value = ''; loading.value = false }
async function open(id: unknown) {
  if (!id || !auth.hasPermission('business:wm:stock:action:query', 'factory')) return
  clear(); visible.value = true; loading.value = true
  const ticket = generation
  try {
    const result = await localStock.action(String(id))
    if (ticket === generation) action.value = result
  } catch(reason) {
    if (ticket === generation) error.value = reason instanceof Error ? reason.message : '库存记录读取失败'
  } finally { if (ticket === generation) loading.value = false }
}
watch(visible, value => { if (!value) clear() }, { flush: 'sync' })
watch(() => [auth.factoryId, auth.revision, auth.factoryPermissions.join('|')], clear, { flush: 'sync' })
onBeforeUnmount(clear)
defineExpose({ open, clear })
</script>
<template>
  <PageDialog v-model="visible" title="库存变动记录" append-to-body width="720px">
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <p v-if="loading">正在读取库存记录…</p>
    <el-descriptions v-if="action" :column="2" border>
      <el-descriptions-item label="发生时间">{{ formatValue(action.occurredAt, 'datetime') }}</el-descriptions-item>
      <el-descriptions-item label="变动数量">{{ formatQuantity(action.quantityDelta) }}</el-descriptions-item>
      <el-descriptions-item label="批次">{{ action.batchNo || '无批次' }}</el-descriptions-item>
      <el-descriptions-item label="库位">{{ action.binCode || '无库位' }}</el-descriptions-item>
      <el-descriptions-item label="变动前库存">{{ formatQuantity(action.quantityBefore) }}</el-descriptions-item>
      <el-descriptions-item label="变动后库存">{{ formatQuantity(action.quantityAfter) }}</el-descriptions-item>
      <el-descriptions-item label="原因">{{ action.reason || '—' }}</el-descriptions-item>
    </el-descriptions>
  </PageDialog>
</template>
