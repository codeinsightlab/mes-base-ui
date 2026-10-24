import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configureRequests, request, requestBlob, requestStream } from '../src/lib/request'

let revision = 0
let token = 'TEST ONLY'
let factoryId = 'A'
const unauthorized = vi.fn()
const recoverFactory = vi.fn()
beforeEach(() => {
  vi.useFakeTimers()
  revision = 0; token = 'TEST ONLY'; factoryId = 'A'
  unauthorized.mockClear(); recoverFactory.mockClear()
  configureRequests(() => ({ revision, token, factoryId }), unauthorized, recoverFactory)
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

// Headers arrive immediately; body completion is explicitly controlled, with no wall-clock sleeps.
function pendingBody(status = 200, method: 'text' | 'json' | 'blob' = 'text') {
  const response = new Response('{}', { status, headers: { 'X-Request-Id': 'TEST-BODY-ID' }})
  let finish!: (value: never) => void
  let fail!: (error: Error) => void
  const started = vi.spyOn(response, method).mockImplementation(() => new Promise<never>((resolve, reject) => { finish = resolve; fail = reject }))
  let signal!: AbortSignal
  vi.stubGlobal('fetch', vi.fn(async(_path, options: RequestInit) => { signal = options.signal!; return response }))
  return { response, started, finish: (value: unknown) => finish(value as never), fail: (error: Error) => fail(error), signal: () => signal }
}
async function bodyStarted(mock: ReturnType<typeof pendingBody>) {
  // Flush only promise jobs; advancing the clock is reserved for the assertion below.
  for (let step = 0; step < 20 && !mock.started.mock.calls.length; step++) await Promise.resolve()
  expect(mock.started).toHaveBeenCalledOnce()
}
function capture<T>(promise: Promise<T>) { return promise.then(value => ({ value }), error => ({ error })) }

describe('whole-response deadline', () => {
  it.each(['success', 'error', 'blob', 'stream error'] as const)('aborts a stalled %s body at the original deadline', async kind => {
    const mock = pendingBody(kind.includes('error') ? 409 : 200, kind === 'blob' ? 'blob' : kind.includes('error') ? 'json' : 'text')
    const result = capture(kind === 'blob' ? requestBlob('/api/test', { timeoutMs: 1000 }) : kind === 'stream error' ? requestStream('/api/test', { timeoutMs: 1000 }) : request('/api/test', { timeoutMs: 1000 }))
    await bodyStarted(mock)
    expect(vi.getTimerCount()).toBe(1)
    const remove = vi.spyOn(mock.signal(), 'removeEventListener')
    await vi.advanceTimersByTimeAsync(999)
    expect(mock.signal().aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(await result).toMatchObject({ error: { code: 'NETWORK_ERROR', status: 0, requestId: 'TEST-BODY-ID' }})
    expect(mock.signal().aborted).toBe(true)
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
    expect(vi.getTimerCount()).toBe(0)
    expect(unauthorized).not.toHaveBeenCalled(); expect(recoverFactory).not.toHaveBeenCalled()
  })
  it.each(['timeout', 'rejection'] as const)('cleans the header-wait listener on fetch %s', async failure => {
    let signal!: AbortSignal
    let rejectFetch!: (reason: Error) => void
    vi.stubGlobal('fetch', vi.fn((_path, options: RequestInit) => {
      signal = options.signal!
      return new Promise<Response>((_resolve, reject) => { rejectFetch = reject })
    }))
    const result = capture(request('/api/test', { timeoutMs: 1000 }))
    for (let step = 0; step < 10 && !signal; step++) await Promise.resolve()
    expect(signal).toBeDefined()
    const remove = vi.spyOn(signal, 'removeEventListener')
    if (failure === 'timeout') await vi.advanceTimersByTimeAsync(1000)
    else rejectFetch(new TypeError('TEST ONLY network failure'))
    expect(await result).toMatchObject({ error: { code: 'NETWORK_ERROR', status: 0 }})
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
    expect(vi.getTimerCount()).toBe(0)
  })
  it('shares one deadline across waiting for headers and body', async() => {
    const mock = pendingBody()
    const originalFetch = fetch
    vi.stubGlobal('fetch', vi.fn(async(...args: Parameters<typeof fetch>) => {
      await new Promise(resolve => setTimeout(resolve, 600))
      return originalFetch(...args)
    }))
    const result = capture(request('/api/test', { timeoutMs: 1000 }))
    await vi.advanceTimersByTimeAsync(600)
    await bodyStarted(mock)
    await vi.advanceTimersByTimeAsync(400)
    expect(await result).toMatchObject({ error: { code: 'NETWORK_ERROR' }})
  })
  it.each(['json', 'blob', 'empty', '204', 'zero length'] as const)('cleans up a completed %s request', async kind => {
    const response = kind === '204' ? new Response(null, { status: 204 }) : new Response(kind === 'empty' ? '' : '{}', { headers: kind === 'zero length' ? { 'content-length': '0' } : {}})
    let signal!: AbortSignal
    vi.stubGlobal('fetch', vi.fn(async(_path, options: RequestInit) => { signal = options.signal!; return response }))
    await (kind === 'blob' ? requestBlob('/api/test', { timeoutMs: 1000 }) : request('/api/test', { timeoutMs: 1000 }))
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(1001)
    expect(signal.aborted).toBe(false)
  })
  it('returns a body completed before deadline and removes its abort listener', async() => {
    const mock = pendingBody()
    const result = request('/api/test', { timeoutMs: 1000 })
    await bodyStarted(mock)
    const remove = vi.spyOn(mock.signal(), 'removeEventListener')
    await vi.advanceTimersByTimeAsync(800)
    mock.finish('{"ok":true}')
    await expect(result).resolves.toEqual({ ok: true })
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
    expect(vi.getTimerCount()).toBe(0)
  })
  it.each(['text', 'json', 'blob'] as const)('normalizes %s transport failure without a definite HTTP rejection', async method => {
    const mock = pendingBody(method === 'json' ? 403 : 200, method)
    const result = capture(method === 'blob' ? requestBlob('/api/test') : request('/api/test'))
    await bodyStarted(mock)
    mock.fail(new TypeError('TEST ONLY transport failure'))
    expect(await result).toMatchObject({ error: { code: 'NETWORK_ERROR', status: 0, requestId: 'TEST-BODY-ID' }})
    expect(vi.getTimerCount()).toBe(0)
  })
  it('keeps malformed successful JSON distinct from interrupted transport', async() => {
    vi.stubGlobal('fetch', vi.fn(async() => new Response('{', { headers: { 'X-Request-Id': 'TEST-PARSE' }})))
    await expect(request('/api/test')).rejects.toMatchObject({ code: 'INVALID_RESPONSE', status: 200, requestId: 'TEST-PARSE' })
    expect(vi.getTimerCount()).toBe(0)
  })
  it('keeps a complete non-JSON HTTP error as an HTTP failure', async() => {
    vi.stubGlobal('fetch', vi.fn(async() => new Response('<html>', { status: 503 })))
    await expect(request('/api/test')).rejects.toMatchObject({ code: 'HTTP_ERROR', status: 503 })
    expect(vi.getTimerCount()).toBe(0)
  })
  it('rejects an already cancelled caller without sending', async() => {
    const controller = new AbortController(); controller.abort()
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
    await expect(request('/api/test', { signal: controller.signal })).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
    expect(fetcher).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0)
  })
  it('caller cancellation interrupts a stuck body and cleans its listener', async() => {
    const mock = pendingBody(401, 'json')
    const controller = new AbortController()
    const result = capture(request('/api/test', { signal: controller.signal }))
    await bodyStarted(mock)
    const remove = vi.spyOn(mock.signal(), 'removeEventListener')
    controller.abort()
    expect(await result).toMatchObject({ error: { code: 'NETWORK_ERROR', status: 0 }})
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
    expect(unauthorized).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0)
  })
  it.each(['factory', 'revocation', 'login'] as const)('rejects a late body after %s change', async change => {
    const mock = pendingBody(401, 'json')
    const result = capture(request('/api/test'))
    await bodyStarted(mock)
    if (change === 'factory') factoryId = 'B'
    if (change === 'revocation') revision++
    if (change === 'login') token = 'NEW TEST TOKEN'
    mock.finish({ errorCode: 'UNAUTHENTICATED' })
    expect(await result).toMatchObject({ error: { code: 'CONTEXT_CHANGED' }})
    expect(unauthorized).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0)
  })
  it('does not let a stale dedicated 422 trigger factory recovery', async() => {
    const mock = pendingBody(422, 'json')
    const result = capture(request('/api/test'))
    await bodyStarted(mock); revision++
    mock.finish({ errorCode: 'FACTORY_SELECTION_REQUIRED' })
    expect(await result).toMatchObject({ error: { code: 'CONTEXT_CHANGED' }})
    expect(recoverFactory).not.toHaveBeenCalled()
  })
  it('does not dispatch identity callbacks when cancellation races with body completion', async() => {
    const mock = pendingBody(401, 'json')
    const caller = new AbortController()
    const result = capture(request('/api/test', { signal: caller.signal }))
    await bodyStarted(mock)
    mock.finish({ errorCode: 'UNAUTHENTICATED' }); caller.abort()
    expect(await result).toMatchObject({ error: { code: 'NETWORK_ERROR', status: 0 }})
    expect(unauthorized).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('aborts a real response reader after partial JSON bytes stall', async() => {
    let signal!: AbortSignal
    vi.stubGlobal('fetch', vi.fn(async(_path, options: RequestInit) => {
      signal = options.signal!
      return new Response(new ReadableStream({ start(controller) {
        signal.addEventListener('abort', () => controller.error(new DOMException('cancelled', 'AbortError')), { once: true })
        controller.enqueue(new TextEncoder().encode('{"partial":'))
      } }), { headers: { 'X-Request-Id': 'TEST-PARTIAL' }})
    }))
    const result = capture(request('/api/test', { timeoutMs: 1000 }))
    await vi.advanceTimersByTimeAsync(1000)
    expect(await result).toMatchObject({ error: { code: 'NETWORK_ERROR', status: 0, requestId: 'TEST-PARTIAL' }})
    expect(signal.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })
  it('does not replace stream lifetime with an ordinary body deadline', async() => {
    let signal!: AbortSignal
    vi.stubGlobal('fetch', vi.fn(async(_path, options: RequestInit) => {
      signal = options.signal!
      return new Response(new ReadableStream({ start(controller) {
        signal.addEventListener('abort', () => controller.error(new DOMException('cancelled', 'AbortError')), { once: true })
        controller.enqueue(new TextEncoder().encode('data: TEST ONLY\n\n'))
      } }))
    }))
    const caller = new AbortController()
    const response = await requestStream('/api/test', { timeoutMs: 1000, signal: caller.signal })
    const reader = response.body!.getReader()
    await expect(reader.read()).resolves.toMatchObject({ done: false })
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(2000)
    expect(signal.aborted).toBe(false)
    const result = capture(reader.read()); caller.abort()
    expect(await result).toMatchObject({ error: { name: 'AbortError' }})
  })
})
