// MES-CODEGEN: RuoYi API module pattern adapted to typed Base contracts.
import { request } from '@/lib/request'

export interface MaterialCategoryVo {
  [key: string]: unknown;
  id: string;
  factoryId: string;
  code: string;
  name: string;
  parentId: string | null;
  sort: number;
  status: string;
  remark: string | null;
}

export interface Page {
  items: MaterialCategoryVo[];
  total: number;
  offset: number;
  limit: number;
}

export type CreateCommand = Pick<MaterialCategoryVo, 'code' | 'name' | 'parentId' | 'sort' | 'status' | 'remark'>
export type UpdateCommand = Pick<MaterialCategoryVo, 'code' | 'name' | 'parentId' | 'sort' | 'status' | 'remark'>

const removeIds = (ids: string[]) =>
  request<void>('/api/material/material-category', { method: 'DELETE', body: ids, scope: 'factory' })

export const api = {
  list: (query: Record<string, string | number>) =>
    request<Page>('/api/material/material-category', { query, scope: 'factory' }),

  detail: (id: string) =>
    request<MaterialCategoryVo>('/api/material/material-category/' + encodeURIComponent(id), { scope: 'factory' }),

  create: (body: unknown) =>
    request<MaterialCategoryVo>('/api/material/material-category', { method: 'POST', body, scope: 'factory' }),

  update: (id: string, body: unknown) =>
    request<MaterialCategoryVo>('/api/material/material-category/' + encodeURIComponent(id), {
      method: 'PUT', body, scope: 'factory'
    }),

  remove: (id: string) => removeIds([id]),

  delids: removeIds
}

export interface SyncResult { fetched: number; created: number; updated: number; skipped: number }
export const sync = () => request<SyncResult>('/api/material/material-category/actions/sync', { method: 'POST', scope: 'factory' })
