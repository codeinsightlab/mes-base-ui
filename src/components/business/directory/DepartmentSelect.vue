<script setup lang="ts">
import BusinessDirectorySelect from './BusinessDirectorySelect.vue'
import type { DirectoryOption } from '@/api/business/directory'
withDefaults(defineProps<{ modelValue?: string | null; disabled?: boolean; clearable?: boolean; placeholder?: string }>(), { modelValue: null, placeholder: '搜索并选择部门', clearable: true, disabled: false })
const emit = defineEmits<{ 'update:modelValue': [value: string | null]; change: [value: DirectoryOption | null] }>()
</script>

<template>
  <BusinessDirectorySelect
    resource="departments"
    :model-value="modelValue"
    :disabled="disabled"
    :clearable="clearable"
    :placeholder="placeholder"
    @update:model-value="emit('update:modelValue', $event)"
    @change="emit('change', $event)"
  />
</template>
