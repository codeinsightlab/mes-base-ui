<script setup lang="ts">
defineProps<{ title: string; description?: string; section?: string }>()
</script>
<template>
  <header class="page-header">
    <div><h1>{{ title }}</h1><p v-if="description" class="page-description">{{ description }}</p></div>
    <div v-if="$slots.default" class="page-header-actions"><slot /></div>
  </header>
</template>
