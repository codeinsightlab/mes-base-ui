import { request } from '@/lib/request'

export interface WmWarehouseVo {
  [key: string]: unknown;
  id: string;

  code: string;
  name: string;
  status: string;
  remark: string | null;
  createBy: string | null;
  createTime: string | null;
  updateBy: string | null;
  updateTime: string | null;
}

export interface Page {
  items: WmWarehouseVo[];
  total: number;
  offset: number;
  limit: number;
}

export type CreateCommand = Pick<WmWarehouseVo, 'code' | 'name' | 'status' | 'remark'>
export type UpdateCommand = Pick<WmWarehouseVo, 'code' | 'name' | 'status' | 'remark'>

const removeIds = (ids: string[]) =>
  request<void>('/api/wm/wm-warehouse', { method: 'DELETE', body: ids, scope: 'factory' })

export const api = {
  list: (query: Record<string, string | number>) =>
    request<Page>('/api/wm/wm-warehouse', { query, scope: 'factory' }),

  detail: (id: string) =>
    request<WmWarehouseVo>('/api/wm/wm-warehouse/' + encodeURIComponent(id), { scope: 'factory' }),

  create: (body: unknown) =>
    request<WmWarehouseVo>('/api/wm/wm-warehouse', { method: 'POST', body, scope: 'factory' }),

  update: (id: string, body: unknown) =>
    request<WmWarehouseVo>('/api/wm/wm-warehouse/' + encodeURIComponent(id), {
      method: 'PUT', body, scope: 'factory'
    }),

  remove: (id: string) => removeIds([id]),

  delids: removeIds
}

export interface SyncResult { fetched: number; created: number; updated: number; skipped: number }
export const sync = () => request<SyncResult>('/api/wm/wm-warehouse/actions/sync', { method: 'POST', scope: 'factory' })
