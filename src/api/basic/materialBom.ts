import { request } from '@/lib/request'
import type { CrudApi, Row } from '@/lib/crud'
export interface Bom extends Row { id: string; code: string; version: string; productId: string; baseQty: string; unitId: string; status: string; revision: string; remark: string | null }
export interface BomNode { path: string; materialId: string; code: string; name: string; quantity: string; unitName: string; childBomId: string | null; children: BomNode[] }
export interface BomGraph { bomId: string; outputQty: string; items: BomNode[]; totals: Omit<BomNode, 'children' | 'path' | 'childBomId'>[] }
function crud(path:string):CrudApi {
  const remove = (ids:string[]) => request<void>(path, { method: 'DELETE', body: ids, scope: 'factory' })
  return {
    list: query => request(path, { query, scope: 'factory' }),
    detail: id => request(path + '/' + encodeURIComponent(id), { scope: 'factory' }),
    create: body => request(path, { method: 'POST', body, scope: 'factory' }),
    update: (id, body) => request(path + '/' + encodeURIComponent(id), { method: 'PUT', body, scope: 'factory' }),
    remove: id => remove([id]), delids: remove
  }
}
export const bomApi = crud('/api/basic/material-bom')
export const bomItemApi = crud('/api/basic/material-bom-item')
export const transition = (id:string, action:'publish' | 'disable', revision:string) => request<Bom>('/api/basic/material-bom/' + encodeURIComponent(id) + '/' + action, { method: 'POST', body: { revision }, scope: 'factory' })
export const structure = (id:string, quantity:string) => request<BomGraph>('/api/basic/material-bom/' + encodeURIComponent(id) + '/structure', { query: { quantity }, scope: 'factory' })
