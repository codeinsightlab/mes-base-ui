<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ value?: string | number | null }>()
const text = computed(() => props.value == null || props.value === '' ? '—' : String(props.value))
</script>
<template><span class="code-text" :title="text">{{ text }}</span></template>
