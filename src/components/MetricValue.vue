<script setup lang="ts">
import { computed } from 'vue'
import { latencyLabels, latencyTone } from '@/lib/dataPresentation'
const props = defineProps<{ value?: number | string | null; unit?: string; latency?: boolean }>()
const display = computed(() => props.value == null || props.value === '' ? '—' : typeof props.value === 'number' ? Number.isFinite(props.value) ? props.value.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—' : props.value)
const tone = computed(() => latencyTone(props.value))
</script>
<template>
  <span class="metric-value" :class="latency ? 'latency-'+tone : undefined" :title="latency ? latencyLabels[tone] : undefined">
    <span v-if="latency && tone !== 'unknown'" class="status-dot" aria-hidden="true" />
    <span>{{ display }}</span><small v-if="unit && display !== '—'">{{ unit }}</small>
    <span v-if="latency" class="sr-only">{{ latencyLabels[tone] }}</span>
  </span>
</template>
