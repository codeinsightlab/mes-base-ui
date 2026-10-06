import { describe, expect, it } from 'vitest'
import { availableWorkspaces, defaultWorkspace } from '../src/lib/workspaces'
import { sampleOrders, sampleSummary } from '../src/lib/businessWorkspaceSample'
describe('workspace selection from server role scopes', () => {
  it('defaults dual and factory scopes to business, platform-only to platform', () => {
    expect(defaultWorkspace({ platform: true, factoryIds: ['F'] })).toBe('business')
    expect(availableWorkspaces({ platform: true, factoryIds: ['F'] }).map(item => item.value)).toEqual(['business', 'platform'])
    expect(defaultWorkspace({ platform: false, factoryIds: ['F'] })).toBe('business')
    expect(defaultWorkspace({ platform: true, factoryIds: [] })).toBe('platform')
    expect(availableWorkspaces({ platform: true, factoryIds: [] }).map(item => item.value)).toEqual(['platform'])
  })
  it('does not infer a workspace for missing or empty role scopes', () => {
    expect(defaultWorkspace(null)).toBe('personal')
    expect(defaultWorkspace({ platform: false, factoryIds: [] })).toBe('personal')
    expect(availableWorkspaces(null)).toEqual([])
  })
  it('keeps sample production totals consistent and explicitly names every order as a demo', () => {
    for (const order of sampleOrders) {
      expect(order.code).toMatch(/^DEMO-/)
      expect(order.accepted).toBeLessThanOrEqual(order.completed)
      expect(order.completed).toBeLessThanOrEqual(order.planned)
    }
    expect(sampleSummary.planned).toBe(2160)
    expect(sampleSummary.completed).toBe(1640)
    expect(sampleSummary.accepted).toBe(1596)
  })
})
