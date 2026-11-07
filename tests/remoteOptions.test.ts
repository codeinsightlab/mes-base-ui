// Shared async behavior with mocked callbacks; no transport or database writes.
import { afterEach, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { useRemoteOptions, type SearchPage, type SearchOption } from '../src/composables/useRemoteOptions'

const option = (value: string): SearchOption => ({ value, label: '选项 ' + value })
let wrapper: ReturnType<typeof mount>
afterEach(() => { wrapper?.unmount(); vi.useRealTimers() })
function setup() {
  const model = ref<string | null>(null), disabled = ref(false), enabled = ref(true)
  const search = vi.fn().mockResolvedValue({ items: [option('1')], total: 21, nextOffset: 20 })
  const resolve = vi.fn().mockResolvedValue(option('9007199254740993'))
  let state!: ReturnType<typeof useRemoteOptions>
  wrapper = mount(defineComponent({ setup() {
    state = useRemoteOptions({ modelValue: () => model.value, disabled: () => disabled.value, enabled: () => enabled.value, search, resolve })
    return () => null
  } }))
  return { model, disabled, enabled, search, resolve, state }
}
it('uses server progression after filtered pages, deduplicates values, and retries the same failed page', async() => {
  const { state, search } = setup()
  await state.search('仓库')
  search.mockRejectedValueOnce(new Error('网络失败'))
  await state.loadMore()
  expect(state.items.value.map(row => row.value)).toEqual(['1'])
  expect(state.error.value).toBe('网络失败')
  search.mockResolvedValueOnce({ items: [option('1'), option('2')], total: 21, nextOffset: 21 })
  await state.retry()
  expect(search.mock.calls.slice(1).map(call => call[0])).toEqual([
    { keyword: '仓库', offset: 20, limit: 20 }, { keyword: '仓库', offset: 20, limit: 20 }
  ])
  expect(state.items.value.map(row => row.value)).toEqual(['1', '2'])
  expect(state.hasMore.value).toBe(false)
})
it('debounces typing and invalidates the previous request before the debounce expires', async() => {
  vi.useFakeTimers()
  const { state, search } = setup()
  let release!: (page: SearchPage) => void
  search.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
  const old = state.search('旧')
  state.scheduleSearch('新')
  release({ items: [option('old')], total: 1, nextOffset: 1 }); await old
  expect(state.items.value).toEqual([])
  await vi.advanceTimersByTimeAsync(200)
  state.scheduleSearch('新词')
  await vi.advanceTimersByTimeAsync(299)
  expect(search).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(1)
  expect(search).toHaveBeenLastCalledWith({ keyword: '新词', offset: 0, limit: 20 })
})
it('keeps list and hydration independent and discards old detail responses', async() => {
  const { state, model, search, resolve } = setup()
  let release!: (option: SearchOption) => void
  resolve.mockImplementationOnce(() => new Promise(done => { release = done }))
  model.value = 'old'
  const list = state.search('')
  model.value = '9007199254740993'
  await list; await flushPromises()
  release(option('old')); await flushPromises()
  expect(state.selected.value?.value).toBe('9007199254740993')
  expect(state.items.value).toHaveLength(1)
  expect(state.loading.value).toBe(false)
  expect(search).toHaveBeenCalledTimes(1)
})
it('resets context while requests and a scheduled search are outstanding', async() => {
  vi.useFakeTimers()
  const { state, model, search, resolve } = setup()
  let release!: (option: SearchOption) => void
  resolve.mockImplementationOnce(() => new Promise(done => { release = done }))
  model.value = 'old'; state.scheduleSearch('旧工厂')
  state.reset()
  release(option('old')); await flushPromises(); await vi.advanceTimersByTimeAsync(300)
  expect(state.items.value).toEqual([])
  expect(state.selected.value).toBeNull()
  expect(search).not.toHaveBeenCalled()
})
it('queries only the selected detail when disabled and cancels in-flight list responses', async() => {
  const { state, model, disabled, search, resolve } = setup()
  let release!: (page: SearchPage) => void
  search.mockImplementationOnce(() => new Promise(done => { release = done }))
  const pending = state.search('')
  disabled.value = true; model.value = '9007199254740993'
  release({ items: [option('old')], total: 1, nextOffset: 1 }); await pending; await flushPromises()
  await state.search('不应查询'); await state.loadMore()
  expect(search).toHaveBeenCalledTimes(1)
  expect(resolve).toHaveBeenCalledWith('9007199254740993')
  expect(state.selected.value?.value).toBe('9007199254740993')
  expect(state.items.value).toEqual([])
})
it('does not repeatedly request an empty page when total claims more records', async() => {
  const { state, search } = setup()
  search.mockResolvedValue({ items: [], total: 10, nextOffset: 0 })
  await state.search('')
  expect(state.error.value).toContain('分页未向后推进')
  expect(state.hasMore.value).toBe(false)
})
it('blocks duplicate page loads and clears all async state on unmount', async() => {
  const { state, search } = setup()
  await state.search('')
  let release!: (page: SearchPage) => void
  search.mockImplementationOnce(() => new Promise(done => { release = done }))
  const pending = state.loadMore(); await state.loadMore(); await state.retry()
  expect(search).toHaveBeenCalledTimes(2)
  wrapper.unmount()
  release({ items: [option('old')], total: 21, nextOffset: 21 }); await pending
  expect(state.items.value).toEqual([])
  expect(state.loading.value).toBe(false)
})
