import { ElMessageBox } from 'element-plus'
import type { ElMessageBoxOptions, ElMessageBoxShortcutMethod, MessageBoxActionHandlers, MessageBoxData, MessageBoxState } from 'element-plus'
import { getCurrentInstance, h, onScopeDispose, readonly, ref } from 'vue'
import type { AppContext } from 'vue'
import { acquirePageScrollLock, usePageOverlayScope } from './pageOverlay'
import type { PageOverlayScope } from './pageOverlay'

type Kind = 'alert' | 'confirm' | 'prompt'
export interface PageMessageBox {
  confirm: ElMessageBoxShortcutMethod
  alert: ElMessageBoxShortcutMethod
  prompt: ElMessageBoxShortcutMethod
}

/** Each confirmation owns its own cancellation handle and scroll lease. */
export function createPageMessageBox(scope?: PageOverlayScope, appContext?: AppContext | null): PageMessageBox {
  function method(kind: Kind): ElMessageBoxShortcutMethod {
    return ((message: ElMessageBoxOptions['message'], titleOrOptions?: ElMessageBoxOptions['title'], optionsOrContext?: ElMessageBoxOptions | AppContext | null, explicitContext?: AppContext | null) => {
      if (scope && !scope.active.value) return Promise.reject('cancel')
      const shorthand = typeof titleOrOptions === 'object' && titleOrOptions !== null
      const options = { ...(shorthand ? titleOrOptions : optionsOrContext as ElMessageBoxOptions | undefined) }
      const title = options.title ?? (shorthand ? undefined : titleOrOptions)
      const context = shorthand ? optionsOrContext as AppContext | null | undefined : explicitContext
      const originalMessage = options.message ?? message
      const callback = options.callback
      const beforeClose = options.beforeClose
      let instance: MessageBoxState | undefined
      let closeHandle: MessageBoxActionHandlers['close'] | undefined
      let forced = false
      let settled = false
      let rejectOwner!: (reason: string) => void
      const cancelled = new Promise<never>((_, reject) => { rejectOwner = reject })
      const release = acquirePageScrollLock()
      const forceClose = () => {
        if (settled || forced) return
        forced = true
        rejectOwner('cancel')
        closeHandle?.()
      }
      const unregister = scope?.register({ forceClose }) ?? (() => {})
      let result: Promise<MessageBoxData>
      try {
        result = ElMessageBox[kind](message, title, {
          ...options,
          title,
          boxType: kind,
          showCancelButton: options.showCancelButton ?? kind !== 'alert',
          showInput: options.showInput ?? kind === 'prompt',
          closeOnClickModal: options.closeOnClickModal ?? kind !== 'alert',
          closeOnPressEscape: options.closeOnPressEscape ?? kind !== 'alert',
          lockScroll: false,
          callback: undefined,
          message: actions => {
            closeHandle = actions.close
            if (forced) queueMicrotask(actions.close)
            if (typeof originalMessage === 'function') return originalMessage(actions)
            if (typeof originalMessage === 'string') {
              if (options.dangerouslyUseHTMLString) return h('span', { innerHTML: originalMessage })
              return h('span', originalMessage)
            }
            return originalMessage ?? h('span')
          },
          beforeClose: (action, current, done) => {
            instance = current
            if (forced || scope && !scope.active.value) done()
            else if (beforeClose) beforeClose(action, current, done)
            else done()
          }
        }, context ?? appContext)
      } catch(error) {
        settled = true
        unregister()
        release()
        return Promise.reject(error)
      }
      return Promise.race([result, cancelled]).then(value => {
        if (forced || scope && !scope.active.value) return Promise.reject('cancel')
        callback?.(value, instance as never)
        return value
      }).catch(reason => {
        if (!forced && (!scope || scope.active.value) && (reason === 'cancel' || reason === 'close')) callback?.(reason as MessageBoxData, instance as never)
        return Promise.reject(reason)
      }).finally(() => {
        settled = true
        unregister()
        release()
      })
    }) as ElMessageBoxShortcutMethod
  }
  return { confirm: method('confirm'), alert: method('alert'), prompt: method('prompt') }
}

/** Capture page ownership during setup; owner-less components keep a local lifecycle owner. */
export function usePageMessageBox(): PageMessageBox {
  const instance = getCurrentInstance()
  const page = usePageOverlayScope()
  if (page) return createPageMessageBox(page, instance?.appContext)
  if (!instance) return createPageMessageBox()
  const active = ref(true)
  const owners = new Set<{ forceClose: () => void }>()
  const local: PageOverlayScope = {
    active: readonly(active),
    register(owner) {
      owners.add(owner)
      return () => owners.delete(owner)
    }
  }
  onScopeDispose(() => {
    active.value = false
    for (const owner of owners) owner.forceClose()
    owners.clear()
  })
  return createPageMessageBox(local, instance.appContext)
}
