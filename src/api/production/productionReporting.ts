import { request } from '@/lib/request'
import type { ExecutionQuantity, Ledger } from './productionReport'
import type { PathView } from './executionActions'
export const submitPermission = 'business:production:report:submit'
export interface ReportingContext {
 identity: { executionId: string; executionNo: string; qrCode: string; workorderId: string; workorderCode: string; productId: string; productCode: string; productName: string; routingId: string; routingCode: string; routingVersion: number; status: string; targetQty: string }
 quantities: ExecutionQuantity
 path: PathView
 candidates: { routingNodeId: string; status: string; reason: string | null }[]
}
export interface ReportCommand { executionId: string; routingNodeId: string; reportQty: string; workstationId: string | null; requestId: string }
export const productionReporting = {
 context: (code: string) => request<ReportingContext>('/api/production/reporting/context', { query: { code }, scope: 'factory' }),
 submit: (body: ReportCommand) => request<Ledger>('/api/production/reporting', { method: 'POST', body, scope: 'factory' })
}
