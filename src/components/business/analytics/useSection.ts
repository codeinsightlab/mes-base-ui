import { ref, shallowRef, watchEffect } from 'vue'
import { useAuth } from '@/stores/auth'
import { ApiError } from '@/lib/request'
export type ReadState = 'idle' | 'loading' | 'ready' | 'error' | 'forbidden' | 'unavailable'
export interface Section<T> { state: ReadState; message: string; data: T | undefined; retry: () => void }
export function useSection<T>(permission: string | readonly string[], enabled: () => boolean, read: (signal: AbortSignal) => Promise<T>, localOnly = false) {
  const auth = useAuth(), revision = ref(0)
  const retry = () => {
    revision.value++
  }
  const result = shallowRef<Section<T>>({ state: 'idle', data: undefined, message: '', retry })
  watchEffect(onCleanup => {
    void revision.value
    void auth.revision
    const set = (state: ReadState, message = '', data?: T) => {
      result.value = { state, message, data, retry }
    }
    if (!auth.factoryId || auth.factorySwitching) {
      set('idle')
      return
    }
    const required = typeof permission === 'string' ? [permission] : permission
    if (!required.every(p => auth.hasPermission(p, 'factory'))) {
      set('forbidden', '当前账号缺少该区域的读取权限')
      return
    }
    if (localOnly && auth.runtimeMode !== 'LOCAL') {
      set('unavailable', auth.runtimeMode === 'ERP' ? '当前工厂由 ERP 管理，权威库存统计暂不可用' : '工厂运行模式尚未确认')
      return
    }
    if (!enabled()) {
      set('idle')
      return
    }
    const controller = new AbortController()
    onCleanup(() => controller.abort())
    set('loading')
    read(controller.signal).then(data => {
      if (!controller.signal.aborted) set('ready', '', data)
    }).catch(err => {
      if (!controller.signal.aborted) set(err instanceof ApiError && err.status === 403 ? 'forbidden' : 'error', err instanceof Error ? err.message : '读取失败')
    })
  }, { flush: 'sync' })
  return result
}
export function calendarDay(delta = 0) {
  const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date())
  return plusDays(day, delta)
}
export function plusDays(day: string, delta: number) {
  const date = new Date(day + 'T00:00:00Z')
  date.setUTCDate(date.getUTCDate() + delta)
  return date.toISOString().slice(0, 10)
}
