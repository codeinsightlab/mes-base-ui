import type { StockAction } from '@/api/wm/localStock'
import type { StockDocumentDirection } from '@/api/wm/stockDocuments'

export interface StockDocumentReference {
  documentId: string
  direction: StockDocumentDirection
  materialIssue: boolean
  lineId?: string
  label: string
}
export function stockDocumentReference(row: Pick<StockAction, 'sourceId' | 'sourceType' | 'documentLineId'>): StockDocumentReference | null {
  if (!row.sourceId || !/^[1-9]\d*$/.test(row.sourceId)) return null
  if (!['OTHER_RECEIPT', 'OTHER_ISSUE', 'MATERIAL_ISSUE'].includes(row.sourceType)) return null
  const materialIssue = row.sourceType === 'MATERIAL_ISSUE'
  const inbound = row.sourceType === 'OTHER_RECEIPT'
  const lineId = row.documentLineId
  return { documentId: row.sourceId, direction: inbound ? 'IN' : 'OUT', materialIssue,
    ...(lineId && /^[1-9]\d*$/.test(lineId) ? { lineId } : {}),
    label: inbound ? '查看入库单' : materialIssue ? '查看领料单' : '查看出库单' }
}
export function canReadStockDocument(reference: StockDocumentReference, has: (permission: string) => boolean): boolean {
  if (has('business:wm:stock:document:query')) return true
  if (!reference.materialIssue) return false
  return has('business:mes:material:issue:query') || has('business:mes:material:issue:item:list')
    || !!reference.lineId && has('business:mes:material:issue:item:query')
}
