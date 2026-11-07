import { beforeEach, expect, it, vi } from 'vitest'
import { getStockDocumentTypes, getStockDocumentTypesError } from '../src/lib/stockDocumentTypes'
import { clearDictionaries } from '../src/utils/dictionaries'
import { useStockDocumentTypes } from '../src/composables/useStockDocumentTypes'
import { flushPromises } from '@vue/test-utils'
const mocks = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('../src/lib/request', () => ({ request: mocks.request }))
beforeEach(() => {
  vi.clearAllMocks()
  clearDictionaries()
})
it('reads direction dictionaries once across consumers and preserves dictionary labels and order', async() => {
  mocks.request.mockImplementation((url: string) => Promise.resolve({ data: url.endsWith('_in_type')
    ? [{ dictValue: 'OTHER_RECEIPT', dictLabel: '自定义其他入库' }, { dictValue: 'PURCHASE_RECEIPT', dictLabel: '采购收货' }]
    : [{ dictValue: 'OTHER_ISSUE', dictLabel: '自定义出库' }] }))
  getStockDocumentTypes('IN')
  getStockDocumentTypes('IN')
  getStockDocumentTypes('OUT')
  await flushPromises()
  expect(getStockDocumentTypes('IN').map(v => v.label)).toEqual(['自定义其他入库', '采购收货'])
  expect(getStockDocumentTypes('OUT')[0]?.label).toBe('自定义出库')
  expect(mocks.request.mock.calls.map(([url]) => url)).toEqual(['/api/common/dict/stock_document_in_type', '/api/common/dict/stock_document_out_type'])
  const reader = useStockDocumentTypes()
  await reader.load('IN')
  expect(reader.label('PURCHASE_RECEIPT')).toBe('采购收货')
  expect(reader.label('UNKNOWN')).toBe('类型待确认')
  await reader.load('OUT')
  expect(reader.types.value.map(type => type.direction)).toEqual(['OUT'])
  await reader.load(['IN', 'OUT'])
  expect(reader.label('PURCHASE_RECEIPT')).toBe('采购收货')
})
it('exposes dictionary failures without a hardcoded document name and can retry', async() => {
  mocks.request.mockRejectedValueOnce(new Error('字典读取失败'))
  getStockDocumentTypes('IN')
  await flushPromises()
  expect(getStockDocumentTypesError('IN')).toBe('字典读取失败')
  mocks.request.mockResolvedValueOnce({ data: [{ dictValue: 'PURCHASE_RECEIPT', dictLabel: '采购入库' }] })
  getStockDocumentTypes('IN')
  await flushPromises()
  expect(getStockDocumentTypesError('IN')).toBe('')
  expect(getStockDocumentTypes('IN')[0]?.label).toBe('采购入库')
})
it('rejects a late response after dictionary invalidation', async() => {
  let release!: (value: unknown) => void
  mocks.request.mockImplementationOnce(() => new Promise(resolve => {
    release = resolve
  }))
  getStockDocumentTypes('IN')
  clearDictionaries()
  mocks.request.mockResolvedValueOnce({ data: [{ dictValue: 'PURCHASE_RECEIPT', dictLabel: '当前名称' }] })
  getStockDocumentTypes('IN')
  await flushPromises()
  release({ data: [{ dictValue: 'PURCHASE_RECEIPT', dictLabel: '旧名称' }] })
  await flushPromises()
  expect(getStockDocumentTypes('IN')[0]?.label).toBe('当前名称')
})
