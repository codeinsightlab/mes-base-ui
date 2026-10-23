<script setup lang="ts">
import type { WorkspaceResource } from '@/composables/useWorkspaceStatus'
defineProps<{ resource: Pick<WorkspaceResource<unknown>, 'state' | 'error'>; loadingOverlay?: boolean }>()
defineEmits<{ retry: [] }>()
</script>
<template>
  <p v-if="resource.state === 'loading' && !loadingOverlay" class="console-empty" role="status">正在读取…</p>
  <div v-else-if="resource.state === 'error'" class="snapshot-error" role="alert">
    <slot name="error"><p>{{ resource.error }}</p></slot><el-button text @click="$emit('retry')">重新读取</el-button>
  </div>
  <p v-else-if="resource.state === 'forbidden'" class="console-empty">当前账号无此数据读取权限</p>
  <p v-else-if="resource.state === 'idle'" class="console-empty">请选择有效工厂后读取</p>
  <div v-else-if="loadingOverlay" v-loading="resource.state === 'loading'" :aria-busy="resource.state === 'loading'"><slot /></div>
  <slot v-else />
</template>
