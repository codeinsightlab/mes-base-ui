<script setup lang="ts">
import BusinessDirectorySelect from './BusinessDirectorySelect.vue'
import type { DirectoryOption } from '@/api/business/directory'
withDefaults(defineProps<{ modelValue?: string | null; disabled?: boolean; clearable?: boolean; placeholder?: string; departmentId?: string }>(), { modelValue: null, placeholder: '搜索并选择人员', clearable: true, departmentId: undefined, disabled: false })
const emit = defineEmits<{ 'update:modelValue': [value: string | null]; change: [value: DirectoryOption | null] }>()
</script>

<template>
  <BusinessDirectorySelect
    resource="personnel"
    :model-value="modelValue"
    :disabled="disabled"
    :clearable="clearable"
    :placeholder="placeholder"
    :department-id="departmentId"
    @update:model-value="emit('update:modelValue', $event)"
    @change="emit('change', $event)"
  />
</template>
