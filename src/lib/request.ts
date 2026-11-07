export type PermissionScope = 'platform' | 'factory'
export interface RequestContext { token: string; factoryId: string; revision: number }
let context: () => RequestContext = () => ({ token: '', factoryId: '', revision: 0 })
function assertCurrent(snapshot: RequestContext) {
  const current = context()
  if (snapshot.revision !== current.revision || snapshot.token !== current.token || snapshot.factoryId !== current.factoryId) {
    throw new ApiError('CONTEXT_CHANGED', '上下文已切换，请重新加载')
  }
}
let unauthenticated: () => void = () => {}
let factorySelectionRequired: () => void = () => {}
const factoryReads = new Set<AbortController>()
export function cancelFactoryReads() {
  for (const controller of factoryReads) controller.abort()
  factoryReads.clear()
}
export function configureRequests(provider: () => RequestContext, on401: () => void, onFactorySelection: () => void = () => {}) {
  context = provider
  unauthenticated = on401
  factorySelectionRequired = onFactorySelection
}
export class ApiError extends Error { constructor(public code: string, message: string, public requestId = '', public status = 0, public maximumQty?: string) { super(message) } }
export interface RequestOptions { timeoutMs?: number; signal?: AbortSignal; method?: string; body?: unknown; query?: Record<string, string | number>; scope?: PermissionScope; public?: boolean; parseResponse?: (text: string) => unknown }
async function send<T>(path: string, options: RequestOptions, consume: (response: Response, read: <R>(operation: () => Promise<R>) => Promise<R>) => Promise<T>): Promise<T> {
  if (!path.startsWith('/api/') && path !== '/health') throw new ApiError('INVALID_PATH', '请求路径无效')
  const snapshot = { ...context() }; const headers = new Headers()
  if (!options.public && snapshot.token) headers.set('Authorization', 'Bearer ' + snapshot.token)
  if (snapshot.factoryId) headers.set('X-Factory-Id', snapshot.factoryId)
  const parameters = new URLSearchParams(Object.entries(options.query ?? {}).map(([k, v]) => [k, String(v)])).toString()
  const query = parameters ? '?' + parameters : ''
  const multipart = options.body instanceof FormData
  if (options.body !== undefined && !multipart) headers.set('Content-Type', 'application/json')
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), Math.min(120000, Math.max(1000, options.timeoutMs ?? 15000)))
  if (options.scope === 'factory' && (options.method ?? 'GET').toUpperCase() === 'GET') factoryReads.add(controller)
  const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal
  let response: Response | undefined
  const read = async <R>(operation: () => Promise<R>): Promise<R> => {
    const networkError = () => new ApiError('NETWORK_ERROR', '连接失败或超时，请重试', response?.headers.get('X-Request-Id') ?? '')
    try {
      const value = await new Promise<R>((resolve, reject) => {
        const cleanup = () => signal.removeEventListener('abort', abort)
        const abort = () => { cleanup(); reject(networkError()) }
        if (signal.aborted) { abort(); return }
        signal.addEventListener('abort', abort, { once: true })
        Promise.resolve().then(() => { signal.throwIfAborted(); return operation() }).then(
          value => { cleanup(); resolve(value) },
          error => { cleanup(); reject(error) }
        )
      })
      assertCurrent(snapshot)
      if (signal.aborted) throw networkError()
      return value
    } catch(error) {
      assertCurrent(snapshot)
      if (error instanceof ApiError && error.code === 'CONTEXT_CHANGED') throw error
      if (error instanceof SyntaxError) throw error
      throw networkError()
    }
  }
  try {
    response = await read(() => fetch(path + query, { method: options.method ?? 'GET', headers, body: options.body === undefined ? undefined : multipart ? options.body as FormData : JSON.stringify(options.body), signal, credentials: 'same-origin' }))
    assertCurrent(snapshot)
    if (!response.ok) {
      let error: { errorCode?: string; message?: string; requestId?: string; maximumQty?: string } = {}
      try { error = await read(() => response!.json()) } catch(failure) { if (!(failure instanceof SyntaxError)) throw failure }
      assertCurrent(snapshot)
      if (response.status === 401 && !options.public) unauthenticated()
      if (response.status === 422 && error.errorCode === 'FACTORY_SELECTION_REQUIRED' && !options.public) factorySelectionRequired()
      const messages: Record<number, string> = {
        400: '请求参数无效，请检查必填项、格式及取值范围',
        401: '登录状态无效或已过期，请重新登录',
        403: '当前账号没有执行此操作的权限',
        404: '未找到请求的数据，请确认记录是否存在或已被删除',
        409: '数据已变化或与当前状态冲突，请刷新后重新确认',
        422: '请求内容不符合当前业务条件，请检查输入或数据状态'
      }
      const serverMessage = typeof error.message === 'string' && error.message.trim() ? error.message.trim() : undefined
      throw new ApiError(error.errorCode ?? 'HTTP_ERROR', serverMessage ?? messages[response.status] ?? '服务暂时不可用，请稍后重试', error.requestId ?? response.headers.get('X-Request-Id') ?? '', response.status, error.maximumQty)
    }
    const result = await consume(response, read)
    assertCurrent(snapshot)
    return result
  } finally { clearTimeout(timer); factoryReads.delete(controller) }
}
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return send(path, options, async(response, read) => {
    if (response.status === 204 || response.headers.get('content-length') === '0') return undefined as T
    const text = await read(() => response.text())
    if (!text) return undefined as T
    try { return (options.parseResponse ? options.parseResponse(text) : JSON.parse(text)) as T } catch { throw new ApiError('INVALID_RESPONSE', '服务响应格式无效', response.headers.get('X-Request-Id') ?? '', response.status) }
  })
}
export async function requestBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  return send(path, options, (response, read) => read(() => response.blob()))
}

/** Successful streams keep caller cancellation, without a whole-body deadline. Error bodies remain bounded. */
export async function requestStream(path: string, options: RequestOptions = {}): Promise<Response> {
  return send(path, options, async response => response)
}
