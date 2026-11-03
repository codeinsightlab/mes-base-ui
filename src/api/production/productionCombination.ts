import { request, requestBlob } from '@/lib/request'
export interface CombinationItem { demandLineId: string; lineNo: number; materialId: string; materialCode: string; unitId: string; totalRequiredQty: string; batches: (string | null)[] }
export interface Combination { code: string; workorderId: string; workorderCode: string; productId: string; outputUnitId: string; demandRevision: string; executionCode: string | null; executionStatus: string | null; closed: boolean; items: CombinationItem[] }
export interface Allocation { demandLineId: string; stockId: string; materialId: string; warehouseId: string; binCode: string | null; batchNo: string | null; unitId: string; quantity: string }
export interface Calculation { combination: Combination; maximumQty: string; outputQty: string; allocations: Allocation[]; calculationKey: string; warehouses: { id: string; code: string; name: string }[] }
export interface Generated { combination: Combination; requestedQty: string; suggestedQty: string; allocations: Allocation[]; strategy: string }
const base = '/api/production/combinations'
export const productionCombination = {
  generate: (workorderId: string, quantity: string) => request<Generated>(base, { method: 'POST', body: { workorderId, quantity }, scope: 'factory' }),
  resolve: (code: string) => request<Combination>(base + '/resolve', { query: { code }, scope: 'factory' }),
  calculate: (code: string, quantity?: string) => request<Calculation>(base + '/calculate', { query: { code, ...(quantity === undefined ? {} : { quantity }) }, scope: 'factory' }),
  qr: (code: string) => requestBlob(base + '/qr', { query: { code }, scope: 'factory' })
}
