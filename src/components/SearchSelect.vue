<script setup lang="ts">
import { computed } from 'vue'
import type { SearchOption } from '@/composables/useRemoteOptions'

defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{
  modelValue?: string | null
  options: SearchOption[]
  selectedOption?: SearchOption | null
  disabled?: boolean
  loading?: boolean
  resolving?: boolean
  hasMore?: boolean
  error?: string
  resolveError?: string
  placeholder?: string
  clearable?: boolean
}>(), { modelValue: null, selectedOption: null, error: '', resolveError: '', clearable: true, placeholder: '搜索并选择' })
const emit = defineEmits<{
  'update:modelValue': [value: string | null]
  search: [keyword: string]
  loadMore: []
  retry: []
  resolveRetry: []
  open: []
}>()
const selected = computed(() => {
  if (props.selectedOption?.value === props.modelValue) return props.selectedOption
  return props.options.find(row => row.value === props.modelValue)
})
const display = computed(() => {
  if (selected.value) return selected.value.label
  if (!props.modelValue) return '—'
  if (props.resolving) return '正在读取…'
  return `待确认（${props.modelValue}）`
})
const visibleOptions = computed(() => {
  if (selected.value && !props.options.some(row => row.value === selected.value?.value)) return [selected.value, ...props.options]
  return props.options
})
function choose(value: string | undefined) {
  if (!props.disabled) emit('update:modelValue', value || null)
}
</script>

<template>
  <div class="search-select" v-bind="$attrs">
    <span v-if="disabled" class="search-select__text" :title="display">{{ display }}</span>
    <el-select
      v-else
      :model-value="modelValue"
      :clearable="clearable"
      filterable
      popper-class="mes-search-select-dropdown"
      remote
      :debounce="0"
      :remote-method="(keyword: string) => emit('search', keyword)"
      :loading="loading"
      :placeholder="placeholder"
      loading-text="查询中"
      :no-data-text="error ? '查询失败，请重试' : '暂无匹配结果'"
      no-match-text="暂无匹配结果"
      @update:model-value="choose"
      @visible-change="(open: boolean) => open && emit('open')"
    >
      <el-option v-for="option in visibleOptions" :key="option.value" :value="option.value" :label="option.label" :disabled="option.disabled" />
      <template v-if="hasMore || error" #footer>
        <div v-if="error" class="search-select__error" role="alert"><span>{{ error }}</span><el-button link type="danger" :disabled="loading" @mousedown.prevent @click.stop="emit('retry')">重试</el-button></div>
        <el-button v-else-if="hasMore" link :loading="loading" :disabled="loading" @mousedown.prevent @click.stop="emit('loadMore')">加载更多</el-button>
      </template>
    </el-select>
    <div v-if="resolveError" class="search-select__error" role="alert"><span>{{ resolveError }}</span><el-button link type="danger" :disabled="resolving" @click="emit('resolveRetry')">重试</el-button></div>
  </div>
</template>

<style scoped>
.search-select { width: 100%; min-width: 0; }
.search-select :deep(.el-select) { width: 100%; min-width: 0; }
.search-select__text { display: block; white-space: normal; overflow-wrap: anywhere; line-height: 1.5; }
.search-select__error { display: flex; align-items: center; gap: 8px; white-space: normal; overflow-wrap: anywhere; color: var(--mes-status-danger); }
:global(.mes-search-select-dropdown) { max-width: min(560px, calc(100vw - 32px)); }
:global(.el-select-dropdown.mes-search-select-dropdown) { width: 100%; min-width: 0 !important; max-width: 100%; }
:global(.mes-search-select-dropdown .el-select-dropdown__item) { height: auto; min-height: 34px; line-height: 1.5; padding-top: 8px; padding-bottom: 8px; white-space: normal; overflow-wrap: anywhere; }
</style>
