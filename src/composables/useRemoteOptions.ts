import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'

export interface SearchOption<T = unknown> {
  value: string
  label: string
  disabled?: boolean
  data?: T
}
export interface SearchRequest { keyword: string; offset: number; limit: number }
export interface SearchPage<T = unknown> { items: SearchOption<T>[]; total: number; nextOffset: number }
export interface RemoteOptionsConfig<T> {
  modelValue: () => string | null | undefined
  enabled: () => boolean
  disabled: () => boolean
  search: (request: SearchRequest) => Promise<SearchPage<T>>
  resolve?: (value: string) => Promise<SearchOption<T> | null>
}

/** UI-independent asynchronous option state. Business context/reset policy stays with the caller. */
export function useRemoteOptions<T>(config: RemoteOptionsConfig<T>) {
  const items = shallowRef<SearchOption<T>[]>([])
  const selected = shallowRef<SearchOption<T> | null>(null)
  const loading = ref(false), resolving = ref(false), error = ref(''), resolveError = ref('')
  const keyword = ref(''), nextOffset = ref(0), total = ref(0)
  let listVersion = 0, detailVersion = 0, timer: ReturnType<typeof setTimeout> | undefined
  let retryOffset = 0, loaded = false, disposed = false
  const hasMore = computed(() => nextOffset.value < total.value)
  function cancelTimer() { clearTimeout(timer); timer = undefined }
  function invalidateList() {
    cancelTimer(); listVersion++; loading.value = false; error.value = ''
    items.value = []; nextOffset.value = 0; total.value = 0; loaded = false; retryOffset = 0
  }
  function reset() {
    invalidateList(); detailVersion++; selected.value = null; resolving.value = false; resolveError.value = ''; keyword.value = ''
  }
  async function fetchPage(offset: number) {
    if (disposed || !config.enabled() || config.disabled()) return
    cancelTimer()
    const version = ++listVersion
    loading.value = true; error.value = ''; retryOffset = offset
    try {
      const page = await config.search({ keyword: keyword.value, offset, limit: 20 })
      if (version !== listVersion) return
      if (page.nextOffset < offset || (page.nextOffset === offset && page.total > offset)) throw new Error('分页未向后推进，请重试')
      const merged = offset ? [...items.value, ...page.items] : page.items
      items.value = [...new Map(merged.map(option => [option.value, option])).values()]
      nextOffset.value = page.nextOffset; total.value = page.total; loaded = true
      const match = items.value.find(option => option.value === config.modelValue())
      if (match) { detailVersion++; resolving.value = false; resolveError.value = ''; selected.value = match }
    } catch(reason) {
      if (version === listVersion) error.value = reason instanceof Error ? reason.message : '查询失败，请重试'
    } finally { if (version === listVersion) loading.value = false }
  }
  async function search(value: string) {
    invalidateList(); keyword.value = value
    await fetchPage(0)
  }
  function scheduleSearch(value: string) {
    if (value === keyword.value && (loaded || loading.value || timer) && !error.value) return
    invalidateList(); keyword.value = value
    if (disposed || !config.enabled() || config.disabled()) return
    timer = setTimeout(() => { void fetchPage(0) }, 300)
  }
  async function loadMore() { if (!loading.value && !timer && hasMore.value) await fetchPage(nextOffset.value) }
  async function retry() { if (!loading.value) await fetchPage(retryOffset) }
  async function open() { if (!loaded && !loading.value && !timer && !error.value) await fetchPage(0) }
  async function hydrate() {
    const version = ++detailVersion
    selected.value = null; resolveError.value = ''; resolving.value = false
    const value = config.modelValue()
    if (disposed || !value || !config.enabled()) return
    const cached = items.value.find(option => option.value === value)
    if (cached) { selected.value = cached; return }
    if (!config.resolve) return
    resolving.value = true
    try {
      const option = await config.resolve(value)
      if (version === detailVersion && value === config.modelValue()) selected.value = option
    } catch(reason) {
      if (version === detailVersion) resolveError.value = reason instanceof Error ? reason.message : '已选项读取失败'
    } finally { if (version === detailVersion) resolving.value = false }
  }
  watch(config.modelValue, () => { void hydrate() }, { flush: 'sync' })
  watch(config.disabled, disabled => {
    invalidateList()
    if (!disabled) void search('')
    void hydrate()
  }, { flush: 'sync' })
  onBeforeUnmount(() => { disposed = true; reset() })
  return { items, selected, loading, resolving, error, resolveError, keyword, total, nextOffset, hasMore,
    search, scheduleSearch, loadMore, retry, open, hydrate, reset }
}
