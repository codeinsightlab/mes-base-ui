import { request } from '@/lib/request'
export interface AcceptanceFact { id: string;receiptId: string;executionId: string;productId: string;stockId: string;quantityDelta: string;referenceId: string | null;stockActionId: string;operatorUserId: string;recordedAt: string;reason: string }
const url = '/api/wm/production-acceptances'
export const warehouseAcceptance = {
  history: (id:string, offset = 0) => request<{ items: AcceptanceFact[];total: number }>(url + '/receipts/' + encodeURIComponent(id) + '/history', { query: { offset, limit: 20 }, scope: 'factory' })
}
