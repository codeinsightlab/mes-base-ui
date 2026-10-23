<script setup lang="ts">
import { ref } from 'vue'
import type { FormInstance } from 'element-plus'
defineOptions({ inheritAttrs: false })
const emit = defineEmits<{ submit: [event: SubmitEvent] }>()
const form = ref<FormInstance>()
// Keep existing queryForm refs usable by resetForm(), without reaching into component internals.
defineExpose({ resetFields: (...args: Parameters<FormInstance['resetFields']>) => form.value?.resetFields(...args) })
</script>
<template>
  <el-form ref="form" v-bind="$attrs" @submit.prevent="emit('submit', $event)"><slot /></el-form>
</template>
