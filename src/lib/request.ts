export type PermissionScope = 'platform' | 'factory'
export interface RequestContext { token: string; factoryId: string; revision: number }
let context: () => RequestContext = () => ({ token: '', factoryId: '', revision: 0 })
const responseContexts = new WeakMap<Response, RequestContext>()
function assertCurrent(snapshot: RequestContext) {
  const current = context()
  if (snapshot.revision !== current.revision || snapshot.token !== current.token || snapshot.factoryId !== current.factoryId) {
    throw new ApiError('CONTEXT_CHANGED', '上下文已切换，请重新加载')
  }
}
let unauthenticated: () => void = () => {}
export function configureRequests(provider: () => RequestContext, on401: () => void) { context = provider; unauthenticated = on401 }
export class ApiError extends Error { constructor(public code: string, message: string, public requestId = '', public status = 0) { super(message) } }
export interface RequestOptions { method?: string; body?: unknown; query?: Record<string, string | number>; scope?: PermissionScope; public?: boolean }
async function send(path: string, options: RequestOptions = {}): Promise<Response> {
  if (!path.startsWith('/api/') && path !== '/health') throw new ApiError('INVALID_PATH', '请求路径无效')
  const snapshot = { ...context() }; const headers = new Headers()
  if (!options.public && snapshot.token) headers.set('Authorization', 'Bearer ' + snapshot.token)
  if (snapshot.factoryId) headers.set('X-Factory-Id', snapshot.factoryId)
  const query = options.query ? '?' + new URLSearchParams(Object.entries(options.query).map(([k, v]) => [k, String(v)])).toString() : ''
  const multipart = options.body instanceof FormData
  if (options.body !== undefined && !multipart) headers.set('Content-Type', 'application/json')
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 15000)
  let response: Response
  try { response = await fetch(path + query, { method: options.method ?? 'GET', headers, body: options.body === undefined ? undefined : multipart ? options.body as FormData : JSON.stringify(options.body), signal: controller.signal, credentials: 'same-origin' }) } catch { throw new ApiError('NETWORK_ERROR', '连接失败或超时，请重试') } finally { clearTimeout(timer) }
  assertCurrent(snapshot)
  if (!response.ok) {
    let error: { errorCode?: string; message?: string; requestId?: string } = {}
    try { error = await response.json() } catch { /* Non-JSON upstream error is a transport failure, never success. */ }
    assertCurrent(snapshot)
    if (response.status === 401 && !options.public) unauthenticated()
    const messages: Record<number, string> = { 400: '输入不符合要求，请检查字段', 401: '登录已失效，请重新登录', 403: '当前范围没有此操作权限', 404: '资源不存在或不在当前范围', 409: '数据冲突，请刷新后重试', 422: '当前操作不可执行' }
    throw new ApiError(error.errorCode ?? 'HTTP_ERROR', (error.errorCode === 'SESSION_REVOCATION_PENDING' ? '账号变更已保存，会话撤销正在重试；请勿重复提交' : error.errorCode === 'BUSINESS_REJECTED' ? error.message : undefined) ?? messages[response.status] ?? '服务暂时不可用，请稍后重试', error.requestId ?? response.headers.get('X-Request-Id') ?? '', response.status)
  }
  responseContexts.set(response, snapshot)
  return response
}
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(path, options)
  if (response.status === 204 || response.headers.get('content-length') === '0') return undefined as T
  const text = await response.text(); assertCurrent(responseContexts.get(response)!); if (!text) return undefined as T;try { return JSON.parse(text) as T } catch { throw new ApiError('INVALID_RESPONSE', '服务响应格式无效', response.headers.get('X-Request-Id') ?? '', response.status) }
}
export async function requestBlob(path:string, options:RequestOptions = {}):Promise<Blob> { const response = await send(path, options); const blob = await response.blob(); assertCurrent(responseContexts.get(response)!); return blob }
