import { request } from '@/lib/request'
import type { CrudApi, Page, Row } from '@/lib/crud'

export const customerApi: CrudApi = {
  list: query => request<Page>('/api/sales/mes-customer', { query, scope: 'factory' }),
  detail: id => request<Row>('/api/sales/mes-customer/' + encodeURIComponent(id), { scope: 'factory' }),
  create: body => {
    const input = { ...(body as Row) }
    delete input.status
    return request<Row>('/api/sales/mes-customer', { method: 'POST', body: input, scope: 'factory' })
  },
  update: (id, body) => request<Row>('/api/sales/mes-customer/' + encodeURIComponent(id), { method: 'PUT', body, scope: 'factory' }),
  remove: id => request<void>('/api/sales/mes-customer', { method: 'DELETE', body: [id], scope: 'factory' })
}
