import { expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('../src/lib/request', async original => ({ ...await original<object>(), request: mocks.request }))
import { localStock } from '../src/api/wm/localStock'

it('routes production material returns through the production business entry point', async() => {
  const command = { requestId: '11111111-2222-4333-8444-555555555555', stockId: '1', quantity: '2', expectedQuantity: '10', expectedAvailable: '10', reason: '原领料错误', documentId: '9007199254740999', documentLineId: '8' }
  mocks.request.mockResolvedValue({})
  await localStock.execute('return', command)
  expect(mocks.request).toHaveBeenCalledExactlyOnceWith('/api/production/input/documents/9007199254740999/returns', { method: 'POST', body: command, scope: 'factory' })
})
