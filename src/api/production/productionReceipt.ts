import { request } from '@/lib/request'
export const receiptPermissions = { list: 'business:production:receipt:list', detail: 'business:production:receipt:detail', create: 'business:production:receipt:create', reverse: 'business:production:receipt:reverse' }
export interface Receipt { id: string; receiptNo: string; executionId: string; executionNo: string | null; workorderCode: string | null; productCode: string | null; productName: string | null; warehouseId: string; warehouseName: string | null; productLotCode: string | null; recordType: 'RECEIPT' | 'REVERSAL'; quantityDelta: string; referenceReceiptId: string | null; operatorUserId: string; operatorName: string | null; recordedBy: string; recordedByName: string | null; occurredAt: string; createTime: string; reason: string | null }
export interface ReceiptSummary { executionId: string; executionNo: string; workorderId: string; workorderCode: string; productCode: string; productName: string; targetQty: string; status: string; routingLabel: string; pathStatus: string; terminalNodeId: string | null; terminalNodeName: string | null; output: string | null; received: string; remaining: string | null; excess: string | null; canReceive: boolean; blockedCode: string; blockedReason: string; released: string; releaseRemaining: string; accepted: string; pendingAcceptance: string; releaseExcess: string }
export interface ReceiptPage { items: Receipt[]; total: number; offset: number; limit: number }
export interface Receive { executionId: string; warehouseId: string; productLotCode: string | null; quantity: string; requestId: string }
export interface Reverse { quantity: string; reason: string; requestId: string }
const url = '/api/production/receipts'
export const productionReceipt = {
 page: (query: Record<string, string | number>) => request<ReceiptPage>(url, { query, scope: 'factory' }),
 summary: (executionId: string) => request<ReceiptSummary>(url + '/summary', { query: { executionId }, scope: 'factory' }),
 detail: (id: string) => request<{record: Receipt; originalBalance: string}>(url + '/' + encodeURIComponent(id), { scope: 'factory' }),
 receive: (body: Receive) => request<Receipt>(url, { method: 'POST', body, scope: 'factory' }),
 reverse: (id: string, body: Reverse) => request<Receipt>(url + '/' + encodeURIComponent(id) + '/reverse', { method: 'POST', body, scope: 'factory' })
}
