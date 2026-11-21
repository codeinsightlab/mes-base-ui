import type { ExecutionQuantity } from './productionReport'
import { request } from '@/lib/request'
import type { WorkOrderProgressPage } from './workOrderProgress'

export interface Count { key: string; count: number }
export interface Amount { key: string | null; id: string | null; quantity: string | null }
export interface Slice<T> { items: T[]; total: number; offset: number; limit: number }
export interface OrderSummary { planned: string | null; completed: string | null; unit: string | null; progress: Count[]; ranking: { id: string; code: string; percent: string }[] }
export interface ExecutionStats { states: Count[]; created: number; completed: number }
export interface ReportRow { id: string; executionCode: string; workorderId: string; workorderCode: string; operationName: string; reportTime: string; effectiveQty: string; unit: string | null }
export interface ProductCount { id: string; name: string; count: number }
export interface Quality { unit: string | null; net: string | null; unverified: number; unresolved: number; overlap: number; dates: Amount[]; types: Amount[]; operations: Amount[]; waste: Amount[] }
export interface DefectRow { declarationId: string; executionCode: string; operationName: string; typeName: string; waste: string; occurredAt: string; product: string; unit: string | null; declared: string | null }
export interface Balance { id: string; warehouse: string; material: string; unit: string | null; quantity: string; available: string | null }
export interface StockTotals { quantity: string; available: string | null; unit: string | null; warehouses: Balance[] }
export interface StockRow extends Balance { materialId: string; warehouseId: string; batch: string; bin: string }
export interface Movements { unit: string | null; net: string; issued: string; returned: string; days: { day: string; inbound: string; outbound: string }[] }
export interface FlowRow { id: string; documentId: string; direction: string; lineId: string; documentNo: string; type: string; delta: string; unit: string | null; occurredAt: string }
interface Responses {
  path: { facts: ExecutionQuantity; unitName: string | null }
  'order-states': Count[]; 'order-summary': OrderSummary; orders: WorkOrderProgressPage; executions: ExecutionStats; 'report-days': Count[]; reports: Slice<ReportRow>
  'defect-products': ProductCount[]; 'declaration-count': number; quality: Quality; defects: Slice<DefectRow>
  balances: StockTotals; stocks: Slice<StockRow>; movements: Movements; flows: Slice<FlowRow>
}
export const access = {
  menu: 'business:analytics:view', orders: 'workorder:list', execution: 'business:mes:production:execution:list', quantity: 'business:production:report:quantity',
  report: 'business:production:report:detail', quality: 'business:quality:defect:read', stock: 'business:wm:inventory:list', flow: 'business:wm:stock:action:list',
}
export function readAnalytics<K extends keyof Responses>(key: K, params: Record<string, string | number | null | undefined>, signal: AbortSignal) {
  const query: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '') query[k] = v
  return request<Responses[K]>('/api/production/analytics/' + key, { query, scope: 'factory', signal })
}
