// MES-CODEGEN: RuoYi API module pattern adapted to typed Base contracts.
import { request } from '@/lib/request'

export interface SafetyStockVo {
  [key: string]: unknown;
  id: string;
  factoryId: string;
  materialId: string;
  minQty: string;
  maxQty: string | null;
  status: string;
}

export interface Page {
  items: SafetyStockVo[];
  total: number;
  offset: number;
  limit: number;
}

export type CreateCommand = Pick<SafetyStockVo, 'materialId' | 'minQty' | 'maxQty' | 'status'>
export type UpdateCommand = Pick<SafetyStockVo, 'materialId' | 'minQty' | 'maxQty' | 'status'>

const removeIds = (ids: string[]) =>
  request<void>('/api/material/safety-stock', { method: 'DELETE', body: ids, scope: 'factory' })

export const api = {
  list: (query: Record<string, string | number>) =>
    request<Page>('/api/material/safety-stock', { query, scope: 'factory' }),

  detail: (id: string) =>
    request<SafetyStockVo>('/api/material/safety-stock/' + encodeURIComponent(id), { scope: 'factory' }),

  create: (body: unknown) =>
    request<SafetyStockVo>('/api/material/safety-stock', { method: 'POST', body, scope: 'factory' }),

  update: (id: string, body: unknown) =>
    request<SafetyStockVo>('/api/material/safety-stock/' + encodeURIComponent(id), {
      method: 'PUT', body, scope: 'factory'
    }),

  remove: (id: string) => removeIds([id]),

  delids: removeIds
}

export interface SyncResult { fetched: number; created: number; updated: number; skipped: number }
export const sync = () => request<SyncResult>('/api/material/safety-stock/actions/sync', { method: 'POST', scope: 'factory' })
