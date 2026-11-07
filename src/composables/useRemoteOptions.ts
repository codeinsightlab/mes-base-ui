import { loadSearchOptionLimit } from '@/lib/searchOptionSettings'
import { onBeforeUnmount, ref, shallowRef, watch } from 'vue'

export interface SearchOption<T = unknown> {
  value: string
  label: string
  disabled?: boolean
  data?: T
}
export interface SearchRequest { keyword: string; offset: 0; limit: number }
export interface SearchResult<T = unknown> { items: SearchOption<T>[] }
export interface RemoteOptionsConfig<T> {
  modelValue: () => string | null | undefined
  enabled: () => boolean
  disabled: () => boolean
  search: (request: SearchRequest) => Promise<SearchResult<T>>
  resolve?: (value: string) => Promise<SearchOption<T> | null>
}

/** UI-independent asynchronous option state. Business context/reset policy stays with the caller. */
export function useRemoteOptions<T>(config: RemoteOptionsConfig<T>) {
  const items = shallowRef<SearchOption<T>[]>([])
  const selected = shallowRef<SearchOption<T> | null>(null)
  const loading = ref(false), resolving = ref(false), error = ref(''), resolveError = ref('')
  const keyword = ref('')
  let listVersion = 0, detailVersion = 0, timer: ReturnType<typeof setTimeout> | undefined
  let loaded = false, disposed = false

  function cancelTimer() {
    clearTimeout(timer)
    timer = undefined
  }

  function invalidateList() {
    cancelTimer()
    listVersion++
    loading.value = false
    error.value = ''
    items.value = []
    loaded = false
  }

  function reset() {
    invalidateList()
    detailVersion++
    selected.value = null
    resolving.value = false
    resolveError.value = ''
    keyword.value = ''
  }

  async function fetchOptions() {
    if (disposed || !config.enabled() || config.disabled()) {
      loading.value = false
      return
    }
    cancelTimer()
    const version = ++listVersion
    loading.value = true
    error.value = ''
    try {
      const requestedKeyword = keyword.value
      const limit = await loadSearchOptionLimit()
      if (version !== listVersion || disposed || !config.enabled() || config.disabled()) return
      const page = await config.search({ keyword: requestedKeyword, offset: 0, limit })
      if (version !== listVersion) return
      items.value = [...new Map(page.items.map(option => [option.value, option])).values()].slice(0, limit)
      loaded = true
      const match = items.value.find(option => option.value === config.modelValue())
      if (match) {
        detailVersion++
        resolving.value = false
        resolveError.value = ''
        selected.value = match
      }
    } catch (reason) {
      if (version === listVersion) error.value = reason instanceof Error ? reason.message : '查询失败，请重试'
    } finally {
      if (version === listVersion) loading.value = false
    }
  }

  async function search(value: string) {
    invalidateList()
    keyword.value = value
    await fetchOptions()
  }

  function scheduleSearch(value: string) {
    if (value === keyword.value && (loaded || loading.value || timer) && !error.value) return
    invalidateList()
    keyword.value = value
    if (disposed || !config.enabled() || config.disabled()) return
    loading.value = true
    timer = setTimeout(() => {
      void fetchOptions()
    }, 300)
  }

  async function retry() {
    if (!loading.value) await fetchOptions()
  }

  async function open() {
    if (!loaded && !loading.value && !timer && !error.value) await fetchOptions()
  }

  async function hydrate() {
    const version = ++detailVersion
    selected.value = null
    resolveError.value = ''
    resolving.value = false
    const value = config.modelValue()
    if (disposed || !value || !config.enabled()) return
    const cached = items.value.find(option => option.value === value)
    if (cached) {
      selected.value = cached
      return
    }
    if (!config.resolve) return
    resolving.value = true
    try {
      const option = await config.resolve(value)
      if (version === detailVersion && value === config.modelValue()) selected.value = option
    } catch (reason) {
      if (version === detailVersion) resolveError.value = reason instanceof Error ? reason.message : '已选项读取失败'
    } finally {
      if (version === detailVersion) resolving.value = false
    }
  }

  watch(config.modelValue, () => {
    void hydrate()
  }, { flush: 'sync' })
  watch(config.disabled, disabled => {
    invalidateList()
    if (!disabled) void search('')
    void hydrate()
  }, { flush: 'sync' })
  onBeforeUnmount(() => {
    disposed = true
    reset()
  })
  return { items, selected, loading, resolving, error, resolveError, keyword,
    search, scheduleSearch, retry, open, hydrate, reset }
}
