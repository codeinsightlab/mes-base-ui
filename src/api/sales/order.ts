import { request } from '@/lib/request'
import type { CrudApi, Page, Row } from '@/lib/crud'

export interface SalesDocument extends Row { header: Row; items: Row[] }
export const salesOrderApi: Omit<CrudApi,'create'|'update'> & { document(id: string): Promise<SalesDocument>; create(body: unknown): Promise<SalesDocument>; update(id:string, body:unknown):Promise<SalesDocument> } = {
  list: query => request<Page>('/api/sales/mes-sales-order', { query, scope: 'factory' }),
  detail: id => request<Row>('/api/sales/mes-sales-order/' + encodeURIComponent(id), { scope: 'factory' }),
  document: id => request<SalesDocument>('/api/sales/mes-sales-order/' + encodeURIComponent(id) + '/document', { scope: 'factory' }),
  create: body => request<SalesDocument>('/api/sales/mes-sales-order', { method: 'POST', body, scope: 'factory' }),
  update: (id, body) => request<SalesDocument>('/api/sales/mes-sales-order/' + encodeURIComponent(id), { method: 'PUT', body, scope: 'factory' }),
  remove: id => request<void>('/api/sales/mes-sales-order', { method: 'DELETE', body: [id], scope: 'factory' })
}
