// MES-CODEGEN: API 与生成的 Controller 使用同一请求契约。
import { request } from '@/lib/request'

export interface WorkshopVo {
  [key: string]: unknown;
  id: string;
  factoryId: string;
  code: string;
  name: string;
  status: string;
  remark: string | null;
}

export interface Page {
  items: WorkshopVo[];
  total: number;
  offset: number;
  limit: number;
}

export type CreateCommand = Pick<WorkshopVo, 'code' | 'name' | 'status' | 'remark'>
export type UpdateCommand = Pick<WorkshopVo, 'code' | 'name' | 'status' | 'remark'>

const removeIds = (ids: string[]) =>
  request<void>('/api/basic/workshop', { method: 'DELETE', body: ids, scope: 'factory' })

export const api = {
  list: (query: Record<string, string | number>) =>
    request<Page>('/api/basic/workshop', { query, scope: 'factory' }),

  detail: (id: string) =>
    request<WorkshopVo>('/api/basic/workshop/' + encodeURIComponent(id), { scope: 'factory' }),

  create: (body: unknown) =>
    request<WorkshopVo>('/api/basic/workshop', { method: 'POST', body, scope: 'factory' }),

  update: (id: string, body: unknown) =>
    request<WorkshopVo>('/api/basic/workshop/' + encodeURIComponent(id), {
      method: 'PUT', body, scope: 'factory'
    }),

  remove: (id: string) => removeIds([id]),

  delids: removeIds
}

export interface SyncResult { fetched: number; created: number; updated: number; skipped: number }
export const sync = () => request<SyncResult>('/api/basic/workshop/actions/sync', { method: 'POST', scope: 'factory' })
