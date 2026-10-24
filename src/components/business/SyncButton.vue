<script setup lang="ts">
import { usePageMessageBox } from '@/lib/pageMessageBox'

import { onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { PermissionScope } from '@/lib/request'

interface SyncCounts { fetched: number; created: number; updated: number; skipped: number }
const props = defineProps<{ permission: string; scope: PermissionScope; run: () => Promise<SyncCounts>; confirmText?: string }>()
import { useAuth } from '@/stores/auth'
const ElMessageBox = usePageMessageBox()

const auth = useAuth()
const emit = defineEmits<{ completed: [] }>()
const busy = ref(false)
let sequence = 0
watch(() => [auth.revision, auth.hasPermission(props.permission, props.scope)], () => {
  sequence++
  busy.value = false
})
onBeforeUnmount(() => { sequence++ })
async function synchronize() {
  if (busy.value || !auth.hasPermission(props.permission, props.scope)) return
  const revision = auth.revision
  const attempt = ++sequence
  busy.value = true
  try {
    try {
      await ElMessageBox.confirm(props.confirmText ?? '同步将新增或覆盖当前范围的数据。确认继续？', '同步', { type: 'warning' })
    } catch { return }
    if (attempt !== sequence || revision !== auth.revision || !auth.hasPermission(props.permission, props.scope)) return
    try {
      const result = await props.run()
      if (attempt !== sequence || revision !== auth.revision || !auth.hasPermission(props.permission, props.scope)) return
      ElMessage.success(`获取 ${result.fetched} 条，新增 ${result.created} 条，更新 ${result.updated} 条，跳过 ${result.skipped} 条`)
      emit('completed')
    } catch(error) {
      if (attempt === sequence && revision === auth.revision) ElMessage.error(error instanceof Error ? error.message : '同步失败')
    }
  } finally {
    if (attempt === sequence) busy.value = false
  }
}
</script>
<template>
  <el-button v-if="auth.hasPermission(props.permission, props.scope)" :loading="busy" :disabled="busy" icon="Refresh" @click="synchronize">同步</el-button>
</template>
