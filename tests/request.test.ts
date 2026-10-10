import { describe, it, expect, vi, beforeEach } from 'vitest'
import { request, configureRequests, ApiError } from '../src/lib/request'
let revision = 0;const unauthorized = vi.fn()
beforeEach(() => { revision = 0;unauthorized.mockClear();configureRequests(() => ({ token: 'TEST-ONLY-token', factoryId: 'A', revision }), unauthorized) })
describe('Base request contract', () => {
  it('sends identity and selected factory, with no response fallback', async() => { const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [], total: 0, offset: 0, limit: 20 }), { headers: { 'Content-Type': 'application/json' }}));vi.stubGlobal('fetch', fetcher);const result = await request('/api/demo', { query: { offset: 0, limit: 20 }});expect(result).toEqual({ items: [], total: 0, offset: 0, limit: 20 });const [url, options] = fetcher.mock.calls[0]!;expect(url).toBe('/api/demo?offset=0&limit=20');expect(options.headers.get('X-Factory-Id')).toBe('A');expect(options.headers.get('Authorization')).toBe('Bearer TEST-ONLY-token') })
  it('platform calls carry selected Factory without changing scope', async() => { const fetcher = vi.fn().mockResolvedValue(new Response('{}'));vi.stubGlobal('fetch', fetcher);await request('/api/system/user/list', { scope: 'platform' });expect(fetcher.mock.calls[0]![1].headers.get('X-Factory-Id')).toBe('A') })
  it('public login omits credentials from old identity', async() => { const fetcher = vi.fn().mockResolvedValue(new Response('{}'));vi.stubGlobal('fetch', fetcher);await request('/api/session', { public: true, scope: 'platform', method: 'POST', body: { username: 'TEST', password: 'TEST ONLY' }});expect(fetcher.mock.calls[0]![1].headers.has('Authorization')).toBe(false) })
  it('401 clears identity and retains safe request correlation', async() => { vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ errorCode: 'UNAUTHENTICATED', message: 'Authentication required', requestId: 'TEST-ID' }), { status: 401 })));try { await request('/api/demo');throw new Error('expected error') } catch(e) { expect(e).toBeInstanceOf(ApiError);expect((e as ApiError).requestId).toBe('TEST-ID');expect((e as Error).message).toContain('重新登录') }expect(unauthorized).toHaveBeenCalledOnce() })
  it('403 remains a failure even when body resembles legacy AjaxResult', async() => { vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"code":200}', { status: 403 })));await expect(request('/api/demo')).rejects.toMatchObject({ status: 403 }) })
  it('rejects stale data after factory change', async() => { vi.stubGlobal('fetch', vi.fn().mockImplementation(async() => { revision++;return new Response('{}') }));await expect(request('/api/demo')).rejects.toMatchObject({ code: 'CONTEXT_CHANGED' }) })
  it('rejects A after a switch during body consumption while B succeeds', async() => {
    let release!: (value: string) => void
    const responseA = new Response('{}')
    vi.spyOn(responseA, 'text').mockImplementation(() => new Promise(resolve => { release = resolve }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(responseA).mockResolvedValueOnce(new Response('{"factory":"B"}')))
    const pendingA = request('/api/demo')
    await vi.waitFor(() => expect(release).toBeTypeOf('function'))
    revision++
    configureRequests(() => ({ token: 'TEST-ONLY-token', factoryId: 'B', revision }), unauthorized)
    await expect(request('/api/demo')).resolves.toEqual({ factory: 'B' })
    release('{"factory":"A"}')
    await expect(pendingA).rejects.toMatchObject({ code: 'CONTEXT_CHANGED' })
  })
  it('an old 401 body cannot clear a newly selected context', async() => {
    let release!: (value: string) => void
    const response = new Response('{}', { status: 401 })
    vi.spyOn(response, 'json').mockImplementation(() => new Promise(resolve => { release = resolve }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
    const pending = request('/api/demo')
    await vi.waitFor(() => expect(release).toBeTypeOf('function'))
    revision++
    release('{"errorCode":"UNAUTHENTICATED"}')
    await expect(pending).rejects.toMatchObject({ code: 'CONTEXT_CHANGED' })
    expect(unauthorized).not.toHaveBeenCalled()
  })
  it('represents network failure explicitly', async() => { vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('TEST ONLY internal detail')));await expect(request('/api/demo')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });await expect(request('/api/demo')).rejects.not.toThrow('internal detail') })
  it('multipart upload leaves content-type boundary to browser', async() => { const fetcher = vi.fn().mockResolvedValue(new Response('{}'));vi.stubGlobal('fetch', fetcher);await request('/api/platform/files', { method: 'POST', body: new FormData() });expect(fetcher.mock.calls[0]![1].headers.has('Content-Type')).toBe(false) })
})
