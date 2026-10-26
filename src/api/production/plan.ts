import { request } from '@/lib/request'
import type { CrudApi, Page, Row } from '@/lib/crud'

export interface PlanDocument extends Row { header: Row; items: Row[] }
export const productionPlanApi: Omit<CrudApi,'create'|'update'> & { document(id: string): Promise<PlanDocument>; create(body: unknown): Promise<PlanDocument>; update(id:string, body:unknown):Promise<PlanDocument> } = {
  list: query => request<Page>('/api/production/mes-production-plan', { query, scope: 'factory' }),
  detail: id => request<Row>('/api/production/mes-production-plan/' + encodeURIComponent(id), { scope: 'factory' }),
  document: id => request<PlanDocument>('/api/production/mes-production-plan/' + encodeURIComponent(id) + '/document', { scope: 'factory' }),
  create: body => request<PlanDocument>('/api/production/mes-production-plan', { method: 'POST', body, scope: 'factory' }),
  update: (id, body) => request<PlanDocument>('/api/production/mes-production-plan/' + encodeURIComponent(id), { method: 'PUT', body, scope: 'factory' }),
  remove: id => request<void>('/api/production/mes-production-plan', { method: 'DELETE', body: [id], scope: 'factory' })
}
