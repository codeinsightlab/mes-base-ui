import { computed, nextTick, onBeforeUnmount, onDeactivated, ref, watch } from 'vue'
import { acquirePageScrollLock, usePageOverlayScope } from '@/lib/pageOverlay'

export type PageBeforeClose = (done: () => void) => unknown

/** Dialog and drawer share visibility, navigation confirmation and lock ownership. */
export function usePageOverlay(props: { modelValue?: boolean; beforeClose?: PageBeforeClose }, emit: (value: boolean) => void) {
  const scope = usePageOverlayScope()
  const active = scope?.active ?? ref(true)
  const forcedClosed = ref(false)
  const visible = computed(() => active.value && !!props.modelValue && !forcedClosed.value)
  let release: (() => void) | undefined
  let closing: Promise<boolean> | undefined
  function forceClose() {
    const notify = !!props.modelValue && !forcedClosed.value
    forcedClosed.value = !!props.modelValue
    release?.(); release = undefined
    if (notify) emit(false)
  }
  watch(() => props.modelValue, (value, previous) => {
    if (!value) forcedClosed.value = false
    else if (!active.value) forceClose()
    else if (!previous) forcedClosed.value = false
  }, { flush: 'sync' })
  watch(active, value => { if (!value) forceClose() }, { flush: 'sync', immediate: true })
  watch(visible, value => {
    if (value) release ??= acquirePageScrollLock()
    else { release?.(); release = undefined }
  }, { flush: 'sync', immediate: true })
  async function requestClose(): Promise<boolean> {
    if (!visible.value) return true
    if (closing) return closing
    closing = (async() => {
      if (!props.beforeClose) { forceClose(); return true }
      let confirmed = false
      try {
        await props.beforeClose(() => { confirmed = true; forceClose() })
        await nextTick()
        return confirmed || !props.modelValue
      } catch {
        return false
      }
    })()
    try { return await closing } finally { closing = undefined }
  }
  function update(value: boolean) {
    if (!value) forceClose()
    else if (active.value) emit(true)
    else forceClose()
  }
  function beforeClose(done: () => void) { return requestClose().then(allowed => { if (allowed) done() }) }
  const unregister = scope?.register({ forceClose, beforeLeave: requestClose })
  onDeactivated(forceClose)
  onBeforeUnmount(() => { unregister?.(); forceClose() })
  return { visible, update, beforeClose }
}
