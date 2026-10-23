<script setup lang="ts">
import { displayQuantity } from '@/lib/production/quantity'
defineProps<{ value?: string | number | null }>()
</script>
<template><span class="tabular" :title="value == null ? undefined : String(value)">{{ displayQuantity(value) }}</span></template>
