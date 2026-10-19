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
let factorySelectionRequired: () => void = () => {}
export function configureRequests(provider: () => RequestContext, on401: () => void, onFactorySelection: () => void = () => {}) {
  context = provider
  unauthenticated = on401
  factorySelectionRequired = onFactorySelection
}
export class ApiError extends Error { constructor(public code: string, message: string, public requestId = '', public status = 0) { super(message) } }
export interface RequestOptions { timeoutMs?: number; signal?: AbortSignal; method?: string; body?: unknown; query?: Record<string, string | number>; scope?: PermissionScope; public?: boolean; parseResponse?: (text: string) => unknown }
async function send(path: string, options: RequestOptions = {}): Promise<Response> {
  if (!path.startsWith('/api/') && path !== '/health') throw new ApiError('INVALID_PATH', '请求路径无效')
  const snapshot = { ...context() }; const headers = new Headers()
  if (!options.public && snapshot.token) headers.set('Authorization', 'Bearer ' + snapshot.token)
  if (snapshot.factoryId) headers.set('X-Factory-Id', snapshot.factoryId)
  const query = options.query ? '?' + new URLSearchParams(Object.entries(options.query).map(([k, v]) => [k, String(v)])).toString() : ''
  const multipart = options.body instanceof FormData
  if (options.body !== undefined && !multipart) headers.set('Content-Type', 'application/json')
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), Math.min(120000, Math.max(1000, options.timeoutMs ?? 15000)))
  let response: Response
  try { response = await fetch(path + query, { method: options.method ?? 'GET', headers, body: options.body === undefined ? undefined : multipart ? options.body as FormData : JSON.stringify(options.body), signal: options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal, credentials: 'same-origin' }) } catch { throw new ApiError('NETWORK_ERROR', '连接失败或超时，请重试') } finally { clearTimeout(timer) }
  assertCurrent(snapshot)
  if (!response.ok) {
    let error: { errorCode?: string; message?: string; requestId?: string } = {}
    try { error = await response.json() } catch { /* Non-JSON upstream error is a transport failure, never success. */ }
    assertCurrent(snapshot)
    if (response.status === 401 && !options.public) unauthenticated()
    if (response.status === 422 && error.errorCode === 'FACTORY_SELECTION_REQUIRED' && !options.public) factorySelectionRequired()
    const businessMessages: Record<string, string> = {
      WORKORDER_INVALID: '工单、批次数量、工艺引用或完整路径不符合规则',
      BATCH_ROUTE_FROZEN: '路径已锁定、正在出库或待核实，禁止更改',
      STOCK_KEY_DUPLICATE: '当前工厂已有相同仓库编码或物料仓库库存记录',
      STOCK_REFERENCE_INVALID: '物料和仓库必须存在且属于当前工厂',
      WAREHOUSE_REFERENCED: '仓库已被库存引用，不能删除',
      MATERIAL_INVENTORY_REFERENCED: '物料已被库存引用，不能删除',
      SYNC_QUERY_NOT_IMPLEMENTED: '暂未接入外部同步查询接口',
      SYNC_RUNNING: '同步正在进行，请稍后重试',
      SYNC_EXECUTION_LOST: '同步执行权已失效，请重新发起',
      ROUTING_FROZEN: '已发布路线内容已冻结，请创建新版本',
      ROUTING_REVISION_CONFLICT: '记录已被修改，请刷新后重试',
      ROUTING_REFERENCE_INVALID: '请选择当前工厂启用的物料产品和工序',
      ROUTING_GRAPH_INVALID: '路线拓扑无效，请检查节点、连接、环路及孤立节点',
      ROUTING_PUBLISH_INCOMPLETE: '发布前请至少关联一个物料产品和一个工序步骤',
      OPERATION_REFERENCED: '工序已被工艺路线引用，不能删除',
      MATERIAL_ROUTING_REFERENCED: '物料产品已被工艺路线引用，不能删除',
      ERP_OPERATION_NOT_CONFIGURED: '暂未配置工序 ERP 同步数据来源',
      ERP_ROUTING_NOT_CONFIGURED: '暂未配置工艺路线 ERP 同步数据来源'
    }
    const messages: Record<number, string> = { 400: '输入不符合要求，请检查字段', 401: '登录已失效，请重新登录', 403: '当前范围没有此操作权限', 404: '资源不存在或不在当前范围', 409: '数据冲突，请刷新后重试', 422: '当前操作不可执行' }
    throw new ApiError(error.errorCode ?? 'HTTP_ERROR', businessMessages[error.errorCode ?? ''] ?? (error.errorCode === 'FACTORY_SELECTION_REQUIRED' ? '当前工厂不可用，请重新选择工厂' : error.errorCode === 'SESSION_REVOCATION_PENDING' ? '账号变更已保存，会话撤销正在重试；请勿重复提交' : error.errorCode === 'ERP_SYNC_NOT_CONFIGURED' ? '暂未配置 ERP 同步数据来源' : (error.errorCode === 'BUSINESS_REJECTED' || error.errorCode === 'PRODUCTION_CLOSURE_BLOCKED') ? error.message : undefined) ?? messages[response.status] ?? '服务暂时不可用，请稍后重试', error.requestId ?? response.headers.get('X-Request-Id') ?? '', response.status)
  }
  responseContexts.set(response, snapshot)
  return response
}
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(path, options)
  if (response.status === 204 || response.headers.get('content-length') === '0') return undefined as T
  const text = await response.text(); assertCurrent(responseContexts.get(response)!); if (!text) return undefined as T;try { return (options.parseResponse ? options.parseResponse(text) : JSON.parse(text)) as T } catch { throw new ApiError('INVALID_RESPONSE', '服务响应格式无效', response.headers.get('X-Request-Id') ?? '', response.status) }
}
export async function requestBlob(path:string, options:RequestOptions = {}):Promise<Blob> { const response = await send(path, options); const blob = await response.blob(); assertCurrent(responseContexts.get(response)!); return blob }

/** Streaming responses share authentication and stale-context guards with ordinary requests. */
export async function requestStream(path: string, options: RequestOptions = {}): Promise<Response> { return send(path, options) }
