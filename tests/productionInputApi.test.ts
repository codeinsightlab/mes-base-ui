import { beforeEach, expect, it, vi } from 'vitest'
const request = vi.hoisted(() => vi.fn())
vi.mock('../src/lib/request', () => ({ request, requestBlob: request }))
import { productionInput } from '../src/api/production/productionInput'
import { productionCombination } from '../src/api/production/productionCombination'
beforeEach(() => request.mockReset())
it('keeps a confirmed set quantity and UUID in the MES command', async() => {
  const command = { requestId: 'r', code: 'WO1:B#B01$C#C01', outputQty: '50', routingId: '1', routingNodeIds: ['11'], calculationKey: 'key' }
  await productionInput.submit(command)
  expect(request).toHaveBeenCalledExactlyOnceWith('/api/production/input', { method: 'POST', body: command, scope: 'factory' })
})
it('omits an absent quantity so the server supplies the current maximum', async() => {
  await productionCombination.calculate('WO1:B#B01$C#C01')
  expect(request).toHaveBeenCalledExactlyOnceWith('/api/production/combinations/calculate', { query: { code: 'WO1:B#B01$C#C01' }, scope: 'factory' })
})
it('generates in the selected factory without an inventory reservation parameter', async() => {
  await productionCombination.generate('1', '80')
  expect(request).toHaveBeenCalledExactlyOnceWith('/api/production/combinations', { method: 'POST', body: { workorderId: '1', quantity: '80' }, scope: 'factory' })
})
