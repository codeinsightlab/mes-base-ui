import { request } from '@/lib/request'
export const defectPermissions = { read: 'business:quality:defect:read', create: 'business:quality:defect:create', revise: 'business:quality:defect:revise', void: 'business:quality:defect:void' }
export interface Facts { executionId: string; affectedNodeId: string; discoveredNodeId: string; responsibleNodeId: string | null; defectQty: string; wasteCategory: 'PROCESS' | 'MATERIAL' | 'BOTH' | null; defectReason: string; responsibleUserId: string | null; responsibilityRemark: string | null; destinationType: 'SAME_NODE' | 'ROUTING_NODE' | 'WAREHOUSE'; targetNodeId: string | null; targetWarehouseId: string | null; destinationRemark: string | null; occurredAt: string }
export interface Version extends Facts { defectTypeId?: string | null; defectTypeCodeSnapshot?: string | null; defectTypeNameSnapshot?: string | null; defectTypeRevision?: number | null; id: string; declarationId: string; revisionNo: number; recordAction: 'CREATE' | 'REVISE' | 'VOID'; revisionReason: string | null; reportedBy: string; recordedBy: string; recordedAt: string; discoveredNodeName?: string | null; affectedNodeName?: string | null; responsibleNodeName?: string | null; targetNodeName?: string | null; targetWarehouseName?: string | null; responsibleUserName?: string | null; reportedByName?: string | null; recordedByName?: string | null }
export interface Command { requestKey: string; expectedRevision?: number; revisionReason?: string; facts?: Facts }
export interface Page { items: Version[]; total: number; offset: number; limit: number }
export interface Node { id: string; name: string; sequenceNo: number }
export interface Warehouse { id: string; code: string; name: string }
export interface Acknowledgement { record: Version; success: boolean; externalExecuted: boolean; executionMode: string; externalReference: string | null }
const root = '/api/quality/defects'
const path = (id: string) => root + '/' + encodeURIComponent(id)
export const productionDefect = {
 page: (query: Record<string, string | number>) => request<Page>(root, { query, scope: 'factory' }),
 history: (id: string, offset = 0) => request<Page>(path(id) + '/history', { query: { offset, limit: 20 }, scope: 'factory' }),
 detail: (id: string) => request<Version>(path(id), { scope: 'factory' }),
 nodes: (id: string) => request<Node[]>(root + '/executions/' + encodeURIComponent(id) + '/nodes', { scope: 'factory' }),
 warehouses: (keyword = '') => request<Warehouse[]>(root + '/warehouses', { query: { keyword }, scope: 'factory' }),
 create: (body: Command) => request<Acknowledgement>(root, { method: 'POST', body, scope: 'factory' }),
 revise: (id: string, body: Command) => request<Acknowledgement>(path(id) + '/revisions', { method: 'POST', body, scope: 'factory' }),
 void: (id: string, body: Command) => request<Acknowledgement>(path(id) + '/void', { method: 'POST', body, scope: 'factory' })
}
export function factsOf(row: Facts): Facts {
 return { executionId: row.executionId, affectedNodeId: row.affectedNodeId, discoveredNodeId: row.discoveredNodeId, responsibleNodeId: row.responsibleNodeId, defectQty: row.defectQty, wasteCategory: row.wasteCategory, defectReason: row.defectReason, responsibleUserId: row.responsibleUserId, responsibilityRemark: row.responsibilityRemark, destinationType: row.destinationType, targetNodeId: row.targetNodeId, targetWarehouseId: row.targetWarehouseId, destinationRemark: row.destinationRemark, occurredAt: row.occurredAt }
}
export function upstreamNodes(nodes: Node[], affected: string): Node[] { const i = nodes.findIndex(n => n.id === affected); return i < 1 ? [] : nodes.slice(0, i) }
export function defaultUpstream(nodes: Node[], affected: string): string | null { return upstreamNodes(nodes, affected).at(-1)?.id ?? null }
