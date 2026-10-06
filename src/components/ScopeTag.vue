<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ kind: string; factoryId?: string | number | null; factoryName?: string }>()
const known = computed(() => props.kind === 'PLATFORM' || props.kind === 'FACTORY')
</script>
<template>
  <span class="scope-tag" :class="{ 'scope-factory': kind === 'FACTORY', 'scope-platform': kind === 'PLATFORM' }">
    <el-icon v-if="known" aria-hidden="true"><OfficeBuilding v-if="kind === 'FACTORY'" /><Grid v-else /></el-icon>
    <span>{{ kind === 'PLATFORM' ? '平台范围' : kind === 'FACTORY' ? '工厂' : kind }}</span>
    <span v-if="kind === 'FACTORY' && (factoryName || factoryId != null)" class="scope-detail">{{ factoryName || factoryId }}</span>
  </span>
</template>
