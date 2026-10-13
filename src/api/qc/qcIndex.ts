// MES-CODEGEN: API 与生成的 Controller 使用同一请求契约。
import { request } from '@/lib/request'

export interface QcIndexVo {
  [key: string]: unknown;
  indexId: string;
  factoryId: string;
  indexCode: string;
  indexName: string;
  indexType: string;
  qcTool: string | null;
  remark: string | null;
  createBy: string | null;
  createTime: string | null;
  updateBy: string | null;
  updateTime: string | null;
}

export interface Page {
  items: QcIndexVo[];
  total: number;
  offset: number;
  limit: number;
}

export type CreateCommand = Pick<QcIndexVo, 'factoryId' | 'indexCode' | 'indexName' | 'indexType' | 'qcTool' | 'remark'>
export type UpdateCommand = Pick<QcIndexVo, 'factoryId' | 'indexCode' | 'indexName' | 'indexType' | 'qcTool' | 'remark'>

const removeIds = (ids: string[]) =>
  request<void>('/api/qc/qc-index', { method: 'DELETE', body: ids, scope: 'factory' })

export const api = {
  list: (query: Record<string, string | number>) =>
    request<Page>('/api/qc/qc-index', { query, scope: 'factory' }),

  detail: (id: string) =>
    request<QcIndexVo>('/api/qc/qc-index/' + encodeURIComponent(id), { scope: 'factory' }),

  create: (body: unknown) =>
    request<QcIndexVo>('/api/qc/qc-index', { method: 'POST', body, scope: 'factory' }),

  update: (id: string, body: unknown) =>
    request<QcIndexVo>('/api/qc/qc-index/' + encodeURIComponent(id), {
      method: 'PUT', body, scope: 'factory'
    }),

  remove: (id: string) => removeIds([id]),

  delids: removeIds
}

export interface SyncResult { fetched: number; created: number; updated: number; skipped: number }
export const sync = () => request<SyncResult>('/api/qc/qc-index/actions/sync', { method: 'POST', scope: 'factory' })
