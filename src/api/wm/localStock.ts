import { request } from '@/lib/request'

export type StockOperation = 'opening' | 'receipt' | 'gain' | 'loss' | 'correction' | 'return'
export interface StockCommand {
  requestId: string; stockId: string; quantity: string; expectedQuantity: string; expectedAvailable: string; reason: string; issueId: string | null
}
export interface StockAction {
  id: string; stockId: string; materialId: string; unitId: string; warehouseId: string; batchNo: string | null; binCode: string | null;
  actionType: string; quantityDelta: string; availableDelta: string; quantityBefore: string; quantityAfter: string;
  availableBefore: string; availableAfter: string; sourceType: string; sourceId: string | null; referenceActionId: string | null;
  documentLineId?: string | null; operationId?: string | null;
  executionId: string | null; operatorUserId: string; occurredAt: string; reason: string
}
export const stockOperations: {value: StockOperation; label: string}[] = [
  { value: 'opening', label: '期初建账' }, { value: 'receipt', label: '原材料入库' },
  { value: 'gain', label: '盘盈' }, { value: 'loss', label: '盘亏' },
  { value: 'correction', label: '业务纠错（有符号增减量）' }, { value: 'return', label: '生产退料' }
]
export const localStock = {
  execute: (operation: StockOperation, body: StockCommand) => request<StockAction>('/api/wm/local-stock/' + operation, { method: 'POST', body, scope: 'factory' }),
  actions: (stockId: string, offset = 0) => request<{items: StockAction[]; total: number}>('/api/wm/wm-stock-action', { query: {stockId,offset,limit:20}, scope: 'factory' })
}
