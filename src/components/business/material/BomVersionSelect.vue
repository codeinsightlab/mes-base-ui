<script setup lang="ts">
import { computed, nextTick, watch } from 'vue'
import SearchSelect from '@/components/SearchSelect.vue'
import { useRemoteOptions, type SearchOption } from '@/composables/useRemoteOptions'
import { bomApi, type Bom } from '@/api/basic/materialBom'
import { useAuth } from '@/stores/auth'
const props = defineProps<{ modelValue?: string | null; materialId?: string | null; disabled?: boolean; allowDraft?: boolean; placeholder?: string }>()
const emit = defineEmits<{ 'update:modelValue': [string | null]; selected: [Bom | null] }>()
const auth = useAuth()
const allowed = computed(() => !!auth.factoryId && !auth.factorySwitching && !!props.materialId && auth.hasPermission('business:material:list', 'factory'))

function toOption(row: Bom): SearchOption<Bom> {
  return { value: row.id, label: `${row.code} · ${row.version}${row.status === 'DRAFT' ? ' · 草稿' : ''}${row.defaultVersion ? ' · 默认' : ''}`, disabled: row.status === 'DISABLED', data: row }
}

const { items, selected, loading, resolving, error, resolveError, search, scheduleSearch, retry, open, hydrate, reset } = useRemoteOptions<Bom>({
  modelValue: () => props.modelValue,
  enabled: () => allowed.value,
  disabled: () => !!props.disabled,
  search: async({ keyword, offset, limit }) => {
    const page = await bomApi.list({ productId: props.materialId!, ...(keyword ? { code: keyword } : {}), ...(props.allowDraft ? {} : { status: 'PUBLISHED' }), offset, limit })
    return { items: (page.items as Bom[]).map(toOption) }
  },
  resolve: async value => {
    if (!auth.hasPermission('business:material:query', 'factory')) return null
    const row = await bomApi.detail!(value) as Bom
    if (row.productId !== props.materialId || (row.status !== 'PUBLISHED' && !(props.allowDraft && row.status === 'DRAFT'))) throw new Error('已保存的BOM版本不属于当前产品或已不可用，请刷新工单核对')
    return toOption(row)
  }
})
watch(selected, option => {
  if (option?.data) emit('selected', option.data)
})

function choose(value: string | null) {
  emit('update:modelValue', value)
  if (!value) {
    emit('selected', null)
    return
  }
  const row = items.value.find(option => option.value === value) ?? selected.value
  if (row?.data) emit('selected', row.data)
}

let contextVersion = 0
watch(() => [auth.factoryId, auth.revision, auth.factoryPermissions.join('|'), allowed.value, props.materialId, props.allowDraft], async(_, previous) => {
  const current = ++contextVersion
  reset()
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
    :placeholder="placeholder || (allowDraft ? '选择子BOM版本；不选则为本层叶项' : '选择已发布子BOM；不选则为本层叶项')"
    @update:model-value="choose"
    @search="scheduleSearch"
    @retry="retry"
    @resolve-retry="hydrate"
    @open="open"
  />
</template>
