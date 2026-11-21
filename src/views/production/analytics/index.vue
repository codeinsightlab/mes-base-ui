<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '@/stores/auth'
import PageHeader from '@/components/PageHeader.vue'
import { access } from '@/api/production/analytics'
import AnalyticsDashboard from '@/components/business/analytics/AnalyticsDashboard.vue'
const auth = useAuth(), route = useRoute()
const topic = ref('')
watch(() => route.query.topic, value => {
  if (route.path === '/production/analytics')topic.value = typeof value === 'string' ? value : ''
}, { immediate: true })
const tabs = [{ id: 'overview', label: '生产总览', perms: [access.orders, access.execution, access.report, access.quality] }, { id: 'orders', label: '工单分析', perms: [access.orders] }, { id: 'process', label: '工序与执行', perms: [access.execution, access.quantity] }, { id: 'quality', label: '质量分析', perms: [access.quality] }, { id: 'inventory', label: '库存与物料', perms: [access.stock, access.flow] }] as const
const allowed = computed(() => tabs.filter(t => t.perms.some(p => auth.hasPermission(p, 'factory'))))
const current = computed(() => topic.value ? allowed.value.find(t => t.id === topic.value) : allowed.value[0])
</script>
<template>
  <div class="app-container">
    <PageHeader title="生产分析" />
    <template v-if="!auth.factorySwitching && auth.factoryId && auth.hasPermission(access.menu, 'factory')">
      <el-tabs :model-value="current?.id" @tab-change="topic = String($event)"><el-tab-pane v-for="t in allowed" :key="t.id" :name="t.id" :label="t.label" /></el-tabs>
      <AnalyticsDashboard v-if="current" :key="[auth.factoryId, auth.revision, auth.factoryPermissions.join('|')].join('/')" :topic="current.id" />
      <el-empty v-else description="当前账号无此专题的读取权限" />
    </template><el-empty v-else description="请选择有权访问生产分析的工厂" />
  </div>
</template>
