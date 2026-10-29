import { beforeEach, expect, it, vi } from 'vitest'
import { stockTransfers, transferCommand, transferView, type TransferDetail } from '../src/api/wm/stockTransfers'
import { stockDocumentApis, stockDocuments } from '../src/api/wm/stockDocuments'
const mocks = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('../src/lib/request', () => ({ request: mocks.request }))
beforeEach(() => { vi.clearAllMocks(); mocks.request.mockResolvedValue({ document: { id: '1' }, lines: [] }) })
it('uses distinct fixed paths for direction lists, types, numbering and aggregates without a client direction', async() => {
  await stockDocuments.types('IN'); await stockDocuments.numberingRules('OUT')
  await stockDocumentApis(undefined, () => 'IN').aggregateApi.create({ documentType: 'OTHER_RECEIPT', ruleCode: 'OTHER_RECEIPT', reason: '盘点', items: [{ stockId: '9', quantity: '0.000001' }] })
  expect(mocks.request.mock.calls.map(call => call[0])).toEqual(['/api/wm/inbound-documents/types', '/api/wm/outbound-documents/numbering-rules', '/api/wm/inbound-documents/aggregate'])
  expect(mocks.request.mock.calls[2]![1].body.header).not.toHaveProperty('direction')
})
it('joins paired lines by line number and sends only transfer identity and exact quantities', () => {
  const pair = { outbound: { document: { id: '9007199254740999', createRequestId: 'original', revision: '3', reason: '移库' }, lines: [{ id: '7', lineNo: 1, stockId: '11', materialId: '4', warehouseId: '2', quantity: '0.000001' }] }, inbound: { document: { id: '9007199254740998', documentNo: 'TI-1' }, lines: [{ lineNo: 1, stockId: '12', warehouseId: '3', binCode: ' 0001 ' }] }} as unknown as TransferDetail
  const view = transferView(pair), command = transferCommand({ ...view.header, items: view.items })
  expect(view.header.targetDocumentId).toBe('9007199254740998')
  expect(command).toMatchObject({ requestId: 'original', expectedRevision: '3', items: [{ sourceStockId: '11', targetStockId: '12', targetWarehouseId: '3', targetBinCode: ' 0001 ', quantity: '0.000001' }] })
  expect(command.items[0]).not.toHaveProperty('materialId')
})
it('uses paired commands and the dedicated transfer list without transmitting client direction or type', async() => {
  const body = { requestId: 'original', expectedRevision: '4' }
  await stockTransfers.approve('9007199254740999', body); await stockTransfers.list({ documentType: 'OTHER_ISSUE', direction: 'IN', documentNo: 'TRO', status: 'DRAFT', offset: 20, limit: 20 })
  expect(mocks.request.mock.calls[0]).toEqual(['/api/wm/stock-transfers/9007199254740999/actions/approve', { method: 'POST', body, scope: 'factory' }])
  expect(mocks.request.mock.calls[1]).toEqual(['/api/wm/stock-transfers', { query: { documentNo: 'TRO', status: 'DRAFT', offset: 20, limit: 20 }, scope: 'factory' }])
})

it('lets the server resolve an absent target stock from the destination and source identity', () => {
  const command = transferCommand({ createRequestId: 'original', reason: '调拨', items: [{ sourceStockId: '9007199254740999', targetStockId: null, targetWarehouseId: '9007199254740998', targetBinCode: ' 0001 ', quantity: '0.000001', materialId: 'forged', unitId: 'forged', batchNo: 'forged' }] })
  expect(command.items[0]).toEqual({ sourceStockId: '9007199254740999', targetStockId: null, targetWarehouseId: '9007199254740998', targetBinCode: ' 0001 ', quantity: '0.000001', remark: undefined })
  const empty = transferCommand({ items: [{ sourceStockId: '1', targetStockId: '', targetWarehouseId: '2', targetBinCode: '', quantity: '1' }] })
  expect(empty.items[0]!.targetStockId).toBeNull(); expect(empty.items[0]!.targetBinCode).toBeNull()
})
