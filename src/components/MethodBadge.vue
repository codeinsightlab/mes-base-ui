<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ method?: string | null }>()
const methodKind = computed(() => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(props.method ?? '') ? props.method!.toLowerCase() : 'unknown')
</script>
<template><span class="method-badge" :class="'method-'+methodKind">{{ method || '—' }}</span></template>
