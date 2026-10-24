import { beforeEach, expect, it, vi } from 'vitest'
import { productionClosure } from '../src/api/production/productionClosure'
import { qualityTreatment } from '../src/api/quality/qualityTreatment'
import { executionStatusLabel, executionStatusOptions } from '../src/lib/production/executionState'

const request = vi.hoisted(() => vi.fn())
vi.mock('../src/lib/request', () => ({ request }))
beforeEach(() => request.mockReset())

it('retired completion and return commands cannot be sent through active API adapters', () => {
  expect(productionClosure).not.toHaveProperty('execute')
  expect(productionClosure).not.toHaveProperty('release')
  expect(productionClosure).not.toHaveProperty('history')
  expect(() => qualityTreatment.dispose('d1', { requestId: 'old', destination: 'RETURN_NODE', warehouseId: null, quantity: '1', expectedRevision: 1, reason: '原请求' } as any)).toThrow('不良只办理正式入仓')
  expect(request).not.toHaveBeenCalled()
})

it('offers only the current execution states and preserves unknown values for diagnosis', () => {
  expect(executionStatusOptions.map(option => option.value)).toEqual(['READY', 'RUNNING', 'FULLY_RECEIVED', 'CANCELLED'])
  expect(executionStatusLabel('FULLY_RECEIVED')).toBe('完全入库')
  expect(executionStatusLabel('UNRECOGNIZED')).toBe('UNRECOGNIZED')
})

it('uses the dedicated receipt recheck endpoint without an old completion command or stock request', async() => {
  request.mockResolvedValueOnce({ receiptState: 'PARTIAL', blockedReason: '存在未决领料' })
  const summary = await productionClosure.recheckReceipt('9007199254740999')
  expect(request).toHaveBeenCalledExactlyOnceWith('/api/production/executions/9007199254740999/actions/recheck-receipt', { method: 'POST', scope: 'factory' })
  expect(summary.blockedReason).toBe('存在未决领料')
})
