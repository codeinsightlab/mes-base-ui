// MES-CODEGEN: API 与生成的 Controller 使用同一请求契约。
import { request } from '@/lib/request'

export interface PurchaseSupplierVo {
  [key: string]: unknown;
  id: string;
  code: string;
  name: string;
  contactPerson: string | null;
  contactPhone: string | null;
  address: string | null;
  status: string;
  remark: string | null;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}

export interface Page {
  items: PurchaseSupplierVo[];
  total: number;
  offset: number;
  limit: number;
}

export type CreateCommand = Pick<PurchaseSupplierVo, 'code' | 'name' | 'contactPerson' | 'contactPhone' | 'address' | 'status' | 'remark'>
export type UpdateCommand = Pick<PurchaseSupplierVo, 'code' | 'name' | 'contactPerson' | 'contactPhone' | 'address' | 'status' | 'remark'>

const removeIds = (ids: string[]) =>
  request<void>('/api/purchase/purchase-supplier', { method: 'DELETE', body: ids, scope: 'factory' })

export const api = {
  list: (query: Record<string, string | number>) =>
    request<Page>('/api/purchase/purchase-supplier', { query, scope: 'factory' }),

  detail: (id: string) =>
    request<PurchaseSupplierVo>('/api/purchase/purchase-supplier/' + encodeURIComponent(id), { scope: 'factory' }),

  create: (body: unknown) =>
    request<PurchaseSupplierVo>('/api/purchase/purchase-supplier', { method: 'POST', body, scope: 'factory' }),

  update: (id: string, body: unknown) =>
    request<PurchaseSupplierVo>('/api/purchase/purchase-supplier/' + encodeURIComponent(id), {
      method: 'PUT', body, scope: 'factory'
    }),

  remove: (id: string) => removeIds([id]),

  delids: removeIds
}
