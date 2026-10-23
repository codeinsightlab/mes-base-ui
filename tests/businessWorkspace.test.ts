import { effectScope, reactive } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { useBusinessWorkspace, businessWorkspaceLoaders } from '../src/composables/useBusinessWorkspace'

const page = { items: [], total: 0, offset: 0, limit: 6 }
function loaders(): typeof businessWorkspaceLoaders {
  return {
    drafts: vi.fn(async() => page), released: vi.fn(async() => page),
    ready: vi.fn(async() => page), running: vi.fn(async() => page), reports: vi.fn(async() => []),
    defects: vi.fn(async() => [])
  }
}
function setup(factoryId = 'A', grants = ['workorder:list', 'business:mes:production:execution:list', 'business:production:report:detail', 'business:quality:defect:read'], fetch = loaders()) {
  const auth = reactive({ factoryId, revision: 1, grants, hasPermission(code: string) { return this.grants.includes(code) } })
  const scope = effectScope(), state = scope.run(() => useBusinessWorkspace(auth, fetch))!
  return { auth, scope, state, fetch }
}
describe('real business workspace isolation and partial read states', () => {
  it('retains same-factory snapshots during refresh but clears data immediately on context changes', async() => {
    const fetch = loaders()
    const { state, auth, scope } = setup('A', undefined, fetch)
    await flushPromises()
    let finish!: (value: typeof page) => void
    fetch.drafts = vi.fn(() => new Promise<typeof page>(resolve => { finish = resolve }))
    const pending = state.reload()
    expect(state.drafts.state).toBe('loading'); expect(state.drafts.value).not.toBeNull()
    finish({ ...page, total: 25 }); await pending
    expect(state.drafts.value?.total).toBe(25)
    const finishes: Array<(value: typeof page) => void> = []
    fetch.drafts = vi.fn(() => new Promise<typeof page>(resolve => { finishes.push(resolve) }))
    const old = state.reload()
    auth.factoryId = 'B'
    expect(state.drafts.value).toBeNull(); expect(state.drafts.updatedAt).toBe('')
    scope.stop(); finishes.forEach(resolve => resolve(page)); await old; await flushPromises()
    // Both the old in-flight request and the new-factory request are invalid after disposal.
    expect(state.drafts.value).toBeNull()
  })
  it('never requests a business API before selecting a factory', async() => {
    const { state, scope, fetch } = setup('')
    await flushPromises()
    for (const loader of Object.values(fetch)) expect(loader).not.toHaveBeenCalled()
    expect(state.drafts.state).toBe('idle'); scope.stop()
  })
  it('gates every module independently and preserves real zero totals', async() => {
    const { state, fetch, scope } = setup('A', ['workorder:list'])
    await flushPromises()
    expect(fetch.drafts).toHaveBeenCalledOnce()
    expect(fetch.ready).not.toHaveBeenCalled(); expect(fetch.reports).not.toHaveBeenCalled(); expect(fetch.defects).not.toHaveBeenCalled()
    expect(state.drafts.value?.total).toBe(0); expect(state.reports.state).toBe('forbidden'); scope.stop()
  })
  it('does not turn an interface failure into zero or a sample, and retries it', async() => {
    const fetch = loaders()
    fetch.reports = vi.fn().mockRejectedValueOnce(new Error('读取失败')).mockResolvedValueOnce([])
    const { state, scope } = setup('A', undefined, fetch)
    await flushPromises()
    expect(state.drafts.state).toBe('ready'); expect(state.reports.state).toBe('error')
    expect(state.reports.value).toBeNull(); await state.reload()
    expect(state.reports.value).toEqual([]); expect(state.reports.error).toBe(''); scope.stop()
  })
  it('clears synchronously on switching factories and rejects late old results', async() => {
    const fetch = loaders()
    let finish!: (value: typeof page) => void
    fetch.drafts = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockResolvedValue(page)
    const { state, auth, scope } = setup('A', undefined, fetch)
    await flushPromises(); auth.factoryId = 'B'
    expect(state.drafts.value).toBeNull()
    finish({ ...page, total: 999 }); await flushPromises()
    expect(state.drafts.value?.total).toBe(0); scope.stop()
  })
  it('clears on permission revocation even without a revision bump', async() => {
    const { state, auth, scope } = setup()
    await flushPromises(); expect(state.drafts.state).toBe('ready')
    auth.grants = []
    expect(state.drafts.value).toBeNull(); expect(state.drafts.state).toBe('forbidden')
    expect(state.reports.value).toBeNull(); scope.stop()
  })
  it('ignores old errors and unmounted pending requests', async() => {
    const fetch = loaders()
    let reject!: (error: Error) => void
    fetch.reports = vi.fn().mockImplementationOnce(() => new Promise((_, r) => { reject = r })).mockResolvedValue([])
    const { state, scope } = setup('A', undefined, fetch)
    await state.reload(); reject(new Error('old error')); await flushPromises()
    expect(state.reports.state).toBe('ready'); expect(state.reports.error).toBe('')
    let finish!: (value: []) => void
    fetch.reports = vi.fn(() => new Promise<[]>(resolve => { finish = resolve }))
    const pending = state.reload(); scope.stop(); finish([]); await pending
    expect(state.reports.value).toBeNull(); expect(state.reports.state).toBe('idle')
  })
})
