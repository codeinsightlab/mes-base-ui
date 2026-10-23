import { request } from '@/lib/request'

export interface MaterialVo {
  [key: string]: unknown;
  id: string;

  code: string;
  name: string;
  specification: string | null;
  categoryId: string | null;
  unitId: string;
  status: string;
  externalId: string | null;
  externalCode: string | null;
}

export interface Page {
  items: MaterialVo[];
  total: number;
  offset: number;
  limit: number;
}

export type CreateCommand = Pick<MaterialVo, 'code' | 'name' | 'specification' | 'categoryId' | 'unitId' | 'status' | 'externalId' | 'externalCode'>
export type UpdateCommand = Pick<MaterialVo, 'code' | 'name' | 'specification' | 'categoryId' | 'unitId' | 'status' | 'externalId' | 'externalCode'>

const removeIds = (ids: string[]) =>
  request<void>('/api/basic/material', { method: 'DELETE', body: ids, scope: 'factory' })

export const api = {
  list: (query: Record<string, string | number>) =>
    request<Page>('/api/basic/material', { query, scope: 'factory' }),

  detail: (id: string) =>
    request<MaterialVo>('/api/basic/material/' + encodeURIComponent(id), { scope: 'factory' }),

  create: (body: unknown) =>
    request<MaterialVo>('/api/basic/material', { method: 'POST', body, scope: 'factory' }),

  update: (id: string, body: unknown) =>
    request<MaterialVo>('/api/basic/material/' + encodeURIComponent(id), {
      method: 'PUT', body, scope: 'factory'
    }),

  remove: (id: string) => removeIds([id]),

  delids: removeIds
}

export interface SyncResult { fetched: number; created: number; updated: number; skipped: number }
export const sync = () => request<SyncResult>('/api/basic/material/actions/sync', { method: 'POST', scope: 'factory' })
