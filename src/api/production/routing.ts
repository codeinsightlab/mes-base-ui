import { request } from '@/lib/request'
export interface RoutingVo {
  id: string; code: string; name: string; version: number;
  status: 'DRAFT' | 'PUBLISHED' | 'DISABLED'; description: string | null;
  externalId: string | null; sourceVersion: string | null; revision: number; publishedAt: string | null
}
export interface RoutingNode {
  id?: string; nodeCode: string; operationId: string; displayOrder: number; operationCode?: string | null;
  operationName?: string | null; operationDescription?: string | null; isKey: boolean; description: string | null
}
export interface RoutingEdge { id?: string; fromNodeCode: string; toNodeCode: string }
export interface RoutingProduct {
  id: string; materialId: string
  currentMaterialCode: string | null; currentMaterialName: string | null
}
export interface RoutingDetail { routing: RoutingVo; products: RoutingProduct[]; nodes: RoutingNode[]; edges: RoutingEdge[] }
export interface ReferenceOption { id: string; code: string; name: string }
export interface RoutingPage { items: RoutingVo[]; total: number; offset: number; limit: number }
export interface SyncResult { fetched: number; created: number; updated: number; skipped: number }
const base = '/api/production/routing'
const path = (id: string) => base + '/' + encodeURIComponent(id)
export const api = {
  list: (query: Record<string, string | number>) => request<RoutingPage>(base, { query, scope: 'factory' }),
  detail: (id: string) => request<RoutingDetail>(path(id), { scope: 'factory' }),
  create: (body: { code: string; name: string; description: string | null }) =>
    request<RoutingVo>(base, { method: 'POST', body, scope: 'factory' }),
  update: (id: string, body: { name: string; description: string | null; revision: number }) =>
    request<RoutingVo>(path(id), { method: 'PUT', body, scope: 'factory' }),
  saveContent: (id: string, body: { revision: number; materialIds: string[]; nodes: RoutingNode[]; edges: RoutingEdge[] }) =>
    request<RoutingDetail>(path(id) + '/content', { method: 'PUT', body: {
      revision: body.revision, materialIds: body.materialIds,
      nodes: body.nodes.map(({ nodeCode, displayOrder, operationId, isKey, description }) => ({ nodeCode, displayOrder, operationId, isKey, description })),
      edges: body.edges.map(({ fromNodeCode, toNodeCode }) => ({ fromNodeCode, toNodeCode }))
    }, scope: 'factory' }),
  action: (id: string, action: 'publish' | 'disable' | 'enable' | 'new-version', revision: number) =>
    request<RoutingVo>(path(id) + '/actions/' + action, { method: 'POST', body: { revision }, scope: 'factory' }),
  copy: (id: string, body: { code: string; name: string; revision: number }) =>
    request<RoutingVo>(path(id) + '/actions/copy', { method: 'POST', body, scope: 'factory' }),
  remove: (id: string) => request<void>(base, { method: 'DELETE', body: [id], scope: 'factory' }),
  operations: (search = '') => request<ReferenceOption[]>(base + '/references/operations', { query: { search, limit: 100 }, scope: 'factory' }),
  materials: (search = '') => request<ReferenceOption[]>(base + '/references/materials', { query: { search, limit: 100 }, scope: 'factory' })
}
export const sync = () => request<SyncResult>(base + '/actions/sync', { method: 'POST', scope: 'factory' })
