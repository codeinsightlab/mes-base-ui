import { beforeEach, expect, it, vi } from 'vitest'
import { api as materialApi } from '../src/api/basic/material'
import { api as unitApi } from '../src/api/basic/unitMeasure'
import { quantityRuleRevision } from '../src/lib/production/quantityRuleInvalidation'
const request = vi.hoisted(() => vi.fn())
vi.mock('../src/lib/request', () => ({ request }))
beforeEach(() => request.mockReset())
it.each([materialApi, unitApi])('invalidates loaded quantity rules only after a successful configuration update', async api => {
  const revision = quantityRuleRevision.value
  request.mockRejectedValueOnce(new Error('write failed'))
  await expect(api.update('1', {})).rejects.toThrow('write failed')
  expect(quantityRuleRevision.value).toBe(revision)
  request.mockResolvedValueOnce({ id: '1' })
  await api.update('1', {})
  expect(quantityRuleRevision.value).toBe(revision + 1)
})
