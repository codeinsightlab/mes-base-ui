<script setup lang="ts">
import { formatQuantity } from '@/lib/quantity'
defineProps<{ value?: string | number | null }>()
</script>
<template><span class="tabular" :title="value == null ? undefined : String(value)">{{ formatQuantity(value) }}</span></template>
