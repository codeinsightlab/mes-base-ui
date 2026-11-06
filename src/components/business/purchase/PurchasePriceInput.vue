<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { previewPrice } from '@/api/purchase/purchaseReferencePrice'
import { useAuth } from '@/stores/auth'
import type { Row } from '@/lib/crud'
const props = defineProps<{ header: Row;row: Row;disabled: boolean }>()
const emit = defineEmits<{ change: [patch: Row] }>()
const auth = useAuth(), loading = ref(false), error = ref(''), retry = ref(0)
let generation = 0, timer:ReturnType<typeof setTimeout> | undefined
function clear() { generation++;if (timer)clearTimeout(timer);loading.value = false;error.value = '' }
watch(() => [retry.value, auth.factoryId, auth.revision, auth.factorySwitching, props.disabled, props.header.supplierId, props.header.businessDate, props.row.materialId, props.row.quantity, props.row.unitPrice, props.row.remark], () => {
  clear()
  if (props.disabled || auth.factorySwitching) return
  emit('change', { amount: null })
  if (!props.header.supplierId || !props.header.businessDate || !props.row.materialId) return
  const current = generation
  timer = setTimeout(async() => {
    loading.value = true
    try {
      const query:Record<string, string> = { supplierId: String(props.header.supplierId), materialId: String(props.row.materialId), date: String(props.header.businessDate) }
      if (props.row.quantity)query.quantity = String(props.row.quantity)
      if (props.row.unitPrice !== null && props.row.unitPrice !== undefined && props.row.unitPrice !== '')query.unitPrice = String(props.row.unitPrice)
      if (props.row.remark)query.remark = String(props.row.remark)
      const result = await previewPrice(query)
      if (current !== generation) return
      const patch: Row = { referenceUnitPrice: result.reference?.unitPrice ?? null, referencePriceId: result.reference?.id ?? null, amount: result.amount }
      if ((props.row.unitPrice === null || props.row.unitPrice === undefined || props.row.unitPrice === '') && result.reference)patch.unitPrice = result.reference.unitPrice
      emit('change', patch)
    } catch(e) { if (current === generation)error.value = e instanceof Error ? e.message : '价格读取失败' } finally { if (current === generation)loading.value = false }
  }, 300)
}, { immediate: true })
onBeforeUnmount(clear)
</script>
<template><div class="purchase-price-input">
  <el-input v-if="!disabled" :model-value="row.unitPrice as string" inputmode="decimal" aria-label="实际成交单价" placeholder="成交单价" @update:model-value="emit('change', {unitPrice:$event})" />
  <span v-else>{{ row.unitPrice??'—' }}</span>
  <small v-if="loading">正在核算金额…</small>
  <small v-else-if="error" role="alert">{{ error }} <el-button link type="primary" @click="retry++">重试</el-button></small>
  <small v-else>参考价 {{ row.referenceUnitPrice??'无报价' }}</small>
</div></template>
<style scoped>.purchase-price-input{display:flex;flex-direction:column;gap:4px}.purchase-price-input small{color:var(--el-text-color-secondary)}.purchase-price-input [role=alert]{color:var(--el-color-danger)}</style>
