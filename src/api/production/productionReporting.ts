import { request } from '@/lib/request'
import type { ExecutionQuantity, Ledger } from './productionReport'
import type { PathView } from './executionActions'
import type { ProductionIdentity } from './productionIdentity'
export const submitPermission = 'business:production:report:submit'
export interface ReportingContext {
  identity: ProductionIdentity
  quantities: ExecutionQuantity
  path: PathView
  candidates: { routingNodeId: string; status: string; reason: string | null }[]
}
export interface ReportCommand { executionCode: string; routingNodeId: string; reportQty: string; workstationId: string | null; requestId: string }
export const productionReporting = {
  context: (executionCode: string) => request<ReportingContext>('/api/production/reporting/context', { query: { executionCode }, scope: 'factory' }),
  submit: (body: ReportCommand) => request<Ledger>('/api/production/reporting', { method: 'POST', body, scope: 'factory' })
}
