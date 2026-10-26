<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import PageDialog from '@/components/page/PageDialog.vue'
import WarehouseSelect from '@/components/business/WarehouseSelect.vue'
import StockSourceSelect from '@/components/business/warehouse/StockSourceSelect.vue'
import QuantityText from '@/components/business/production/QuantityText.vue'
import QuantityInput from '@/components/business/material/QuantityInput.vue'
import { normalizedQuantityInput, positiveQuantity } from '@/lib/production/quantityRules'
import { stockDocuments, stockDocumentPermission as p, type ProductionBasis, type ProductionReceiptCommand } from '@/api/wm/stockDocuments'
import type { WmInventoryVo } from '@/api/wm/wmInventory'
import { useAuth } from '@/stores/auth'
import { useClosureCommand } from '@/composables/useClosureCommand'
import { usePageMessageBox } from '@/lib/pageMessageBox'
const props = defineProps<{ executionId: string }>()
const emit = defineEmits<{ changed: [] }>()
const auth = useAuth(), messageBox = usePageMessageBox()
const allowed = computed(() => auth.runtimeMode === 'LOCAL' && auth.hasPermission(p + ':create', 'factory') && auth.hasPermission(p + ':post', 'factory'))
const visible = ref(false), basis = ref<ProductionBasis | null>(null), loading = ref(false), error = ref('')
const warehouseId = ref<string | null>(null), stockId = ref<string | null>(null), stock = ref<WmInventoryVo | null>(null)
const unitId = ref(''), quantity = ref(''), quantityValid = ref(false), reason = ref('')
const intent = useClosureCommand<ProductionReceiptCommand>(() => `production-receipt:${auth.username}:${auth.factoryId}:${props.executionId}`)
let generation = 0
function clear() {
  generation++; visible.value = false; basis.value = null; loading.value = false; error.value = ''
  warehouseId.value = null; stockId.value = null; stock.value = null; unitId.value = ''; quantity.value = ''; quantityValid.value = false; reason.value = ''; intent.clear()
}
watch(() => [props.executionId, auth.factoryId, auth.revision, auth.factoryPermissions.join('|'), auth.runtimeMode], clear, { flush: 'sync' })
watch(warehouseId, () => { stockId.value = null; stock.value = null; unitId.value = '' }, { flush: 'sync' })
onBeforeUnmount(clear)
async function load() {
  if (!allowed.value) return
  const g = ++generation; loading.value = true; error.value = ''
  try { const data = await stockDocuments.productionBasis(props.executionId); if (g === generation) basis.value = data } catch(e) { if (g === generation) error.value = e instanceof Error ? e.message : '入库依据读取失败' } finally { if (g === generation) loading.value = false }
}
function open() { if (!allowed.value) return; clear(); intent.restore(); visible.value = true; void load() }
function selectStock(value: WmInventoryVo, unit: string) { stock.value = value; unitId.value = unit }
async function submit() {
  if (!allowed.value || intent.busy.value) return
  if (!intent.pending.value && (!basis.value?.canReceive || !stock.value || !quantityValid.value || !positiveQuantity(normalizedQuantityInput(quantity.value)) || !reason.value.trim())) {
    error.value = '请核对可入库数量，选择确切库存来源并填写数量和原因'; return
  }
  const g = generation
  await intent.run(() => ({ requestId: crypto.randomUUID(), stockId: stockId.value!, quantity: normalizedQuantityInput(quantity.value), reason: reason.value }),
    command => stockDocuments.receiveProduction(props.executionId, command), async() => {
      if (g !== generation) return
      quantity.value = ''; reason.value = ''; await load(); if (g + 1 === generation) emit('changed')
    })
}
async function close(done?: () => void) {
  const g = generation
  if (!intent.pending.value && (warehouseId.value || quantity.value || reason.value)) {
    try { await messageBox.confirm('放弃尚未提交的入库信息？', '未保存的修改', { type: 'warning' }) } catch { return }
  }
  if (g !== generation) return
  clear(); if (done) done()
}
</script>
<template>
  <el-button v-if="allowed" link type="primary" @click="open">确认生产入库</el-button>
  <PageDialog v-model="visible" title="生产入库并审核" width="640px" append-to-body destroy-on-close :before-close="close">
    <el-alert title="确认后由后端在同一本地事务新增正式入库单、明细并审核；审核成功即增加库存，并核对执行及工单收尾。" type="info" :closable="false" />
    <el-alert v-if="error || intent.error.value" :title="error || intent.error.value" type="error" :closable="false" />
    <el-button :loading="loading" :disabled="intent.busy.value" @click="load">刷新入库依据</el-button>
    <div v-if="basis">
      <p>执行 {{ executionId }} · 有效产出 <QuantityText :value="basis.effective" /> · 已入库 <QuantityText :value="basis.received" /> · 可入库 <QuantityText :value="basis.remaining" /></p>
      <el-alert v-if="basis.blockedReason" :title="basis.blockedReason" type="warning" :closable="false" />
      <el-form label-position="top" :disabled="intent.busy.value || !!intent.pending.value">
        <el-form-item label="LOCAL入库仓库"><WarehouseSelect v-model="warehouseId" source="LOCAL" /></el-form-item>
        <el-form-item label="产品批次及库位"><StockSourceSelect v-model="stockId" :material-id="basis.productId" :warehouse-id="warehouseId" receipt @selected="selectStock" /></el-form-item>
        <p v-if="stock">批次原文：{{ stock.batchNo }} · 库位：{{ stock.binCode || '无库位' }} · 基本单位：{{ unitId }}</p>
        <el-form-item label="本次入库数量"><QuantityInput v-model="quantity" :material-id="basis.productId" required positive :disabled="intent.busy.value || !!intent.pending.value" @validity="quantityValid = $event" /></el-form-item>
        <el-form-item label="入库原因 / 实物依据"><el-input v-model="reason" type="textarea" maxlength="500" /></el-form-item>
      </el-form>
    </div>
    <el-alert v-if="intent.pending.value" :title="'原请求 '+intent.pending.value.requestId+'，数量 '+intent.pending.value.quantity+'。结果待确认，只能使用原请求核对。'" type="warning" :closable="false" />
    <template #footer><el-button @click="close()">关闭</el-button><el-button type="primary" :loading="intent.busy.value" :disabled="!intent.pending.value && (!basis?.canReceive || !stockId || loading)" @click="submit">{{ intent.pending.value ? '核对原入库请求' : '确认新增并审核' }}</el-button></template>
  </PageDialog>
</template>
