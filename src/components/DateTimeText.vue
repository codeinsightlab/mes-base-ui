<script setup lang="ts">
import { computed } from 'vue'
import { formatDateTime } from '@/lib/dateTime'

const props = defineProps<{ value?: string | number | null }>()
const formatted = computed(() => formatDateTime(props.value) || null)
</script>

<template><span class="tabular" :title="formatted ?? undefined">{{ formatted ?? '—' }}</span></template>
