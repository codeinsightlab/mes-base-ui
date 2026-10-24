import { request } from '@/lib/request'
export const receiptPermissions = { list: 'business:production:receipt:list', detail: 'business:production:receipt:detail' }
export interface Receipt { id: string; receiptNo: string; executionId: string; workorderCode: string | null; productCode: string | null; productName: string | null; warehouseId: string; warehouseName: string | null; productLotCode: string | null; recordType: 'RECEIPT' | 'REVERSAL'; quantityDelta: string; referenceReceiptId: string | null; operatorUserId: string; operatorName: string | null; recordedBy: string; recordedByName: string | null; occurredAt: string; createTime: string; reason: string | null }
export interface ReceiptPage { items: Receipt[]; total: number; offset: number; limit: number }
const url = '/api/production/receipts'
export const productionReceipt = {
  page: (query: Record<string, string | number>) => request<ReceiptPage>(url, { query, scope: 'factory' }),
  detail: (id: string) => request<{ record: Receipt; originalBalance: string }>(url + '/' + encodeURIComponent(id), { scope: 'factory' })
}
