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
  it('only the dedicated code requests factory recovery, without clearing identity', async() => {
    const recover = vi.fn()
    configureRequests(() => ({ token: 'TEST', factoryId: 'A', revision }), unauthorized, recover)
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('{"errorCode":"BUSINESS_REJECTED"}', { status: 422 }))
      .mockResolvedValueOnce(new Response('{"errorCode":"FACTORY_SELECTION_REQUIRED"}', { status: 422 }))
    vi.stubGlobal('fetch', fetcher)
    await expect(request('/api/demo')).rejects.toMatchObject({ code: 'BUSINESS_REJECTED' })
    expect(recover).not.toHaveBeenCalled()
    await expect(request('/api/demo')).rejects.toMatchObject({ code: 'FACTORY_SELECTION_REQUIRED' })
    expect(recover).toHaveBeenCalledOnce()
    expect(unauthorized).not.toHaveBeenCalled()
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
  it('ERP not configured is explicit and does not trigger factory recovery', async() => {
    const recover = vi.fn()
    configureRequests(() => ({ token: 'TEST', factoryId: 'A', revision }), unauthorized, recover)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"errorCode":"ERP_SYNC_NOT_CONFIGURED"}', { status: 422 })))
    await expect(request('/api/material/material/actions/sync', { method: 'POST' })).rejects.toMatchObject({
      code: 'ERP_SYNC_NOT_CONFIGURED', message: '暂未配置 ERP 同步数据来源', status: 422
    })
    expect(recover).not.toHaveBeenCalled()
    expect(unauthorized).not.toHaveBeenCalled()
  })
  it.each([
    ['SYNC_RUNNING', 409, '同步正在进行，请稍后重试'],
    ['SYNC_EXECUTION_LOST', 409, '同步执行权已失效，请重新发起'],
    ['ERP_OPERATION_NOT_CONFIGURED', 422, '暂未配置工序 ERP 同步数据来源'],
    ['ERP_ROUTING_NOT_CONFIGURED', 422, '暂未配置工艺路线 ERP 同步数据来源'],
    ['ROUTING_FROZEN', 409, '已发布路线内容已冻结，请创建新版本'],
    ['ROUTING_GRAPH_INVALID', 422, '路线拓扑无效，请检查节点、连接、环路及孤立节点'],
    ['WORKORDER_INVALID', 422, '工单、批次数量、工艺引用或完整路径不符合规则'],
    ['BATCH_ROUTE_FROZEN', 409, '路径已锁定、正在出库或待核实，禁止更改']
  ])('keeps identity and factory for production error %s', async(code, status, message) => {
    const recover = vi.fn()
    configureRequests(() => ({ token: 'TEST', factoryId: 'A', revision }), unauthorized, recover)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ errorCode: code }), { status })))
    await expect(request('/api/production/routing')).rejects.toMatchObject({ code, status, message })
    expect(recover).not.toHaveBeenCalled()
    expect(unauthorized).not.toHaveBeenCalled()
  })
  it('a stale factory error cannot interrupt the new factory', async() => {
    const recover = vi.fn()
    configureRequests(() => ({ token: 'TEST', factoryId: 'A', revision }), unauthorized, recover)
    let release!: (value: unknown) => void
    const response = new Response('{}', { status: 422 })
    vi.spyOn(response, 'json').mockImplementation(() => new Promise(resolve => { release = resolve }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
    const pending = request('/api/demo')
    await vi.waitFor(() => expect(release).toBeTypeOf('function'))
    revision++
    release({ errorCode: 'FACTORY_SELECTION_REQUIRED' })
    await expect(pending).rejects.toMatchObject({ code: 'CONTEXT_CHANGED' })
    expect(recover).not.toHaveBeenCalled()
  })
  it('represents network failure explicitly', async() => { vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('TEST ONLY internal detail')));await expect(request('/api/demo')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });await expect(request('/api/demo')).rejects.not.toThrow('internal detail') })
  it('multipart upload leaves content-type boundary to browser', async() => { const fetcher = vi.fn().mockResolvedValue(new Response('{}'));vi.stubGlobal('fetch', fetcher);await request('/api/platform/files', { method: 'POST', body: new FormData() });expect(fetcher.mock.calls[0]![1].headers.has('Content-Type')).toBe(false) })
})

describe('warehouse and inventory business errors', () => {
  it.each([
    ['STOCK_KEY_DUPLICATE', 409, '当前工厂已有相同仓库编码或物料仓库库存记录'],
    ['STOCK_REFERENCE_INVALID', 422, '物料和仓库必须存在且属于当前工厂'],
    ['WAREHOUSE_REFERENCED', 409, '仓库已被库存引用，不能删除'],
    ['MATERIAL_INVENTORY_REFERENCED', 409, '物料已被库存引用，不能删除'],
    ['SYNC_QUERY_NOT_IMPLEMENTED', 422, '暂未接入外部同步查询接口']
  ])('shows an explicit safe message for %s', async(code, status, message) => {
    const recover = vi.fn()
    configureRequests(() => ({ token: 'TEST ONLY', factoryId: 'A', revision }), unauthorized, recover)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ errorCode: code, message: 'SQL INTERNAL SECRET', requestId: 'TEST' }), { status: status as number })))
    await expect(request('/api/wm/wm-inventory')).rejects.toMatchObject({ code, status, message })
    expect(recover).not.toHaveBeenCalled()
    expect(unauthorized).not.toHaveBeenCalled()
  })
})
