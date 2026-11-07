// Shared async behavior with mocked callbacks; no transport or database writes.
import { afterEach, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { useRemoteOptions, type SearchResult, type SearchOption } from '../src/composables/useRemoteOptions'

const option = (value: string): SearchOption => ({ value, label: '选项 ' + value })
let wrapper: ReturnType<typeof mount>
afterEach(() => {
  wrapper?.unmount()
  vi.useRealTimers()
})

function setup() {
  const model = ref<string | null>(null), disabled = ref(false), enabled = ref(true)
  const search = vi.fn().mockResolvedValue({ items: [option('1')] })
  const resolve = vi.fn().mockResolvedValue(option('9007199254740993'))
  let state!: ReturnType<typeof useRemoteOptions>
  wrapper = mount(defineComponent({ setup() {
    state = useRemoteOptions({ modelValue: () => model.value, disabled: () => disabled.value, enabled: () => enabled.value, search, resolve })
    return () => null
  } }))
  return { model, disabled, enabled, search, resolve, state }
}

it('always requests the first 20 matches and retries without appending previous results', async() => {
  const { state, search } = setup()
  search.mockRejectedValueOnce(new Error('offline'))
  await state.search('warehouse')
  expect(state.error.value).toBe('offline')
  search.mockResolvedValueOnce({ items: [option('1'), option('1'), option('2')] })
  await state.retry()
  expect(search.mock.calls.map(call => call[0])).toEqual([
    { keyword: 'warehouse', offset: 0, limit: 20 }, { keyword: 'warehouse', offset: 0, limit: 20 }
  ])
  expect(state.items.value.map(row => row.value)).toEqual(['1', '2'])
})
it('debounces typing and invalidates the previous request before the debounce expires', async() => {
  vi.useFakeTimers()
  const { state, search } = setup()
  let release!: (page: SearchResult) => void
  search.mockImplementationOnce(() => new Promise(resolve => {
    release = resolve
  }))
  const old = state.search('旧')
  await flushPromises()
  state.scheduleSearch('新')
  expect(state.loading.value).toBe(true)
  release({ items: [option('old')] })
  await old
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
  resolve.mockImplementationOnce(() => new Promise(done => {
    release = done
  }))
  model.value = 'old'
  const list = state.search('')
  model.value = '9007199254740993'
  await list
  await flushPromises()
  release(option('old'))
  await flushPromises()
  expect(state.selected.value?.value).toBe('9007199254740993')
  expect(state.items.value).toHaveLength(1)
  expect(state.loading.value).toBe(false)
  expect(search).toHaveBeenCalledTimes(1)
})
it('resets context while requests and a scheduled search are outstanding', async() => {
  vi.useFakeTimers()
  const { state, model, search, resolve } = setup()
  let release!: (option: SearchOption) => void
  resolve.mockImplementationOnce(() => new Promise(done => {
    release = done
  }))
  model.value = 'old'
  state.scheduleSearch('旧工厂')
  state.reset()
  release(option('old'))
  await flushPromises()
  await vi.advanceTimersByTimeAsync(300)
  expect(state.items.value).toEqual([])
  expect(state.selected.value).toBeNull()
  expect(search).not.toHaveBeenCalled()
})
it('queries only the selected detail when disabled and cancels in-flight list responses', async() => {
  const { state, model, disabled, search, resolve } = setup()
  let release!: (page: SearchResult) => void
  search.mockImplementationOnce(() => new Promise(done => {
    release = done
  }))
  const pending = state.search('')
  await flushPromises()
  disabled.value = true
  model.value = '9007199254740993'
  release({ items: [option('old')] })
  await pending
  await flushPromises()
  await state.search('不应查询')
  expect(search).toHaveBeenCalledTimes(1)
  expect(resolve).toHaveBeenCalledWith('9007199254740993')
  expect(state.selected.value?.value).toBe('9007199254740993')
  expect(state.items.value).toEqual([])
})
it('accepts an empty result without requesting additional pages', async() => {
  const { state, search } = setup()
  search.mockResolvedValue({ items: [] })
  await state.search('')
  await state.open()
  expect(state.error.value).toBe('')
  expect(state.items.value).toEqual([])
  expect(search).toHaveBeenCalledTimes(1)
})
it('caps candidates at 20 and still resolves a selected value outside those candidates', async() => {
  const { state, search, model, resolve } = setup()
  search.mockResolvedValue({ items: Array.from({ length: 50 }, (_, i) => option(String(i))) })
  await state.search('')
  expect(state.items.value).toHaveLength(20)
  model.value = '9007199254740993'
  await flushPromises()
  expect(resolve).toHaveBeenCalledWith('9007199254740993')
  expect(state.selected.value?.value).toBe('9007199254740993')
})
it('blocks duplicate retries and clears asynchronous state on unmount', async() => {
  const { state, search } = setup()
  let release!: (result: SearchResult) => void
  search.mockImplementationOnce(() => new Promise(done => {
    release = done
  }))
  const pending = state.search('')
  await flushPromises()
  await state.retry()
  await state.open()
  expect(search).toHaveBeenCalledTimes(1)
  wrapper.unmount()
  release({ items: [option('old')] })
  await pending
  expect(state.items.value).toEqual([])
  expect(state.loading.value).toBe(false)
})

it('uses a changed system limit for both request size and candidate count', async() => {
  const { getConfigKey } = await import('../src/api/system/config')
  const { state, search } = setup()
  search.mockResolvedValue({ items: Array.from({ length: 60 }, (_, i) => option(String(i))) })
  vi.mocked(getConfigKey).mockResolvedValueOnce({ data: '50' })
  await state.search('first')
  expect(search).toHaveBeenLastCalledWith({ keyword: 'first', offset: 0, limit: 50 })
  expect(state.items.value).toHaveLength(50)
  vi.mocked(getConfigKey).mockResolvedValueOnce({ data: '20' })
  await state.search('second')
  expect(search).toHaveBeenLastCalledWith({ keyword: 'second', offset: 0, limit: 20 })
  expect(state.items.value).toHaveLength(20)
})
