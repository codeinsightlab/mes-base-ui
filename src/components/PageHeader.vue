<script setup lang="ts">
defineProps<{ title: string; description?: string; section?: string }>()
</script>
<template>
  <header class="page-header">
    <div class="page-header-title">
      <div class="page-header-title-row"><h1>{{ title }}</h1><slot name="status" /></div>
      <p v-if="description" class="page-description">{{ description }}</p>
    </div>
    <div v-if="$slots.default" class="page-header-actions"><slot /></div>
  </header>
</template>
<style scoped>
.page-header-title { min-width: 0; }
.page-header-title-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.page-header-title-row h1 { margin: 0; }
.page-header-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
@media (max-width: 640px) {
  .page-header-actions { width: 100%; justify-content: flex-start; }
}
</style>
