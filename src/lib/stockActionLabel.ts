import type { StockAction } from '@/api/wm/localStock'

// Standalone adjustments remain action facts. Document-backed facts use the shared document catalog.
const actionLabels: Record<string, string> = {
  OPENING: '期初建账', RECEIPT: '原材料入库', ISSUE: '生产领料', RETURN: '生产退料',
  GAIN: '盘盈', LOSS: '盘亏', CORRECTION: '业务纠错', REVERSAL: '原操作撤销',
  PRODUCT_RECEIPT: '成品入库', PRODUCT_REVERSAL: '成品入库撤回',
}
export function stockActionLabel(row: Pick<StockAction, 'actionType' | 'documentType' | 'documentLineId'>, typeLabel: (value: unknown) => string): string {
  if (row.documentType) return typeLabel(row.documentType)
  if (row.documentLineId && ['OTHER_RECEIPT', 'OTHER_ISSUE', 'ISSUE'].includes(row.actionType)) return '单据类型待确认'
  return actionLabels[row.actionType] ?? row.actionType
}
