import { describe, expect, it } from 'vitest'
import { isPlatformMenu, menuWorkspaces } from '../src/lib/menuWorkspaces'
import { routeMenus } from '../src/lib/sourceMenus'

describe('URL based menu workspaces', () => {
  it('matches only system, tool and monitor path segments', () => {
    for (const path of ['/system', '/system/role', '/tool', '/tool/gen', '/monitor', '/monitor/job']) {
      expect(isPlatformMenu(path)).toBe(true)
    }
    for (const path of ['/acceptance/person', '/production', '/systematic', '/toolbox', '/monitoring']) {
      expect(isPlatformMenu(path)).toBe(false)
    }
  })

  it('groups by resolved URLs regardless of the authorization source and preserves metadata', () => {
    const platformSource = routeMenus([
      { path: 'acceptance', children: [{ path: 'person', component: 'acceptance/person/index', query: '{"from":"menu"}' }] },
      { path: 'system', children: [{ path: 'role', hidden: true }] }
    ])
    const factorySource = routeMenus([
      { path: 'monitor', children: [{ path: 'job' }] },
      { path: 'tool', children: [{ path: 'gen' }] }
    ])
    const before = JSON.stringify([platformSource, factorySource])
    const result = menuWorkspaces(platformSource, factorySource)
    expect(result.platform.map(menu => menu.path)).toEqual(['/system', '/monitor', '/tool'])
    expect(result.factory.map(menu => menu.path)).toEqual(['/acceptance'])
    expect(result.factory[0]?.children[0]).toMatchObject({
      path: '/acceptance/person', component: 'acceptance/person/index', query: '{"from":"menu"}'
    })
    expect(result.platform[0]?.children[0]?.hidden).toBe(true)
    expect(JSON.stringify([platformSource, factorySource])).toBe(before)
  })

  it('merges duplicate modules and keeps every authorized child', () => {
    const result = menuWorkspaces(
      routeMenus([{ path: 'system', children: [{ path: 'role' }] }]),
      routeMenus([{ path: 'system', children: [{ path: 'role' }, { path: 'user' }] }])
    )
    expect(result.platform).toHaveLength(1)
    expect(result.platform[0]?.children.map(menu => menu.path)).toEqual(['/system/role', '/system/user'])
  })

  it('moves absolute child URLs to their own workspace without leaving empty directories', () => {
    const result = menuWorkspaces(routeMenus([
      { path: 'system', children: [{ path: '/acceptance/person' }] },
      { path: 'production', children: [{ path: '/monitor/job' }] }
    ]))
    expect(result.platform.map(menu => menu.path)).toEqual(['/monitor/job'])
    expect(result.factory.map(menu => menu.path)).toEqual(['/acceptance/person'])
  })
})
