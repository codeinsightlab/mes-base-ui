<script setup lang="ts">
import { computed } from 'vue'
import { useAuth } from '@/stores/auth'
import PageHeader from '@/components/PageHeader.vue'
import { boards, type Board } from '@/api/production/analytics'
import AnalyticsDashboard from '@/components/business/analytics/AnalyticsDashboard.vue'
const props = defineProps<{ topic?: Board }>()
const auth = useAuth()
const board = computed(() => props.topic && auth.hasPermission(boards[props.topic].permission, 'factory') ? props.topic : undefined)
</script>
<template>
  <div class="app-container">
    <template v-if="board && auth.factoryId && !auth.factorySwitching">
      <PageHeader :title="boards[board].title" />
      <AnalyticsDashboard :key="[board, auth.factoryId, auth.revision, auth.factoryPermissions.join('|')].join('/')" :topic="board" />
    </template>
    <el-empty v-else description="当前工厂无此看板的读取权限" />
  </div>
</template>
