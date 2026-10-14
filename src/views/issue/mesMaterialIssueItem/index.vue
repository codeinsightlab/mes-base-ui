<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
const router = useRouter()
onMounted(() => { void router.replace('/issue/mesMaterialIssue') })
</script>
<template><el-empty description="领料明细已合并到领料出库单据页面" /></template>
