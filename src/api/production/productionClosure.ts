import { request } from '@/lib/request'
export interface Completion { id: string;executionId: string;effectiveQty: string;inboundQty: string;operatorUserId: string;recordedAt: string;reason: string }
export interface ClosureSummary { executionId: string;status: string;targetQty: string;effective: string;receivedQty: string;defectQty: string;receiptState: 'PENDING' | 'PARTIAL' | 'FULLY_RECEIVED';orderBlockedReason: string | null;blockedReason: string | null;completion: Completion | null }
const execution = (id:string) => '/api/production/executions/' + encodeURIComponent(id)
export const productionClosure = {
  summary: (id:string) => request<ClosureSummary>(execution(id) + '/closure', { scope: 'factory' }),
  recheckReceipt: (id:string) => request<ClosureSummary>(execution(id) + '/actions/recheck-receipt', { method: 'POST', scope: 'factory' })
}
