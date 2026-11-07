<script setup lang="ts">
import { computed, nextTick, watch } from 'vue'
import SearchSelect from '@/components/SearchSelect.vue'
import { useRemoteOptions, type SearchOption } from '@/composables/useRemoteOptions'
import { directoryPermissions, getDirectory, listDirectory } from '@/api/business/directory'
import type { DirectoryOption, DirectoryResource } from '@/api/business/directory'
import { useAuth } from '@/stores/auth'

const props = withDefaults(defineProps<{
  modelValue?: string | null
  resource: DirectoryResource
  placeholder?: string
  disabled?: boolean
  clearable?: boolean
  departmentId?: string
}>(), { modelValue: null, placeholder: '搜索并选择', disabled: false, clearable: true, departmentId: undefined })
const emit = defineEmits<{
  'update:modelValue': [value: string | null]
  change: [value: DirectoryOption | null]
}>()
const auth = useAuth()
const canRead = computed(() => !!auth.factoryId && !auth.factorySwitching && auth.hasPermission(directoryPermissions[props.resource], 'factory'))
function toOption(row: DirectoryOption): SearchOption<DirectoryOption> {
  return { value: row.id, label: row.code ? row.name + '（' + row.code + (row.version != null ? ' · V' + row.version : '') + '）' : row.name, data: row }
}
const { items, selected, loading, resolving, error, resolveError, hasMore, search, scheduleSearch, loadMore, retry, open, hydrate, reset } = useRemoteOptions<DirectoryOption>({
  modelValue: () => props.modelValue,
  enabled: () => canRead.value,
  disabled: () => props.disabled,
  search: async({ keyword, offset }) => {
    const page = await listDirectory(props.resource, keyword, offset, props.departmentId)
    return { items: page.items.map(toOption), total: page.total, nextOffset: page.offset + page.items.length }
  },
  resolve: async value => toOption(await getDirectory(props.resource, value))
})
function choose(value: string | null) {
  const option = items.value.find(row => row.value === value) ?? selected.value
  emit('update:modelValue', value)
  emit('change', value && option?.value === value ? option.data ?? null : null)
}
let contextVersion = 0
watch(() => [auth.factoryId, auth.revision, auth.factoryPermissions.join('|'), canRead.value, props.resource, props.departmentId], async(_, previous) => {
  const current = ++contextVersion
  reset()
  if (previous && props.modelValue) { emit('update:modelValue', null); emit('change', null) }
  if (previous) await nextTick()
  if (current !== contextVersion) return
  if (canRead.value) { if (!props.disabled) void search(''); void hydrate() }
}, { immediate: true, flush: 'sync' })
</script>

<template>
  <div class="business-directory-select">
    <SearchSelect
      :model-value="modelValue"
      :options="items"
      :selected-option="selected"
      :disabled="disabled || !canRead"
      :clearable="clearable"
      :placeholder="placeholder"
      :loading="loading"
      :resolving="resolving"
      :has-more="hasMore"
      :error="error"
      :resolve-error="resolveError"
      @update:model-value="choose"
      @search="scheduleSearch"
      @load-more="loadMore"
      @retry="retry"
      @resolve-retry="hydrate"
      @open="open"
    />
    <small v-if="!canRead">{{ auth.factoryId ? '没有查询权限' : '请先选择工厂' }}</small>
  </div>
</template>

<style scoped>
.business-directory-select { width: 100%; min-width: 0; }
small { color: var(--mes-text-secondary); }
</style>
