<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ value?: string | number | null }>()

const parsed = computed(() => {
  const raw = props.value
  if (raw == null || raw === '') return null
  const date = new Date(typeof raw === 'number' ? raw : raw.replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? null : date
})
const formatted = computed(() => {
  const date = parsed.value
  if (!date) return null
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
})
</script>

<template><span class="tabular" :title="formatted ?? undefined">{{ formatted ?? '—' }}</span></template>
