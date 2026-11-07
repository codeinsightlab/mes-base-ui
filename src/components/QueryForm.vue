<script setup lang="ts">
import { provide, ref } from 'vue'
import { queryFormConfirmKey } from './queryFormContext'
import type { FormInstance } from 'element-plus'
defineOptions({ inheritAttrs: false })
const emit = defineEmits<{ submit: [event: SubmitEvent] }>()
const form = ref<FormInstance>()
provide(queryFormConfirmKey, () => {
  const element: unknown = form.value?.$el
  if (!(element instanceof HTMLFormElement)) return
  const submitter = element.querySelector<HTMLButtonElement | HTMLInputElement>('[type="submit"]')
  if (submitter?.matches(':disabled')) return
  if (submitter) element.requestSubmit(submitter)
  else element.requestSubmit()
})
// Keep existing queryForm refs usable by resetForm(), without reaching into component internals.
defineExpose({ resetFields: (...args: Parameters<FormInstance['resetFields']>) => form.value?.resetFields(...args) })
</script>
<template>
  <el-form ref="form" v-bind="$attrs" @submit.prevent="emit('submit', $event)"><slot /></el-form>
</template>
