import { request } from '@/lib/request'

export interface MesMaterialIssueVo {
  [key: string]: unknown;
  id: string;

  issueNo: string;
  executionId: string | null;
  workorderId: string | null;
  workorderCode: string | null;
  productId: string | null;
  productCode: string | null;
  flowCardNo: string | null;
  routingId: string | null;
  issueTime: string | null;
  status: string;
  remark: string | null;
  createBy: string | null;
  createTime: string | null;
  updateBy: string | null;
  updateTime: string | null;
}

export interface Page {
  items: MesMaterialIssueVo[];
  total: number;
  offset: number;
  limit: number;
}

export type CreateCommand = Pick<MesMaterialIssueVo, 'executionId' | 'issueNo' | 'workorderId' | 'workorderCode' | 'productId' | 'productCode' | 'flowCardNo' | 'routingId' | 'issueTime' | 'status' | 'remark'>
export type UpdateCommand = Pick<MesMaterialIssueVo, 'executionId' | 'issueNo' | 'workorderId' | 'workorderCode' | 'productId' | 'productCode' | 'flowCardNo' | 'routingId' | 'issueTime' | 'status' | 'remark'>

const removeIds = (ids: string[]) =>
  request<void>('/api/issue/mes-material-issue', { method: 'DELETE', body: ids, scope: 'factory' })

export const api = {
  list: (query: Record<string, string | number>) =>
    request<Page>('/api/issue/mes-material-issue', { query, scope: 'factory' }),

  detail: (id: string) =>
    request<MesMaterialIssueVo>('/api/issue/mes-material-issue/' + encodeURIComponent(id), { scope: 'factory' }),

  create: (body: unknown) =>
    request<MesMaterialIssueVo>('/api/issue/mes-material-issue', { method: 'POST', body, scope: 'factory' }),

  update: (id: string, body: unknown) =>
    request<MesMaterialIssueVo>('/api/issue/mes-material-issue/' + encodeURIComponent(id), {
      method: 'PUT', body, scope: 'factory'
    }),

  remove: (id: string) => removeIds([id]),

  delids: removeIds
}


export const voidMaterialIssue = (id: string, reconcile = false) => request<MesMaterialIssueVo>(
  '/api/issue/mes-material-issue/' + encodeURIComponent(id) + '/actions/' + (reconcile ? 'reconcile-void' : 'void'),
  { method: 'POST', scope: 'factory' }
)

export interface ErpIssueQueryView {
  mesStatus: string
  result: { outcome: 'FOUND' | 'NOT_FOUND' | 'UNKNOWN'; documentStatus: string; executionMode: 'LOCAL_ONLY' | 'CONNECTED'; externalId: string | null; externalCode: string | null; message: string }
  provider: string | null
  lastOutcome: string | null
  lastMessage: string | null
  checkedAt: string | null
}
export const queryIssueErp = (id: string) => request<ErpIssueQueryView>(
  '/api/issue/mes-material-issue/' + encodeURIComponent(id) + '/erp-status', { scope: 'factory' }
)
export const reconcileIssueErp = (id: string) => request<ErpIssueQueryView>(
  '/api/issue/mes-material-issue/' + encodeURIComponent(id) + '/actions/reconcile-erp', { method: 'POST', scope: 'factory' }
)
