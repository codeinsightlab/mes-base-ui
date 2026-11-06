import { request } from '@/lib/request'

export interface PurchaseReferencePriceVo {
  [key: string]: unknown;
  id: string;
  supplierId: string;
  materialId: string;
  unitId: string;
  unitPrice: string;
  currency: string;
  effectiveDate: string;
  createdBy: string;
  createdAt: string;
  remark: string | null;
}

export interface Page {
  items: PurchaseReferencePriceVo[];
  total: number;
  offset: number;
  limit: number;
}

export type CreateCommand = Pick<PurchaseReferencePriceVo, 'supplierId' | 'materialId' | 'unitId' | 'unitPrice' | 'currency' | 'effectiveDate' | 'remark'>
export type UpdateCommand = Pick<PurchaseReferencePriceVo, 'supplierId' | 'materialId' | 'unitId' | 'unitPrice' | 'currency' | 'effectiveDate' | 'remark'>

const immutable = async(): Promise<never> => { throw Error('报价历史只能追加，请新增报价') }
export const api = {
  list: (query: Record<string, string | number>) => request<Page>('/api/purchase/purchase-reference-price', { query, scope: 'factory' }),
  detail: (id:string) => request<PurchaseReferencePriceVo>('/api/purchase/purchase-reference-price/' + encodeURIComponent(id), { scope: 'factory' }),
  create: (body:unknown) => request<PurchaseReferencePriceVo>('/api/purchase/purchase-reference-price', { method: 'POST', body, scope: 'factory' }),
  update: immutable, remove: immutable
}
export const previewPrice = (query:Record<string, string>) => request<{ reference: PurchaseReferencePriceVo | null;amount: string | null }>('/api/purchase/receipt-price', { query, scope: 'factory' })
