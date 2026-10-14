<script setup lang="ts">
import ProductionExecutionList from '@/components/business/production/ProductionExecutionList.vue'
import { computed, inject } from 'vue'
import { routeLocationKey } from 'vue-router'
const route = inject(routeLocationKey, undefined)
const workorderId = computed(() => typeof route?.query.workorderId === 'string' && /^[1-9][0-9]{0,18}$/.test(route.query.workorderId) ? route.query.workorderId : undefined)
</script>
<template><ProductionExecutionList :key="workorderId" :workorder-id="workorderId" /></template>
