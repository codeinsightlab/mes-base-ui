import { request } from '@/lib/request'
import type { RoutingDetail } from './routing'
import type { PathView } from './executionActions'
export const inputPermission = 'business:mes:material:issue:update'
export interface Preview { definition: RoutingDetail | null; actual: PathView | null }
export interface Command { requestId: string; code: string; outputQty: string; routingId: string | null; routingNodeIds: string[]; calculationKey: string }
export interface Result { requestId: string; documentId: string; executionId: string; code: string; status: string; confirmedInputQty: string; stockApplied: boolean }
export const productionInput = {
  preview: (code: string, workorderId: string) => request<Preview>('/api/production/input/preview', { query: { code, workorderId }, scope: 'factory' }),
  submit: (body: Command) => request<Result>('/api/production/input', { method: 'POST', body, scope: 'factory' })
}
