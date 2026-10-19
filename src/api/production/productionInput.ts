import { request } from '@/lib/request'
import type { RoutingDetail } from './routing'
import type { PathView } from './executionActions'
export const inputPermission = 'business:mes:material:issue:update'
export interface Stock { reference: string; materialId: string; materialCode: string; lotCode: string; warehouseId: string; warehouseCode: string; binCode: string | null; unitId: string; unitCode: string; availableQty: string; observedAt: string }
export interface Order { workorderId: string; workorderCode: string; productCode: string; productName: string; workCenter: string; plannedQty: string; outputUnitCode: string; status: string; allowedWarehouses: string[] }
export interface Supply { sourceMode: 'LOCAL_ONLY' | 'CONNECTED'; stocks: Stock[]; orders: Order[]; total: number; offset: number; limit: number }
export interface Calculation { sourceMode: string; order: Order; stock: Stock; outputQty: string; issueQty: string; calculationKey: string }
export interface Preview { definition: RoutingDetail; actual: PathView | null }
export interface Command { requestId: string; code: string; workorderId: string; stockReference: string; outputQty: string; routingId: string; routingNodeIds: string[]; inputKind: 'PRODUCTION_INPUT'; calculationKey: string }
export interface Result { requestId: string; issueId: string; executionId: string; executionNo: string; code: string; status: string; productionInputQty: string; availableQty: string }
const base = '/api/production/input'
export const productionInput = {
 query: (code: string, offset = 0, limit = 20) => request<Supply>(base, { query: { code, offset, limit }, scope: 'factory' }),
 calculate: (query: {code: string; workorderId: string; stockReference: string; outputQty: string}) => request<Calculation>(base + '/calculate', {query, scope: 'factory'}),
 preview: (code: string, workorderId: string) => request<Preview>(base + '/preview', {query: {code, workorderId}, scope: 'factory'}),
 submit: (body: Command) => request<Result>(base, {method: 'POST', body, scope: 'factory'})
}
