import { request } from '@/lib/request'

export interface UnitMeasureVo {
  [key: string]: unknown;
  id: string;

  code: string;
  name: string;
  symbol: string | null;
  status: string;
  mustBeWholeNumber: number;
  quantityPrecision: number;
}

export interface Page {
  items: UnitMeasureVo[];
  total: number;
  offset: number;
  limit: number;
}

export type CreateCommand = Pick<UnitMeasureVo, 'code' | 'name' | 'symbol' | 'status' | 'mustBeWholeNumber' | 'quantityPrecision'>
export type UpdateCommand = Pick<UnitMeasureVo, 'code' | 'name' | 'symbol' | 'status' | 'mustBeWholeNumber' | 'quantityPrecision'>

const removeIds = (ids: string[]) =>
  request<void>('/api/basic/unit-measure', { method: 'DELETE', body: ids, scope: 'factory' })

export const api = {
  list: (query: Record<string, string | number>) =>
    request<Page>('/api/basic/unit-measure', { query, scope: 'factory' }),

  detail: (id: string) =>
    request<UnitMeasureVo>('/api/basic/unit-measure/' + encodeURIComponent(id), { scope: 'factory' }),

  create: (body: unknown) =>
    request<UnitMeasureVo>('/api/basic/unit-measure', { method: 'POST', body, scope: 'factory' }),

  update: (id: string, body: unknown) =>
    request<UnitMeasureVo>('/api/basic/unit-measure/' + encodeURIComponent(id), {
      method: 'PUT', body, scope: 'factory'
    }),

  remove: (id: string) => removeIds([id]),

  delids: removeIds
}

export interface SyncResult { fetched: number; created: number; updated: number; skipped: number }
export const sync = () => request<SyncResult>('/api/basic/unit-measure/actions/sync', { method: 'POST', scope: 'factory' })
