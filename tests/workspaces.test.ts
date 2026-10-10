import { describe, expect, it } from 'vitest'
import { availableWorkspaces, defaultWorkspace, hasBusinessWorkspace } from '../src/lib/workspaces'
import { sampleOrders, sampleSummary } from '../src/lib/businessWorkspaceSample'
describe('workspace selection from server role scopes', () => {
  it('includes platform business grants without requiring a factory role', () => {
    const access = { platform: true, platformBusiness: true, factoryIds: [] }
    expect(availableWorkspaces(access).map(item => item.value)).toEqual(['business', 'platform'])
    expect(defaultWorkspace(access)).toBe('business')
    expect(hasBusinessWorkspace(access, 'F1')).toBe(true)
    expect(hasBusinessWorkspace(access, 'F2')).toBe(true)
    expect(hasBusinessWorkspace(access, null)).toBe(false)
    expect(hasBusinessWorkspace({ ...access, platformBusiness: false }, 'F1')).toBe(false)
    expect(hasBusinessWorkspace({ platform: false, platformBusiness: false, factoryIds: ['F1'] }, 'F2')).toBe(false)
  })
  it('defaults dual and factory scopes to business, platform-only to platform', () => {
    expect(defaultWorkspace({ platform: true, platformBusiness: false, factoryIds: ['F'] })).toBe('business')
    expect(availableWorkspaces({ platform: true, platformBusiness: false, factoryIds: ['F'] }).map(item => item.value)).toEqual(['business', 'platform'])
    expect(defaultWorkspace({ platform: false, platformBusiness: false, factoryIds: ['F'] })).toBe('business')
    expect(defaultWorkspace({ platform: true, platformBusiness: false, factoryIds: [] })).toBe('platform')
    expect(availableWorkspaces({ platform: true, platformBusiness: false, factoryIds: [] }).map(item => item.value)).toEqual(['platform'])
  })
  it('does not infer a workspace for missing or empty role scopes', () => {
    expect(defaultWorkspace(null)).toBe('personal')
    expect(defaultWorkspace({ platform: false, platformBusiness: false, factoryIds: [] })).toBe('personal')
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
