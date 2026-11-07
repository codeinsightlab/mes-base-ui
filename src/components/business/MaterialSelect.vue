<script setup lang="ts">
import { computed, nextTick, watch } from 'vue'
import SearchSelect from '@/components/SearchSelect.vue'
import { useRemoteOptions, type SearchOption } from '@/composables/useRemoteOptions'
import { api, type MaterialVo } from '@/api/basic/material'
import { useAuth } from '@/stores/auth'

const props = defineProps<{ modelValue?: string | null; disabled?: boolean; status?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>()
const auth = useAuth()
const allowed = computed(() => !!auth.factoryId && !auth.factorySwitching && auth.hasPermission('business:material:list', 'factory'))

function toOption(row: MaterialVo): SearchOption<MaterialVo> {
  return { value: String(row.id), label: `${row.code} · ${row.name}`, data: row }
}

const { items, selected, loading, resolving, error, resolveError, search, scheduleSearch, retry, open, hydrate, reset } = useRemoteOptions<MaterialVo>({
  modelValue: () => props.modelValue,
  enabled: () => allowed.value,
  disabled: () => !!props.disabled,
  search: async({ keyword, offset, limit }) => {
    const page = await api.list({ keyword: keyword, offset, limit, ...(props.status ? { status: props.status } : {}) })
    return { items: page.items.map(toOption) }
  },
  resolve: async value => {
    if (!auth.hasPermission('business:material:query', 'factory')) return null
    return toOption(await api.detail(value))
  }
})
let contextVersion = 0
watch(() => [auth.factoryId, auth.revision, auth.factoryPermissions.join('|'), allowed.value, props.status], async(_, previous) => {
  const current = ++contextVersion
  reset()
  if (previous && props.modelValue) emit('update:modelValue', null)
  if (previous) await nextTick()
  if (current !== contextVersion) return
  if (allowed.value) {
    if (!props.disabled) void search('')
    void hydrate()
  }
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
    :error="error"
    :resolve-error="resolveError"
    placeholder="搜索物料名称"
    @update:model-value="emit('update:modelValue', $event)"
    @search="scheduleSearch"
    @retry="retry"
    @resolve-retry="hydrate"
    @open="open"
  />
</template>
