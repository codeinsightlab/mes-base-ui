import { effectScope, nextTick, reactive } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { useDruidMonitor } from '../src/composables/useDruidMonitor'
import type { DruidCatalog, DruidSnapshot, DruidSource } from '../src/api/monitor/druid'
const source = (id: string): DruidSource => ({ id, name: id, kind: 'EXTERNAL', factoryId: null, factoryName: null, state: 'NOT_INITIALIZED', databaseType: 'sqlserver', poolName: null })
const snapshot = (id: string): DruidSnapshot => ({ source: source(id), nodeId: 'TEST_ONLY', capturedAt: '2026-10-06T00:00:00Z', pool: null, sql: [], wall: null })
const settle = async() => { await Promise.resolve();await nextTick();await Promise.resolve();await nextTick() }
function setup(allowed = true) {
  const access = reactive({ revision: 1, allowed, hasPermission() { return this.allowed } })
  const loaders = { catalog: vi.fn(async(): Promise<DruidCatalog> => ({ rows: [source('external:hr'), source('external:wms')], total: 2, nodeId: 'TEST_ONLY' })), snapshot: vi.fn(async(id: string) => snapshot(id)) }
  const scope = effectScope(), monitor = scope.run(() => useDruidMonitor(access, loaders))!
  return { access, loaders, scope, monitor }
}
describe('node-local multi-pool monitor lifecycle', () => {
  it('does not issue catalog or detail requests without the platform monitoring permission', async() => {
    const { loaders, scope, monitor } = setup(false)
    await settle()
    expect(loaders.catalog).not.toHaveBeenCalled();expect(loaders.snapshot).not.toHaveBeenCalled()
    expect(monitor.error.value).toContain('未授权');scope.stop()
  })
  it('switches source and rejects a previous pool response arriving later', async() => {
    const { loaders, scope, monitor } = setup()
    await settle()
    let resolve!: (data: DruidSnapshot) => void
    loaders.snapshot.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const old = monitor.select('external:hr')
    expect(monitor.snapshot.value).toBeNull()
    await monitor.select('external:wms')
    resolve(snapshot('external:hr'));await old
    expect(monitor.snapshot.value?.source.id).toBe('external:wms');scope.stop()
  })
  it('clears a prior snapshot after read failure and supports retry without fabricated statistics', async() => {
    const { loaders, scope, monitor } = setup()
    await settle()
    loaders.snapshot.mockRejectedValueOnce(new Error('TEST ONLY unavailable'))
    await monitor.select('external:wms')
    expect(monitor.snapshot.value).toBeNull();expect(monitor.detailError.value).toContain('unavailable')
    await monitor.select('external:wms')
    expect(monitor.detailError.value).toBe('');expect(monitor.snapshot.value?.pool).toBeNull();scope.stop()
  })
  it('drops loaded state and late results on context revocation', async() => {
    const { access, loaders, scope, monitor } = setup()
    await settle()
    let resolve!: (data: DruidSnapshot) => void
    loaders.snapshot.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const old = monitor.select('external:wms')
    access.allowed = false;access.revision++;await settle()
    resolve(snapshot('external:wms'));await old
    expect(monitor.catalog.value).toBeNull();expect(monitor.snapshot.value).toBeNull();expect(monitor.loading.value).toBe(false);scope.stop()
  })
  it('does not apply results after leaving the monitor page', async() => {
    const { loaders, scope, monitor } = setup()
    await settle()
    let resolve!: (data: DruidSnapshot) => void
    loaders.snapshot.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    const pending = monitor.select('external:wms');scope.stop();resolve(snapshot('external:wms'));await pending
    expect(monitor.snapshot.value).toBeNull()
  })
})
