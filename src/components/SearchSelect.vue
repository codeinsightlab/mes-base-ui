<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from 'vue'
import type { SelectInstance } from 'element-plus'
import { queryFormConfirmKey } from './queryFormContext'
import { searchOptionLimit } from '@/lib/searchOptionSettings'
import type { SearchOption } from '@/composables/useRemoteOptions'

defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{
  modelValue?: string | null
  options: SearchOption[]
  selectedOption?: SearchOption | null
  disabled?: boolean
  loading?: boolean
  resolving?: boolean
  error?: string
  resolveError?: string
  placeholder?: string
  clearable?: boolean
}>(), { modelValue: null, selectedOption: null, error: '', resolveError: '', clearable: true, placeholder: '搜索并选择' })
const emit = defineEmits<{
  'update:modelValue': [value: string | null]
  search: [keyword: string]
  retry: []
  resolveRetry: []
  open: []
  confirm: []
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
// The parent owns the committed ID. Element Plus owns the editable input and
// highlighted option; this mode describes intent, even when the draft is empty.
const mode = ref<'empty' | 'selected' | 'searching'>(props.modelValue ? 'selected' : 'empty')
const pendingConfirmation = ref(false)
const dropdownOpen = ref(false)
const composing = ref(false)
const select = ref<SelectInstance>()
const confirmQuery = inject(queryFormConfirmKey, null)
const visibleOptions = computed(() => {
  const limit = searchOptionLimit.value ?? Math.max(props.options.length, 1)
  const candidates = props.options.slice(0, limit)
  if (mode.value === 'searching') return candidates
  if (selected.value && !candidates.some(row => row.value === selected.value?.value)) return [selected.value, ...candidates].slice(0, limit)
  return candidates
})

function finishEditing() {
  pendingConfirmation.value = false
  composing.value = false
  mode.value = props.modelValue ? 'selected' : 'empty'
}

watch(() => [props.modelValue, props.disabled], () => {
  if (mode.value === 'searching') void cancelEditing()
  else finishEditing()
})

function visibleChange(open: boolean) {
  dropdownOpen.value = open
  if (open) emit('open')
}

async function cancelEditing(keepFocus = false) {
  finishEditing()
  select.value?.blur()
  if (keepFocus) {
    await nextTick()
    select.value?.focus()
  }
}

function onKeydown(event: KeyboardEvent) {
  if (!(event.target instanceof HTMLInputElement) || props.disabled) return
  if (event.key === 'Escape' && (mode.value === 'searching' || dropdownOpen.value)) {
    if (event.isComposing || composing.value || event.keyCode === 229) return
    event.preventDefault()
    event.stopPropagation()
    void cancelEditing(true)
    return
  }
  if (event.key !== 'Enter') return
  if (event.isComposing || composing.value || event.keyCode === 229) {
    event.stopPropagation()
    return
  }
  if (mode.value === 'selected') {
    event.preventDefault()
    event.stopPropagation()
    if (!event.repeat) {
      emit('confirm')
      confirmQuery?.()
    }
    return
  }
  event.preventDefault()
  event.stopPropagation()
  if (event.repeat || props.error) return
  if (props.loading) {
    pendingConfirmation.value = true
    return
  }
  if (!confirmCandidate()) {
    pendingConfirmation.value = true
    emit('open')
    void nextTick(() => {
      if (!props.loading && pendingConfirmation.value) {
        pendingConfirmation.value = false
        confirmCandidate()
      }
    })
  }
}

function confirmCandidate() {
  const instance = select.value
  if (!instance || props.disabled || props.loading || props.error) return false
  const available = visibleOptions.value.filter(option => !option.disabled)
  const highlighted = instance.optionsArray[instance.states.hoveringIndex]
  const candidate = available.find(option => option.value === highlighted?.value) ?? available[0]
  if (!candidate) return false
  const nativeOption = instance.optionsArray.find(option => option.value === candidate.value && !option.isDisabled && option.visible)
  if (!nativeOption) return false
  pendingConfirmation.value = false
  mode.value = 'selected'
  // Use the native selection action to close the popup and clear its input,
  // including when confirming the already-selected value.
  instance.handleOptionSelect(nativeOption)
  return true
}

watch(() => props.loading, async loading => {
  if (loading || !pendingConfirmation.value) return
  await nextTick()
  if (!pendingConfirmation.value) return
  pendingConfirmation.value = false
  if (mode.value !== 'selected') confirmCandidate()
}, { flush: 'post' })

function beginSearch(event: Event) {
  pendingConfirmation.value = false
  if (event.target instanceof HTMLInputElement) {
    // Bubble after Element Plus records the edit. A capture-phase render can
    // overwrite the native DOM value before its input listener receives it.
    mode.value = 'searching'
  }
}

function copySelection(event: ClipboardEvent) {
  if (window.getSelection()?.toString()) return
  if (!(event.target instanceof HTMLInputElement) || event.target.value) return
  if (mode.value !== 'selected' || !event.clipboardData) return
  event.clipboardData.setData('text/plain', display.value)
  event.preventDefault()
}

function choose(value: string | undefined) {
  pendingConfirmation.value = false
  if (props.disabled) return
  mode.value = value ? 'selected' : 'empty'
  emit('update:modelValue', value || null)
}

function clickedOption(option: SearchOption) {
  pendingConfirmation.value = false
  if (!option.disabled && !props.loading) {
    // Element Plus emits no model update when the same option is clicked.
    mode.value = 'selected'
  }
}
</script>

<template>
  <div class="search-select" v-bind="$attrs" @keydown.capture="onKeydown" @input="beginSearch"
       @compositionstart="composing = true" @compositionend="composing = false" @copy="copySelection">
    <span v-if="disabled" class="search-select__text" :title="display">{{ display }}</span>
    <el-select
      v-else
      ref="select"
      :model-value="modelValue"
      :clearable="clearable"
      filterable
      default-first-option
      fit-input-width
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
      @visible-change="visibleChange"
      @blur="finishEditing"
    >
      <template #label="{ label }">
        <span class="search-select__label" :title="mode === 'searching' ? placeholder : label" @mousedown.stop>{{ mode === 'searching' ? placeholder : label }}</span>
      </template>
      <el-option v-for="option in visibleOptions" :key="option.value" :value="option.value" :label="option.label" :disabled="option.disabled" @click="clickedOption(option)" />
      <template v-if="error" #footer>
        <div v-if="error" class="search-select__error" role="alert"><span>{{ error }}</span><el-button link type="danger" :disabled="loading" @mousedown.prevent @click.stop="emit('retry')">重试</el-button></div>
      </template>
    </el-select>
    <div v-if="resolveError" class="search-select__error" role="alert"><span>{{ resolveError }}</span><el-button link type="danger" :disabled="resolving" @click="emit('resolveRetry')">重试</el-button></div>
  </div>
</template>

<style scoped>
.search-select {
  width: 100%;
  min-width: 0;
}

.search-select :deep(.el-select) {
  width: 100%;
  min-width: 0;
}

.search-select__text {
  display: block;
  white-space: normal;
  overflow-wrap: anywhere;
  line-height: 1.5;
}

.search-select__error {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: normal;
  overflow-wrap: anywhere;
  color: var(--mes-status-danger);
}

:global(.mes-search-select-dropdown) {
  max-width: min(560px, calc(100vw - 32px));
}

:global(.el-select-dropdown.mes-search-select-dropdown) {
  max-width: min(560px, calc(100vw - 32px));
}

:global(.mes-search-select-dropdown .el-select-dropdown__empty) {
  box-sizing: border-box;
  margin: 0;
  padding: 20px 16px;
  line-height: 20px;
  text-align: center;
  white-space: normal;
  overflow-wrap: anywhere;
}

:global(.mes-search-select-dropdown .el-select-dropdown__item) {
  height: auto;
  min-height: 34px;
  line-height: 1.5;
  padding-top: 8px;
  padding-bottom: 8px;
  white-space: normal;
  overflow-wrap: anywhere;
}

.search-select__label,
.search-select__text {
  user-select: text;
  cursor: text;
}

.search-select__label {
  pointer-events: auto;
}
</style>
