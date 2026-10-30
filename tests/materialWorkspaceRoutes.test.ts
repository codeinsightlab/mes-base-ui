import { expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { synchronizeMenuRoutes } from '../src/lib/dynamicRoutes'
it('registers the unified material workspace and keeps category maintenance separate and retires the old material page', () => {
  const router = createRouter({ history: createMemoryHistory(), routes: [] })
  const catalog = import.meta.glob('/src/views/**/index.vue')
  const menu = (path:string) => ({ id: path, path, name: 'TEST ONLY', permission: '', kind: 'MENU', children: [] })
  synchronizeMenuRoutes(router, [menu('/basic/materials'), menu('/basic/material'), menu('/basic/materialCategory')], catalog, new Set())
  expect(router.hasRoute('generated:/basic/materials')).toBe(true)
  expect(router.hasRoute('generated:/basic/material')).toBe(false)
  expect(router.hasRoute('generated:/basic/materialCategory')).toBe(true)
})

it('keeps the readonly BOM explosion page reachable without a menu database migration', async() => {
  const { default: router } = await import('../src/router')
  expect(router.resolve('/basic/bom-explosion').matched.at(-1)?.meta.title).toBe('物料BOM展开')
})

it('registers and revokes the BOM explosion menu using its compiled component', async() => {
  const { default: menu } = await import('../src/menus/basic/bomExplosion.json')
  const router = createRouter({ history: createMemoryHistory(), routes: [] })
  const installed = new Set<string>()
  const catalog = import.meta.glob('/src/views/**/index.vue')
  synchronizeMenuRoutes(router, [menu], catalog, installed)
  expect(router.hasRoute('generated:/basic/bom-explosion')).toBe(true)
  expect(router.resolve(menu.path).matched.at(-1)?.meta.title).toBe(menu.name)
  synchronizeMenuRoutes(router, [], catalog, installed)
  expect(router.hasRoute('generated:/basic/bom-explosion')).toBe(false)
})
