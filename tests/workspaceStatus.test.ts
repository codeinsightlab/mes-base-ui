import { effectScope, nextTick, reactive } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { useWorkspaceStatus, type WorkspaceLoaders } from '../src/composables/useWorkspaceStatus'

function loaders(): WorkspaceLoaders {
  return {
    online: vi.fn(async() => 2), jobs: vi.fn(async() => ({ rows: [], total: 0 })),
    server: vi.fn(async() => ({ cpu: { free: 83 }, mem: { usage: 36 }, jvm: { runTime: '1小时' }})),
    cache: vi.fn(async() => ({ info: { redis_version: '7', used_memory_human: '1M' }, dbSize: 10 })),
    operations: vi.fn(async() => ({ rows: [], total: 0 }))
  }
}
const settle = async() => { await Promise.resolve(); await nextTick(); await Promise.resolve() }
function setup(allowed = true, fetch = loaders()) {
  const access = reactive({ revision: 1, allowed, hasPermission() { return this.allowed } })
  const scope = effectScope()
  const workspace = scope.run(() => useWorkspaceStatus(access, fetch))!
  return { access, scope, workspace, fetch }
}

describe('Permission gated workspace snapshots', () => {
  it('issues no monitoring requests for an unprivileged account', async() => {
    const { workspace, fetch, scope } = setup(false)
    await settle()
    for (const request of Object.values(fetch)) expect(request).not.toHaveBeenCalled()
    expect(workspace.online.state).toBe('forbidden')
    expect(workspace.online.value).toBeNull()
    expect(workspace.loading.value).toBe(false)
    scope.stop()
  })
  it('uses the individual platform permission for every resource', async() => {
    const fetch = loaders(), scope = effectScope()
    const hasPermission = vi.fn((code: string, permissionScope: 'platform') => permissionScope === 'platform' && code !== 'monitor:cache:list')
    const workspace = scope.run(() => useWorkspaceStatus({ revision: 1, hasPermission }, fetch))!
    await settle()
    expect(fetch.cache).not.toHaveBeenCalled()
    expect(fetch.online).toHaveBeenCalledTimes(1)
    expect(workspace.cache.state).toBe('forbidden')
    expect(hasPermission.mock.calls.map(call => call[0])).toEqual(['monitor:online:list', 'monitor:job:list', 'monitor:server:list', 'monitor:cache:list', 'monitor:operlog:list'])
    for (const call of hasPermission.mock.calls) expect(call[1]).toBe('platform')
    scope.stop()
  })
  it('loads each existing resource once and preserves a genuine empty task list', async() => {
    const { workspace, fetch, scope } = setup()
    await settle()
    for (const request of Object.values(fetch)) expect(request).toHaveBeenCalledTimes(1)
    expect(workspace.jobs.value).toEqual({ rows: [], total: 0 })
    expect(workspace.online.value).toBe(2)
    expect(workspace.loading.value).toBe(false)
    scope.stop()
  })
  it('keeps one failed service separate from successful snapshots and supports retry', async() => {
    const fetch = loaders()
    fetch.cache = vi.fn().mockRejectedValueOnce(new Error('缓存读取失败')).mockResolvedValue({ info: { redis_version: '7', used_memory_human: '1M' }, dbSize: 0 })
    const { workspace, scope } = setup(true, fetch)
    await settle()
    expect(workspace.cache.state).toBe('error')
    expect(workspace.cache.value).toBeNull()
    expect(workspace.online.state).toBe('ready')
    await workspace.reload()
    expect(workspace.cache.state).toBe('ready')
    expect(workspace.cache.error).toBe('')
    expect(workspace.cache.value?.dbSize).toBe(0)
    scope.stop()
  })
  it('clears previous data and rejects an old context response after authorization changes', async() => {
    const fetch = loaders()
    let finish!:(value:number) => void
    fetch.online = vi.fn(() => new Promise<number>(resolve => { finish = resolve }))
    const { access, workspace, scope } = setup(true, fetch)
    await settle()
    access.allowed = false; access.revision++
    await nextTick()
    finish(99); await settle()
    expect(workspace.online.state).toBe('forbidden')
    expect(workspace.online.value).toBeNull()
    expect(workspace.jobs.value).toBeNull()
    scope.stop()
  })
  it('rejects stale refresh and unmounted responses', async() => {
    const fetch = loaders()
    let finishOld!:(value:number) => void
    let finishUnmounted!:(value:number) => void
    fetch.online = vi.fn().mockImplementationOnce(() => new Promise<number>(resolve => { finishOld = resolve })).mockResolvedValueOnce(3).mockImplementationOnce(() => new Promise<number>(resolve => { finishUnmounted = resolve }))
    const { workspace, scope } = setup(true, fetch)
    await workspace.reload()
    finishOld(99); await settle()
    expect(workspace.online.value).toBe(3)
    const pending = workspace.reload()
    scope.stop(); finishUnmounted(77); await pending
    expect(workspace.online.value).toBeNull()
  })
})
