// MES-CODEGEN: RuoYi API module pattern adapted to typed Base contracts.
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
  request<void>('/api/material/workshop', { method: 'DELETE', body: ids, scope: 'factory' })

export const api = {
  list: (query: Record<string, string | number>) =>
    request<Page>('/api/material/workshop', { query, scope: 'factory' }),

  detail: (id: string) =>
    request<WorkshopVo>('/api/material/workshop/' + encodeURIComponent(id), { scope: 'factory' }),

  create: (body: unknown) =>
    request<WorkshopVo>('/api/material/workshop', { method: 'POST', body, scope: 'factory' }),

  update: (id: string, body: unknown) =>
    request<WorkshopVo>('/api/material/workshop/' + encodeURIComponent(id), {
      method: 'PUT', body, scope: 'factory'
    }),

  remove: (id: string) => removeIds([id]),

  delids: removeIds
}

export interface SyncResult { fetched: number; created: number; updated: number; skipped: number }
export const sync = () => request<SyncResult>('/api/material/workshop/actions/sync', { method: 'POST', scope: 'factory' })
