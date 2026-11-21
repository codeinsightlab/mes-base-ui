<script setup lang="ts" generic="T">
import type { Section } from './useSection'
defineProps<{ title: string; caption?: string; result: Section<T>; empty?: boolean; prompt?: string }>()
</script>
<template>
  <section class="analytics-panel">
    <header><h2>{{ title }}</h2><small v-if="caption">{{ caption }}</small><slot name="tools" /></header>
    <slot v-if="result.state === 'ready' && result.data != null && !empty" :data="result.data" />
    <div v-else class="analytics-state" :role="result.state === 'error' ? 'alert' : 'status'">
      {{ result.message || (result.state === 'loading' ? '正在读取…' : result.state === 'idle' ? prompt || '请选择有效的筛选范围' : '当前条件下暂无记录') }}
      <el-button v-if="result.state === 'error'" link type="primary" @click="result.retry">重新读取</el-button>
    </div>
  </section>
</template>
