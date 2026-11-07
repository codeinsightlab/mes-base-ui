<script setup lang="ts">
import { computed, nextTick, watch } from 'vue'
import SearchSelect from '@/components/SearchSelect.vue'
import { useRemoteOptions, type SearchOption } from '@/composables/useRemoteOptions'
import { businessSourceLabel } from '@/lib/businessSource'
import { api, type WmWarehouseVo } from '@/api/wm/wmWarehouse'
import { useAuth } from '@/stores/auth'

const props = defineProps<{ modelValue?: string | null; disabled?: boolean; source?: 'LOCAL' | 'EXTERNAL' | null; history?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>()
const auth = useAuth()
const expectedSource = computed(() => props.history ? null : props.source ?? (auth.runtimeMode === 'LOCAL' ? 'LOCAL' : auth.runtimeMode === 'ERP' ? 'EXTERNAL' : null))
const allowed = computed(() => !!auth.factoryId && !auth.factorySwitching && (props.history || !!expectedSource.value)
  && auth.hasPermission('business:wm:warehouse:list', 'factory'))
function toOption(row: WmWarehouseVo): SearchOption<WmWarehouseVo> {
  return { value: row.id, label: `${row.code} · ${row.name} · ${businessSourceLabel(row.source)}`, data: row }
}
const { items, selected, loading, resolving, error, resolveError, hasMore, search, scheduleSearch, loadMore, retry, open, hydrate, reset } = useRemoteOptions<WmWarehouseVo>({
  modelValue: () => props.modelValue,
  enabled: () => allowed.value,
  disabled: () => !!props.disabled,
  search: async({ keyword, offset, limit }) => {
    const page = await api.list({ name: keyword, offset, limit, ...(expectedSource.value ? { source: expectedSource.value } : {}) })
    const matching = page.items.filter(row => !expectedSource.value || row.source === expectedSource.value)
    return { items: matching.map(toOption), total: page.total, nextOffset: offset + page.items.length }
  },
  resolve: async value => {
    if (!auth.hasPermission('business:wm:warehouse:query', 'factory')) return null
    const row = await api.detail(value)
    if (expectedSource.value && row.source !== expectedSource.value) throw new Error('仓库来源与当前业务不一致')
    return toOption(row)
  }
})
watch(resolveError, message => { if (message === '仓库来源与当前业务不一致') emit('update:modelValue', null) })
let contextVersion = 0
watch(() => [auth.factoryId, auth.revision, auth.factoryPermissions.join('|'), expectedSource.value, allowed.value], async(_, previous) => {
  const current = ++contextVersion
  reset()
  if (previous && props.modelValue) emit('update:modelValue', null)
  if (previous) await nextTick()
  if (current !== contextVersion) return
  if (allowed.value) { if (!props.disabled) void search(''); void hydrate() }
}, { immediate: true, flush: 'sync' })
</script>

<template>
  <SearchSelect
    :model-value="modelValue"
    :options="items"
    :selected-option="selected"
    :disabled="disabled || !allowed"
    :loading="loading"
    :resolving="resolving"
    :has-more="hasMore"
    :error="error"
    :resolve-error="resolveError"
    placeholder="搜索仓库名称"
    @update:model-value="emit('update:modelValue', $event)"
    @search="scheduleSearch"
    @load-more="loadMore"
    @retry="retry"
    @resolve-retry="hydrate"
    @open="open"
  />
</template>
