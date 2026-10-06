<script setup lang="ts">
import { computed } from 'vue'
import { statusTone, type StatusTone } from '@/lib/status'
const props = defineProps<{ label: string; tone?: StatusTone; fallback?: string }>()
const resolved = computed(() => props.tone ?? statusTone(props.label, props.fallback))
</script>
<template><span class="status-tag" :class="'status-'+resolved"><span class="status-dot" aria-hidden="true" />{{ label }}</span></template>
