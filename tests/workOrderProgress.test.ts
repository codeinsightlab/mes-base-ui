import { effectScope, reactive } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { useWorkOrderProgress } from '../src/composables/useWorkOrderProgress'
import type { WorkOrderProgressPage, WorkOrderProgressQuery } from '../src/api/production/workOrderProgress'

const empty: WorkOrderProgressPage = { items: [], total: 0, offset: 0, limit: 5 }
function setup(factoryId = 'A', granted = true, fetch: (query: WorkOrderProgressQuery) => Promise<WorkOrderProgressPage> = vi.fn(async() => empty)) {
  const auth = reactive({ factoryId, revision: 1, granted, hasPermission() { return this.granted } })
  const scope = effectScope(), state = scope.run(() => useWorkOrderProgress(auth, fetch))!
  return { auth, scope, state, fetch }
}
describe('searchable paged workorder progress', () => {
  it('retains the loaded page and total while refreshing, but clears failed results', async() => {
    let finish!: (value: WorkOrderProgressPage) => void
    const first = { ...empty, total: 12 }
    const fetch = vi.fn().mockResolvedValueOnce(first)
    const { state, scope } = setup('A', true, fetch)
    await flushPromises()
    const updatedAt = state.result.updatedAt
    fetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    state.page.value = 2
    const pending = state.paginate()
    expect(state.loading.value).toBe(true)
    expect(state.result.value?.total).toBe(12)
    expect(state.result.updatedAt).toBe(updatedAt)
    finish({ ...empty, offset: 5, total: 15 }); await pending
    expect(state.result.value?.total).toBe(15)
    fetch.mockRejectedValueOnce(new Error('刷新失败'))
    await state.load()
    expect(state.result.state).toBe('error'); expect(state.result.value).toBeNull()
    expect(state.result.updatedAt).toBe(''); scope.stop()
  })
  it('searches on the server and resets the page for changed filters and size', async() => {
    const { state, fetch, scope } = setup()
    await flushPromises()
    state.page.value = 3; await state.paginate()
    expect(fetch).toHaveBeenLastCalledWith({ workorderCode: '', productCode: '', status: '', offset: 10, limit: 5 })
    state.workorderCode.value = ' 产品 '; state.productCode.value = ' PRD '; state.status.value = 'RELEASED'; await state.search()
    expect(fetch).toHaveBeenLastCalledWith({ workorderCode: '产品', productCode: 'PRD', status: 'RELEASED', offset: 0, limit: 5 })
    state.page.value = 3; state.limit.value = 20; await state.paginate()
    expect(fetch).toHaveBeenLastCalledWith({ workorderCode: '产品', productCode: 'PRD', status: 'RELEASED', offset: 0, limit: 20 })
    await state.reset()
    expect(state.workorderCode.value).toBe(''); expect(state.productCode.value).toBe(''); expect(state.status.value).toBe(''); scope.stop()
  })
  it('does not fetch before selecting a factory or without list permission', async() => {
    const { auth, state, scope, fetch } = setup('', false)
    await flushPromises(); expect(fetch).not.toHaveBeenCalled()
    auth.factoryId = 'A'; await flushPromises()
    expect(fetch).not.toHaveBeenCalled(); expect(state.result.state).toBe('forbidden'); scope.stop()
  })
  it('clears filters on switching factories and rejects the old response', async() => {
    let finish!: (value: WorkOrderProgressPage) => void
    const fetch = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockResolvedValue(empty)
    const { auth, state, scope } = setup('A', true, fetch)
    state.workorderCode.value = '旧厂工单'; state.page.value = 2; auth.factoryId = 'B'
    expect(state.workorderCode.value).toBe(''); expect(state.page.value).toBe(1)
    finish({ ...empty, total: 999 }); await flushPromises()
    expect(state.result.value?.total).toBe(0); scope.stop()
  })
  it('keeps errors distinct from empty data and clears on revocation or unmount', async() => {
    const fetch = vi.fn().mockRejectedValueOnce(new Error('接口尚未加载')).mockResolvedValue(empty)
    const { auth, state, scope } = setup('A', true, fetch)
    await flushPromises(); expect(state.result.state).toBe('error'); expect(state.result.value).toBeNull()
    await state.load(); expect(state.result.state).toBe('ready'); expect(state.result.value?.total).toBe(0)
    auth.granted = false
    expect(state.result.value).toBeNull(); expect(state.result.state).toBe('forbidden')
    scope.stop(); expect(state.result.state).toBe('idle')
  })
  it('ignores results from an older search and from unmounted requests', async() => {
    let finish!: (value: WorkOrderProgressPage) => void
    const fetch = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockResolvedValue(empty)
    const { state, scope } = setup('A', true, fetch)
    state.workorderCode.value = '新查询'; await state.search(); finish({ ...empty, total: 99 }); await flushPromises()
    expect(state.result.value?.total).toBe(0)
    fetch.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const pending = state.load(); scope.stop(); finish({ ...empty, total: 55 }); await pending
    expect(state.result.value).toBeNull()
  })
})
