import { beforeEach, describe, expect, it, vi } from 'vitest'
import { executePendingBomBuild, pendingBomBuildKey, restorePendingBomBuild, type BomBuildSource, type PendingBomBuild } from './pendingBomBuild'

const key = pendingBomBuildKey('user-7', 'factory-3')
const source: BomBuildSource = { productId: '3040701', bomId: '51', plannedQty: '12' }
const pending = (requestId = 'request-1'): PendingBomBuild => ({ version: 1, source,
  confirmation: { requestId, fingerprint: 'fp-1', orders: [{ path: 'ROOT', ruleCode: 'WO', routingId: null, plannedStartAt: null, plannedEndAt: null, remark: '' }] }})

describe('pending BOM build confirmation', () => {
  beforeEach(() => localStorage.clear())

  it('persists the complete request before sending and preserves it after a network timeout', async() => {
    const send = vi.fn(async() => {
      expect(JSON.parse(localStorage.getItem(key)!).confirmation.requestId).toBe('request-1')
      throw new Error('network timeout')
    })
    await expect(executePendingBomBuild(localStorage, key, pending(), send)).rejects.toThrow('network timeout')
    expect(restorePendingBomBuild(localStorage, key).pending).toEqual(pending())
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('restores after a page reload and retries the same request identity and full content', async() => {
    await expect(executePendingBomBuild(localStorage, key, pending(), async() => { throw new Error('timeout') })).rejects.toThrow()
    const restored = restorePendingBomBuild(localStorage, key).pending!
    const send = vi.fn(async(retrySource: BomBuildSource, confirmation: PendingBomBuild['confirmation']) => ({ retrySource, confirmation }))
    const result = await executePendingBomBuild(localStorage, key, restored, send)
    expect(result).toEqual({ retrySource: source, confirmation: pending().confirmation })
    expect(send).toHaveBeenCalledWith(source, pending().confirmation)
    expect(localStorage.getItem(key)).toBeNull()
  })

  it('allows duplicate delivery with the same key and payload, but blocks a different payload under that pending key', async() => {
    await expect(executePendingBomBuild(localStorage, key, pending(), async() => { throw new Error('timeout') })).rejects.toThrow()
    const restored = restorePendingBomBuild(localStorage, key).pending!
    const send = vi.fn(async() => 'replayed')
    await expect(executePendingBomBuild(localStorage, key, { ...pending('new-key'), source: { ...source, plannedQty: '13' }}, send))
      .rejects.toThrow('已有结果未确认')
    await expect(executePendingBomBuild(localStorage, key, restored, send)).resolves.toBe('replayed')
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('does not treat equal product, BOM and quantity as the same new operation after success', async() => {
    const send = vi.fn(async() => 'created')
    await executePendingBomBuild(localStorage, key, pending('request-1'), send)
    await executePendingBomBuild(localStorage, key, pending('request-2'), send)
    expect(send).toHaveBeenCalledTimes(2)
    expect(localStorage.getItem(key)).toBeNull()
  })
})
