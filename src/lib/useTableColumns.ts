import { computed, reactive, ref, watch, toValue, nextTick, onMounted, onActivated, onDeactivated, onBeforeUnmount } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { useAuth } from '@/stores/auth'
import { tablePreferences } from '@/api/tablePreferences'
import type { ColumnPreference } from '@/api/tablePreferences'
import { mergeColumns, preferencesOf } from '@/lib/tableColumns'
import type { ColumnDefinition } from '@/lib/tableColumns'

export function useTableColumns<T extends ColumnDefinition>(defaults: MaybeRefOrGetter<T[]>,
  tableKey: MaybeRefOrGetter<string | undefined>, url: MaybeRefOrGetter<string>) {
  const auth = useAuth()
  const active = ref(false)
  onMounted(() => { active.value = true })
  onActivated(() => { active.value = true })
  onDeactivated(() => { active.value = false })
  onBeforeUnmount(() => { active.value = false; generation++ })
  const state = reactive({ open: false, loading: false, busy: false, error: '',
    draft: [] as (ColumnDefinition & { visible: boolean })[], saved: null as ColumnPreference[] | null })
  const available = computed(() => active.value && !!toValue(tableKey) && !!auth.token && !!auth.factoryId && !auth.factorySwitching)
  const identity = computed(() => JSON.stringify([active.value, auth.token, auth.username, auth.factoryId,
    auth.revision, auth.factorySwitching, toValue(tableKey), toValue(url)]))
  let generation = 0
  const columns = computed(() => mergeColumns(toValue(defaults), state.saved).filter(column => column.visible))
  const current = (version: number, captured: string) => available.value && version === generation && captured === identity.value
  watch(identity, async() => {
    const version = ++generation, captured = identity.value
    state.saved = null; state.draft = []; state.open = false; state.error = ''; state.busy = false; state.loading = false
    if (!available.value) return
    await nextTick()
    if (!current(version, captured)) return
    state.loading = true
    try {
      const result = await tablePreferences.get(toValue(url), toValue(tableKey)!)
      if (current(version, captured)) state.saved = Array.isArray(result.columns) ? result.columns : null
    } catch(error) {
      if (current(version, captured)) state.error = error instanceof Error ? error.message : '列配置读取失败，已使用默认列'
    } finally { if (current(version, captured)) state.loading = false }
  // Route changes reach cached pages too. Wait for KeepAlive activation/deactivation
  // before deciding which page may load preferences for the current route.
  }, { immediate: true, flush: 'post' })
  function edit() {
    if (!available.value || state.loading || state.busy) return
    state.draft = mergeColumns(toValue(defaults), state.saved)
    state.error = ''; state.open = true
  }
  function move(key: string, target: string) {
    if (state.busy || key === target) return
    const from = state.draft.findIndex(column => column.key === key), to = state.draft.findIndex(column => column.key === target)
    if (from < 0 || to < 0 || state.draft[from]!.columnMovable === false || state.draft[to]!.columnMovable === false
      || state.draft[from]!.columnFixed || state.draft[to]!.columnFixed) return
    const draft = [...state.draft], [column] = draft.splice(from, 1)
    draft.splice(to, 0, column!)
    state.draft = mergeColumns(toValue(defaults), preferencesOf(draft))
  }
  async function persist(reset = false) {
    if (!available.value || state.busy) return
    if (!reset && state.draft.length && !state.draft.some(column => column.visible)) {
      state.error = '请至少显示一个数据列'; return
    }
    const version = generation, captured = identity.value
    state.busy = true; state.error = ''
    const value = preferencesOf(mergeColumns(toValue(defaults), preferencesOf(state.draft)))
    try {
      if (reset) await tablePreferences.reset(toValue(url), toValue(tableKey)!)
      else await tablePreferences.save(toValue(url), toValue(tableKey)!, value)
      if (current(version, captured)) { state.saved = reset ? null : value; state.open = false }
    } catch(error) {
      if (current(version, captured)) state.error = error instanceof Error ? error.message : '列配置保存失败'
    } finally { if (current(version, captured)) state.busy = false }
  }
  return { state, columns, available, edit, move, save: () => persist(), reset: () => persist(true),
    cancel: () => { if (!state.busy) state.open = false } }
}
