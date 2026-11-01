<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ value?: string | number | null }>()

const parsed = computed(() => {
  const raw = props.value
  if (raw == null || raw === '') return null
  const date = new Date(typeof raw === 'number' ? raw : raw.replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? null : date
})
const display = computed(() => {
  const date = parsed.value
  if (!date) return '—'
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getFullYear() % 100)}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
})
const title = computed(() => {
  const date = parsed.value
  if (!date) return undefined
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
})
</script>

<template><span class="tabular" :title="title">{{ display }}</span></template>
