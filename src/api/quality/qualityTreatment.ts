import { request } from '@/lib/request'
export type Action = 'ASSESS' | 'RETURN_NODE' | 'TRANSFER_WAREHOUSE'
export type Attribution = 'INDEPENDENT' | 'OVERLAP' | 'UNVERIFIED'
export interface Disposition { requestId: string; expectedRevision: number; destination: 'WAREHOUSE'; quantity: string; warehouseId: string; reason: string }
export interface Assessment { type: Attribution; relatedDeclarationId: string | null; basis: string }
export interface AssessmentCommand { requestId: string; expectedRevision: number; reason: string; assessment: Assessment }
export interface Event { id: string; declarationId: string; declarationRevision: number; executionId: string; routingNodeId: string; actionType: string; attributionType: Attribution | null; relatedDeclarationId: string | null; basis: string | null; returnedQty: string; operatorUserId: string; operatorName: string | null; recordedAt: string; reason: string; transferQty: string; targetWarehouseId: string | null; stockDocumentId: string | null }
export interface Treatment { declarationId: string; revision: number; executionId: string; routingNodeId: string; defectQty: string; attribution: Attribution | null; relatedDeclarationId: string | null; basis: string | null; pendingDispositionQty: string | null; state: string; receiptState: 'PENDING' | 'PARTIAL' | 'RECEIVED' | null; recordAction: string; returnedQty: string | null; transferredQty: string | null }
const path = (id: string) => '/api/quality/defects/' + encodeURIComponent(id) + '/treatment'
export const qualityTreatment = {
  history: (id: string, offset = 0, limit = 20) => request<{ items: Event[]; total: number; offset: number; limit: number }>(path(id) + '/events', { query: { offset, limit }, scope: 'factory' }),
  check: (id: string, body: { kind: 'assess'; assessment: AssessmentCommand } | { kind: 'dispose'; disposition: Disposition }) => request<Event>(path(id) + '/requests/check', { method: 'POST', body, scope: 'factory' }),
  recent: () => request<Event[]>('/api/quality/treatments/recent', { scope: 'factory' }),
  details: (id: string) => request<Treatment>(path(id), { scope: 'factory' }),
  dispose: (id: string, body: Disposition) => {
    if (body.destination !== 'WAREHOUSE' || !body.warehouseId) throw new Error('不良只办理正式入仓，请选择接收仓库')
    return request<Treatment>('/api/quality/defects/' + encodeURIComponent(id) + '/dispositions', { method: 'POST', body, scope: 'factory' })
  },
  assess: (id: string, body: AssessmentCommand) => request<Treatment>('/api/quality/defects/' + encodeURIComponent(id) + '/assessments', { method: 'POST', body, scope: 'factory' })
}

export const treatmentActionLabel = (value: string) => ({ RETURN_NODE: '历史退回返工', TRANSFER_WAREHOUSE: '转仓入库', ASSESS: '申报核实' }[value] ?? `未识别的操作（${value}）`)
