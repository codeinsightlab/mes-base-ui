import { request } from '@/lib/request'
export const defectPermissions = { read: 'business:quality:defect:read', create: 'business:quality:defect:create', revise: 'business:quality:defect:revise', void: 'business:quality:defect:void' }
export interface Facts { executionId: string; affectedNodeId: string; defectQty: string; wasteCategory: 'PROCESS' | 'MATERIAL' | 'BOTH' | null; defectReason: string; responsibleUserId: string | null; responsibilityRemark: string | null; occurredAt: string }
export interface Version extends Facts { defectTypeId?: string | null; defectTypeCodeSnapshot?: string | null; defectTypeNameSnapshot?: string | null; defectTypeRevision?: number | null; id: string; declarationId: string; revisionNo: number; recordAction: 'CREATE' | 'REVISE' | 'VOID'; revisionReason: string | null; reportedBy: string; recordedBy: string; recordedAt: string; affectedNodeName?: string | null; responsibleUserName?: string | null; reportedByName?: string | null; recordedByName?: string | null; processingState: string; receiptState: 'PENDING' | 'PARTIAL' | 'RECEIVED' | null; pendingQuantity: string | null; returnedQuantity: string | null; transferredQuantity: string | null; workorderCode: string | null; productCode: string | null; productName: string | null; batchNo: string | null; specification: string | null; workorderStatus: string | null; executionStatus: string | null; source: 'LOCAL' | 'EXTERNAL' | null }
export interface Command { requestKey: string; expectedRevision?: number; revisionReason?: string; facts?: Facts }
export interface Page { items: Version[]; total: number; offset: number; limit: number }
export interface Node { id: string; name: string; sequenceNo: number }
export interface Acknowledgement { record: Version; success: boolean; externalExecuted: boolean; executionMode: string; externalReference: string | null }
const root = '/api/quality/defects'
const path = (id: string) => root + '/' + encodeURIComponent(id)
export const productionDefect = {
 page: (query: Record<string, string | number>) => request<Page>(root, { query, scope: 'factory' }),
 history: (id: string, offset = 0) => request<Page>(path(id) + '/history', { query: { offset, limit: 20 }, scope: 'factory' }),
 detail: (id: string) => request<Version>(path(id), { scope: 'factory' }),
 nodes: (id: string) => request<Node[]>(root + '/executions/' + encodeURIComponent(id) + '/nodes', { scope: 'factory' }),
 revise: (id: string, body: Command) => request<Acknowledgement>(path(id) + '/revisions', { method: 'POST', body, scope: 'factory' }),
 void: (id: string, body: Command) => request<Acknowledgement>(path(id) + '/void', { method: 'POST', body, scope: 'factory' })
}
export function factsOf(row: Facts): Facts {
 return { executionId: row.executionId, affectedNodeId: row.affectedNodeId, defectQty: row.defectQty, wasteCategory: row.wasteCategory, defectReason: row.defectReason, responsibleUserId: row.responsibleUserId, responsibilityRemark: row.responsibilityRemark, occurredAt: row.occurredAt }
}