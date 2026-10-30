import { expect, it, vi } from 'vitest'
const { request } = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('../src/lib/request', () => ({ request }))
import { explodeBom } from '../src/api/basic/bomExplosion'
it('uses the implemented readonly factory API and preserves string identities and quantities', async() => {
  request.mockResolvedValue({ complete: false })
  const query = { materialCode: '000A', bomId: '9007199254740993', quantity: '123456789012.123456', versionOffset: 20, versionLimit: 20 }
  await explodeBom(query)
  expect(request).toHaveBeenCalledWith('/api/basic/material-bom/explode', { query, scope: 'factory' })
})
