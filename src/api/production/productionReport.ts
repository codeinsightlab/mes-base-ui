import { request } from '@/lib/request'
export const reportPermissions = { quantity: 'business:production:report:quantity', detail: 'business:production:report:detail', supplement: 'business:production:report:supplement', adjust: 'business:production:report:adjust', void: 'business:production:report:void' }
export interface NodeQuantity { executionId: string; routingNodeId: string; operationId: string; code: string; name: string | null; sequenceNo: number; inputQty: string; reportedQty: string; defectQty: string; effectiveOutputQty: string; availableQty: string; qualityIntegrated: boolean; directDefectQty: string; returnedQty: string; netDefectQty: string; propagatedLossQty: string; historicalOverrunQty: string; rawEffectiveOutputQty: string; rawAvailableQty: string; unverifiedDefectQty: string; historicalConflict: boolean; positiveReportBlockReason?: string | null }
export interface ExecutionQuantity {
  productId: string | null;
  confirmedInputQty: string; reservedInputQty: string; productionInputQty: string; routingLabel?: string | null; executionId: string; workorderId: string; routingId: string; targetQty: string; pathStatus: string; writable: boolean; boundary: string | null; nodes: NodeQuantity[] }
export interface Ledger { id: string; executionId: string; routingNodeId: string; recordType: 'REPORT' | 'ADJUSTMENT'; quantityDelta: string; referenceReportId: string | null; operatorUserId: string; recordedBy: string; operatorName?: string | null; recordedByName?: string | null; reportTime: string; workstationId: string | null; reason: string; createTime: string }
export interface Detail { record: Ledger; originalEffectiveQty: string }
export interface Page<T> { items: T[]; total: number; offset: number; limit: number }
export interface ExecutionSummary { confirmedInputQty: string; reservedInputQty: string; productionInputQty: string; routingLabel?: string | null; executionId: string; workorderId: string; routingId: string; targetQty: string; pathStatus: string; lastNodeReportedQty: string }
export interface HistoricalUser { id: string; name: string }
export interface Supplement { requestId: string; executionId: string; routingNodeId: string; quantity: string; operatorUserId: string; reportTime: string; workstationId: string | null; reason: string }
const root = '/api/production'
const report = (id: string) => root + '/reports/' + encodeURIComponent(id)
export const productionReport = {
  quantities: (id: string) => request<ExecutionQuantity>(root + '/report-quantities/executions/' + encodeURIComponent(id), { scope: 'factory' }),
  workorderQuantities: (id: string, offset = 0, limit = 20) => request<Page<ExecutionSummary>>(root + '/report-quantities/workorders/' + encodeURIComponent(id), { query: { offset, limit }, scope: 'factory' }),
  page: (executionId: string, routingNodeId: string, offset = 0, limit = 20) => request<Page<Ledger>>(root + '/reports', { query: { executionId, routingNodeId, offset, limit }, scope: 'factory' }),
  detail: (id: string) => request<Detail>(report(id), { scope: 'factory' }),
  history: (id: string, offset = 0, limit = 20) => request<Page<Ledger>>(report(id) + '/adjustments', { query: { offset, limit }, scope: 'factory' }),
  supplement: (body: Supplement) => request<Ledger>(root + '/reports/supplements', { method: 'POST', body, scope: 'factory' }),
  adjust: (id: string, quantityDelta: string, reason: string, requestId: string) => request<Ledger>(report(id) + '/adjustments', { method: 'POST', body: { quantityDelta, reason, requestId }, scope: 'factory' }),
  void: (id: string, reason: string, requestId: string) => request<Ledger>(report(id) + '/void', { method: 'POST', body: { reason, requestId }, scope: 'factory' }),
  users: (keyword: string, offset = 0) => request<Page<HistoricalUser>>('/api/business/directory/report-operators', { query: { keyword, offset, limit: 20 }, scope: 'factory' })
}
