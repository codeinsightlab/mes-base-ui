import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuth } from '../src/stores/auth'
import { configureRequests } from '../src/lib/request'
import { SESSION_KEY, readSession, saveSession } from '../src/lib/sessionStorage'

const expiresAt = () => new Date(Date.now() + 3600000).toISOString()
const info = { user: { userName: 'server-user', avatar: '' }, permissions: ['system:user:list'], workspaces: { platform: true, factoryIds: ['A'] }, passwordPolicy: { minLength: 5, maxLength: 128, maxBytes: 72 }}
function store() {
  setActivePinia(createPinia())
  const auth = useAuth()
  configureRequests(() => ({ token: auth.token, factoryId: auth.factoryId, revision: auth.revision }), () => auth.clear())
  return auth
}
function responses(factories = [{ factoryId: 'A', name: 'Factory A' }]) {
  const fetcher = vi.fn().mockImplementation(async(path: string) => {
    const body = path.includes('/info') ? info : path.includes('/getRouters') ? { data: [] } : path.includes('/factories') ? factories : { menus: [], permissions: ['TEST_ONLY:factory:read'] }
    return new Response(JSON.stringify(body))
  })
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
beforeEach(() => { localStorage.clear();vi.unstubAllGlobals() })
describe('persisted login restoration', () => {
  it('restores a fresh store, validating credentials and refreshing permissions from server', async() => {
    saveSession({ token: 'TEST_ONLY', expiresAt: expiresAt(), factoryId: 'A' })
    const auth = store(), fetcher = responses()
    expect(auth.factoryPermissions).toEqual([])
    await Promise.all([auth.restoreSession(), auth.restoreSession()])
    expect(fetcher).toHaveBeenCalledTimes(4)
    expect(auth.sessionReady).toBe(true)
    expect(auth.username).toBe('server-user')
    expect(auth.platformPermissions).toEqual(info.permissions)
    expect(auth.factoryId).toBe('A')
    expect(auth.factoryPermissions).toEqual(['TEST_ONLY:factory:read'])
    expect(fetcher.mock.calls[0]![1].headers.get('Authorization')).toBe('Bearer TEST_ONLY')
    expect(JSON.parse(localStorage.getItem(SESSION_KEY)!)).toEqual({ token: 'TEST_ONLY', expiresAt: auth.expiresAt, factoryId: 'A' })
  })
  it('drops expired or malformed saved credentials without requests', async() => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ token: 'TEST', expiresAt: '2000-01-01', factoryId: 'A' }))
    const auth = store(), fetcher = responses()
    await auth.restoreSession()
    expect(auth.loggedIn).toBe(false)
    expect(fetcher).not.toHaveBeenCalled()
    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
    localStorage.setItem(SESSION_KEY, '{invalid')
    expect(readSession()).toBeNull()
  })
  it('clears a server-revoked session on 401', async() => {
    saveSession({ token: 'TEST', expiresAt: expiresAt(), factoryId: '' })
    const auth = store()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })))
    await expect(auth.restoreSession()).rejects.toMatchObject({ status: 401 })
    expect(auth.loggedIn).toBe(false)
    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
  })
  it('retains an unexpired credential during network failure and can retry', async() => {
    saveSession({ token: 'TEST', expiresAt: expiresAt(), factoryId: '' })
    const auth = store()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('TEST ONLY offline')))
    await expect(auth.restoreSession()).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
    expect(readSession()?.token).toBe('TEST')
    expect(auth.sessionReady).toBe(false)
    expect(auth.sessionError).toContain('连接失败')
    responses()
    await auth.restoreSession()
    expect(auth.sessionReady).toBe(true)
    expect(auth.sessionError).toBe('')
  })
  it('does not restore a disabled factory or select the first available factory', async() => {
    saveSession({ token: 'TEST', expiresAt: expiresAt(), factoryId: 'REMOVED' })
    const auth = store(), fetcher = responses()
    await auth.restoreSession()
    expect(auth.factoryId).toBe('')
    expect(auth.factoryPermissions).toEqual([])
    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(readSession()?.factoryId).toBe('')
  })
  it('persists login without passwords or cached privileges, and removes it on logout', async() => {
    const auth = store()
    const fetcher = responses()
    fetcher.mockImplementation(async(path: string) => new Response(JSON.stringify(path.includes('/session') ? { accessToken: 'TEST', expiresAt: expiresAt() } : path.includes('/info') ? info : path.includes('/getRouters') ? { data: [] } : [])))
    await auth.login('TEST-user', 'TEST ONLY password')
    expect(Object.keys(JSON.parse(localStorage.getItem(SESSION_KEY)!)).sort()).toEqual(['expiresAt', 'factoryId', 'token'])
    await auth.logout()
    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
    expect(auth.platformPermissions).toEqual([])
  })
})
