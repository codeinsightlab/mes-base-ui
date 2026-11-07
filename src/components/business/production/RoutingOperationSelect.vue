<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import SearchSelect from '@/components/SearchSelect.vue'
import { useRemoteOptions } from '@/composables/useRemoteOptions'
import { api, type ReferenceOption } from '@/api/production/routing'
import { useAuth } from '@/stores/auth'
const props = defineProps<{ modelValue: string; option?: ReferenceOption; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [string]; selected: [ReferenceOption] }>()
const auth = useAuth()
const allowed = computed(() => !!auth.factoryId && !auth.factorySwitching && auth.hasPermission('routing:query', 'factory') && auth.hasPermission('routing:update', 'factory'))
const toOption = (row:ReferenceOption) => ({ value: row.id, label: `${row.code} · ${row.name}`, data: row })
const options = useRemoteOptions<ReferenceOption>({
  modelValue: () => props.modelValue,
  enabled: () => allowed.value && !props.disabled,
  // Wait for an explicit open, including when the detail finishes loading.
  disabled: () => false,
  search: async({ keyword }) => {
    const rows = await api.operations(keyword)
    // This reference API returns at most 100 rows and has no offset contract.
    return { items: rows.map(toOption), total: rows.length, nextOffset: rows.length }
  }
})
const snapshotScope = ref([auth.factoryId, auth.revision].join(':'))
watch(() => props.option, () => { snapshotScope.value = [auth.factoryId, auth.revision].join(':') })
const selected = computed(() => {
  if (!allowed.value) return null
  if (options.selected.value) return options.selected.value
  if (snapshotScope.value !== [auth.factoryId, auth.revision].join(':') || props.option?.id !== props.modelValue) return null
  return toOption(props.option)
})
function choose(value:string | null) {
  emit('update:modelValue', value ?? '')
  const option = options.items.value.find(row => row.value === value)
  if (option?.data) emit('selected', option.data)
}
watch(() => [auth.factoryId, auth.revision, auth.factoryPermissions.join('|'), allowed.value, props.disabled], options.reset, { flush: 'sync' })
</script>
<template>
  <SearchSelect
    :model-value="modelValue"
    :options="options.items.value"
    :selected-option="selected"
    :loading="options.loading.value"
    :error="options.error.value"
    :disabled="disabled || !allowed"
    placeholder="搜索并选择工序"
    @update:model-value="choose"
    @search="options.scheduleSearch"
    @open="options.open"
    @retry="options.retry"
  />
  <small v-if="options.items.value.length >= 100">匹配较多，请细化工序名称继续检索。</small>
</template>
