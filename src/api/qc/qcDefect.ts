// MES-CODEGEN: API 与生成的 Controller 使用同一请求契约。
import { request } from '@/lib/request'

export interface QcDefectVo {
  [key: string]: unknown;
  defectId: string;
  factoryId: string;
  defectCode: string;
  defectName: string;
  indexType: string;
  defectLevel: string;
  remark: string | null;
  createBy: string | null;
  createTime: string | null;
  updateBy: string | null;
  updateTime: string | null;
}

export interface Page {
  items: QcDefectVo[];
  total: number;
  offset: number;
  limit: number;
}

export type CreateCommand = Pick<QcDefectVo, 'factoryId' | 'defectCode' | 'defectName' | 'indexType' | 'defectLevel' | 'remark'>
export type UpdateCommand = Pick<QcDefectVo, 'factoryId' | 'defectCode' | 'defectName' | 'indexType' | 'defectLevel' | 'remark'>

const removeIds = (ids: string[]) =>
  request<void>('/api/qc/qc-defect', { method: 'DELETE', body: ids, scope: 'factory' })

export const api = {
  list: (query: Record<string, string | number>) =>
    request<Page>('/api/qc/qc-defect', { query, scope: 'factory' }),

  detail: (id: string) =>
    request<QcDefectVo>('/api/qc/qc-defect/' + encodeURIComponent(id), { scope: 'factory' }),

  create: (body: unknown) =>
    request<QcDefectVo>('/api/qc/qc-defect', { method: 'POST', body, scope: 'factory' }),

  update: (id: string, body: unknown) =>
    request<QcDefectVo>('/api/qc/qc-defect/' + encodeURIComponent(id), {
      method: 'PUT', body, scope: 'factory'
    }),

  remove: (id: string) => removeIds([id]),

  delids: removeIds
}

export interface SyncResult { fetched: number; created: number; updated: number; skipped: number }
export const sync = () => request<SyncResult>('/api/qc/qc-defect/actions/sync', { method: 'POST', scope: 'factory' })
