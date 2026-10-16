<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
const router = useRouter()
onMounted(() => { void router.replace('/production/operation') })
</script>
<template><p class="secondary">正在进入工序编辑与人员配置…</p></template>
