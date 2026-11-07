<script setup lang="ts">
import { computed, nextTick, watch } from 'vue'
import SearchSelect from '@/components/SearchSelect.vue'
import { useRemoteOptions, type SearchOption } from '@/composables/useRemoteOptions'
import { stockDocuments, type Header } from '@/api/wm/stockDocuments'
import { useAuth } from '@/stores/auth'
const props = defineProps<{ modelValue: string | null; stockId: string; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [string | null] }>()
const auth = useAuth()
const stockList = computed(() => auth.hasPermission('business:wm:stock:document:list', 'factory'))
const allowed = computed(() => !!props.stockId && !!auth.factoryId && !auth.factorySwitching && (stockList.value || auth.hasPermission('business:mes:material:issue:list', 'factory')))
const option = (row: Header): SearchOption<Header> => ({ value: row.id, label: row.documentNo, data: row })
const { items, selected, loading, resolving, error, resolveError, search, scheduleSearch, retry, open, hydrate, reset } = useRemoteOptions<Header>({
  modelValue: () => props.modelValue, enabled: () => allowed.value, disabled: () => !!props.disabled,
  search: async({ keyword, offset, limit }) => {
    const page = await stockDocuments.list({ documentType: 'MATERIAL_ISSUE', status: 'POSTED', stockId: props.stockId, documentNo: keyword, offset, limit }, 'OUT')
    return { items: page.items.map(option) }
  },
  resolve: async id => {
    const stockQuery = auth.hasPermission('business:wm:stock:document:query', 'factory')
    if (!stockQuery && !auth.hasPermission('business:mes:material:issue:query', 'factory')) return null
    const result = await stockDocuments.detail(id, 'OUT', !stockQuery)
    if (result.document.documentType !== 'MATERIAL_ISSUE') throw new Error('请选择生产领料单')
    return option(result.document)
  }
})
const selectedDisplay = computed(() => {
  if (selected.value) return selected.value
  if (!props.modelValue) return null
  return { value: props.modelValue, label: '领料单名称待确认' }
})
let version = 0
watch(() => [props.stockId, auth.factoryId, auth.revision, auth.factoryPermissions.join('|'), allowed.value], async(_, previous) => {
  const ticket = ++version
  reset()
  if (previous && props.modelValue) emit('update:modelValue', null)
  if (previous) await nextTick()
  if (ticket !== version || !allowed.value) return
  if (!props.disabled) void search('')
  void hydrate()
}, { immediate: true, flush: 'sync' })
</script>
<template>
  <div>
    <SearchSelect
      :model-value="modelValue"
      :options="items"
      :selected-option="selectedDisplay"
      :disabled="disabled || !allowed"
      :loading="loading"
      :resolving="resolving"
      :error="error"
      :resolve-error="resolveError"
      placeholder="搜索原领料单号"
      @update:model-value="emit('update:modelValue', $event)"
      @search="scheduleSearch"
      @retry="retry"
      @resolve-retry="hydrate"
      @open="open"
    />
    <span v-if="!stockId" class="secondary">请先选择库存明细</span>
    <span v-else-if="!allowed" class="secondary">没有查询领料单的权限</span>
  </div>
</template>
