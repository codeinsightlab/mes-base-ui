<script setup lang="ts">
import { ElDialog } from 'element-plus'
import { usePageOverlay, type PageBeforeClose } from '@/lib/usePageOverlay'

defineOptions({ inheritAttrs: false })
const props = defineProps<{ modelValue?: boolean; beforeClose?: PageBeforeClose; lockScroll?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const { visible, update, beforeClose } = usePageOverlay(props, value => emit('update:modelValue', value))
</script>
<template>
  <ElDialog v-bind="$attrs" :model-value="visible" :lock-scroll="false" :before-close="beforeClose" @update:model-value="update">
    <template v-for="(_, name) in $slots" #[name]="slotProps"><slot :name="name" v-bind="slotProps ?? {}" /></template>
  </ElDialog>
</template>
