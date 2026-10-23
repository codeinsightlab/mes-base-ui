<script setup lang="ts">
import { onActivated, onBeforeUnmount, onDeactivated, provide, readonly, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute } from 'vue-router'
import { pageOverlayScopeKey, type PageOverlay } from '@/lib/pageOverlay'

const props = defineProps<{ pageKey: string }>()
const route = useRoute()
const active = ref(route.fullPath === props.pageKey)
const overlays = new Set<PageOverlay>()
let pendingLeave: Promise<boolean> | undefined
function deactivate() {
  active.value = false
  for (const overlay of [...overlays].reverse()) overlay.forceClose()
}
provide(pageOverlayScopeKey, {
  active: readonly(active),
  register(overlay) {
    overlays.add(overlay)
    if (!active.value) overlay.forceClose()
    return () => overlays.delete(overlay)
  }
})
async function requestLeave(): Promise<boolean> {
  if (!active.value) return true
  if (pendingLeave) return pendingLeave
  pendingLeave = (async() => {
    for (const overlay of [...overlays].reverse()) {
      if (overlay.beforeLeave && !await overlay.beforeLeave()) return false
    }
    return true
  })()
  try { return await pendingLeave } finally { pendingLeave = undefined }
}
defineExpose({ requestLeave })
onBeforeRouteLeave(requestLeave)
onBeforeRouteUpdate(to => to.fullPath === props.pageKey || requestLeave())
// Route state changes before cached subtree deactivation. Hide its overlays now.
watch(() => route.fullPath, value => { if (value !== props.pageKey) deactivate() }, { flush: 'sync' })
onActivated(() => { active.value = route.fullPath === props.pageKey })
onDeactivated(deactivate)
onBeforeUnmount(() => { deactivate(); overlays.clear() })
</script>
<template><slot /></template>
