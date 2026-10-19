import { request } from '@/lib/request'
import type { Acknowledgement, Version, Node } from './productionDefect'
export type WasteCategory = 'PROCESS' | 'MATERIAL' | 'BOTH'
export const wasteLabels: Record<string, string> = { PROCESS: '工废', MATERIAL: '料废', BOTH: '工废＋料废' }
export interface DefectType { id: string; operationId: string; code: string; name: string; defaultWasteCategory: WasteCategory; status: 'ENABLED' | 'DISABLED'; sort: number; remark: string | null; revision: number }
export interface TypeInput { code: string; name: string; defaultWasteCategory: WasteCategory; status: 'ENABLED' | 'DISABLED'; sort: number; remark: string | null; expectedRevision?: number }
export interface Page<T> { items: T[]; total: number; offset: number; limit: number }
export interface DeclarationContext { executionId: string; nodeId: string; operationId: string; operationName: string | null; productId: string; productCode: string; productName: string; types: DefectType[]; typeTotal: number; offset: number; limit: number; canOverrideWasteCategory: boolean }
export interface Declaration { requestId: string; executionId: string; nodeId: string; defectTypeId: string; expectedTypeRevision: number; quantity: string; wasteCategory: WasteCategory; remark: string | null; occurredAt: string }
export interface Statistics { operationId: string; defectTypeId: string | null; typeName: string | null; typeNameVariants?: number; wasteCategory: string; declaredQty: string; independentQty: string; overlapQty: string; unverifiedQty: string; recoveredQty: string; netDefectQty: string }
const root = '/api/quality/defects'
const typePath = (id: string) => '/api/production/operation/' + encodeURIComponent(id) + '/defect-types'
export const qualityV2 = {
  types: (id: string, offset = 0) => request<Page<DefectType>>(typePath(id), { query: { offset, limit: 20 }, scope: 'factory' }),
  createType: (id: string, body: TypeInput) => request<DefectType>(typePath(id), { method: 'POST', body, scope: 'factory' }),
  updateType: (id: string, type: string, body: TypeInput) => request<DefectType>(typePath(id) + '/' + encodeURIComponent(type), { method: 'PUT', body, scope: 'factory' }),
  deleteType: (id: string, row: DefectType) => request<void>(typePath(id) + '/' + encodeURIComponent(row.id), { method: 'DELETE', query: { expectedRevision: row.revision }, scope: 'factory' }),
  nodes: (id: string) => request<Node[]>(root + '/executions/' + encodeURIComponent(id) + '/declaration-nodes', { scope: 'factory' }),
  context: (execution: string, node: string, offset = 0) => request<DeclarationContext>(root + '/executions/' + encodeURIComponent(execution) + '/nodes/' + encodeURIComponent(node) + '/declaration-context', { query: { offset, limit: 100 }, scope: 'factory' }),
  declare: (body: Declaration) => request<Acknowledgement>(root + '/declarations', { method: 'POST', body, scope: 'factory' }),
  request: (id: string) => request<Version>(root + '/declarations/requests/' + encodeURIComponent(id), { scope: 'factory' }),
  statistics: (query: Record<string, string | number>) => request<Page<Statistics>>(root + '/statistics', { query, scope: 'factory' })
}
