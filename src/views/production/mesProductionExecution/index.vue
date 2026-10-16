<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import WorkOrderSelect from '@/components/business/production/WorkOrderSelect.vue'
import ProductionExecutionList from '@/components/business/production/ProductionExecutionList.vue'
const route = useRoute(), router = useRouter(), workorderId = ref<string | null>(null)
watch(() => route.query.workorderId, value => { workorderId.value = typeof value === 'string' && /^[1-9]\d{0,18}$/.test(value) ? value : null }, { immediate: true })
</script>
<template><div class="app-container"><PageHeader title="生产执行" description="维护执行单元、工序派工、实际路径选择与开工；生产数量在独立页面管理。" /><div class="filter-panel"><WorkOrderSelect v-model="workorderId" /><el-button @click="router.push('/production/workorder')">返回工单</el-button></div><ProductionExecutionList :key="workorderId || 'all'" :workorder-id="workorderId || undefined" /></div></template>
