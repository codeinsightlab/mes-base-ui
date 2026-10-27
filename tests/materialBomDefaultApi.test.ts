import { expect, it, vi } from 'vitest'

const { request } = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('../src/lib/request', () => ({ request }))
import { defaultBom } from '../src/api/basic/materialBom'

it('normalizes an empty successful response to an explicit no-default value', async() => {
  request.mockResolvedValue(undefined)
  await expect(defaultBom('8')).resolves.toBeNull()
  expect(request).toHaveBeenCalledWith('/api/basic/material-bom/default', { query: { productId: '8' }, scope: 'factory' })
})
