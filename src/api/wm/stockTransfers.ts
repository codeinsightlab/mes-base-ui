import { request } from '@/lib/request'
import type { Detail, Header, ApprovalIntent } from './stockDocuments'
import type { Row } from '@/lib/crud'
export interface TransferDetail { outbound: Detail; inbound: Detail }
export interface TransferCommand { requestId: string; expectedRevision?: string; reason: string; remark?: string | null; items: { sourceStockId: string; targetStockId: string | null; targetWarehouseId: string; targetBinCode: string | null; quantity: string; remark?: string | null }[] }
const root = '/api/wm/stock-transfers'
const path = (id: string) => root + '/' + encodeURIComponent(id)
export const stockTransfers = {
  list: (query: Record<string, string | number>) => request<{ items: Header[]; total: number; offset: number; limit: number }>(root, { query: Object.fromEntries(Object.entries(query).filter(([key]) => ['documentNo', 'status', 'offset', 'limit'].includes(key))), scope: 'factory' }),
  detail: (id: string) => request<TransferDetail>(path(id), { scope: 'factory' }),
  create: (body: TransferCommand) => request<TransferDetail>(root, { method: 'POST', body, scope: 'factory' }),
  update: (id: string, body: TransferCommand) => request<TransferDetail>(path(id), { method: 'PUT', body, scope: 'factory' }),
  approve: (id: string, body: ApprovalIntent) => request<TransferDetail>(path(id) + '/actions/approve', { method: 'POST', body, scope: 'factory' }),
  cancel: (id: string, expectedRevision: string) => request<TransferDetail>(path(id) + '/actions/cancel', { method: 'POST', body: { expectedRevision }, scope: 'factory' })
}
export function transferView(pair: TransferDetail) {
  return { header: { ...pair.outbound.document, targetDocumentId: pair.inbound.document.id, targetDocumentNo: pair.inbound.document.documentNo },
    items: pair.outbound.lines.map(line => ({ ...line, sourceStockId: line.stockId, sourceWarehouseId: line.warehouseId, targetWarehouseId: pair.inbound.lines.find(target => target.lineNo === line.lineNo)?.warehouseId, targetStockId: pair.inbound.lines.find(target => target.lineNo === line.lineNo)?.stockId, targetBinCode: pair.inbound.lines.find(target => target.lineNo === line.lineNo)?.binCode })) }
}
export function transferCommand(raw: unknown): TransferCommand {
  const row = raw as Row
  if (!Array.isArray(row.items)) throw Error('请填写调拨明细')
  return { requestId: String(row.createRequestId), expectedRevision: row.revision as string | undefined, reason: String(row.reason ?? ''), remark: row.remark as string | null,
    items: row.items.map((value: unknown) => {
      const line = value as Row
      let targetStockId: string | null = null
      if (line.targetStockId != null && line.targetStockId !== '') targetStockId = String(line.targetStockId)
      let targetBinCode: string | null = null
      if (line.targetBinCode != null && line.targetBinCode !== '') targetBinCode = String(line.targetBinCode)
      return { sourceStockId: String(line.sourceStockId ?? ''), targetStockId, targetWarehouseId: String(line.targetWarehouseId ?? ''), targetBinCode, quantity: String(line.quantity ?? ''), remark: line.remark as string | null }
    }) }
}
