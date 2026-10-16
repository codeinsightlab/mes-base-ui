<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
const route = useRoute(), router = useRouter()
onMounted(() => { void router.replace({ path: '/production/mesProductionExecution', query: typeof route.query.workorderId === 'string' ? { workorderId: route.query.workorderId } : {} }) })
</script>
<template><p class="secondary">正在进入生产执行与派工…</p></template>
