import { expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { synchronizeMenuRoutes } from '../src/lib/dynamicRoutes'

it('removes retired master data routes even when navigation still returns their old menus', () => {
  const router = createRouter({ history: createMemoryHistory(), routes: [] })
  const installed = new Set<string>()
  const catalog = import.meta.glob('/src/views/**/index.vue')
  const menu = (path: string, component: string) => ({ id: path, path, component, name: 'TEST ONLY', permission: 'read', kind: 'MENU', children: [] })
  const retired = [menu('/basic/mdWorkshop', 'md/mdWorkshop/index'), menu('/basic/mdUnitMeasure', 'md/mdUnitMeasure/index')]
  synchronizeMenuRoutes(router, retired, {
    '/src/views/md/mdWorkshop/index.vue': async() => ({}),
    '/src/views/md/mdUnitMeasure/index.vue': async() => ({})
  }, installed)
  expect(router.hasRoute('generated:/basic/mdWorkshop')).toBe(true)
  synchronizeMenuRoutes(router, [...retired, menu('/basic/workshop', 'basic/workshop/index'), menu('/basic/unitMeasure', 'basic/unitMeasure/index')], catalog, installed)
  expect(router.hasRoute('generated:/basic/mdWorkshop')).toBe(false)
  expect(router.hasRoute('generated:/basic/mdUnitMeasure')).toBe(false)
  expect(router.hasRoute('generated:/basic/workshop')).toBe(true)
  expect(router.hasRoute('generated:/basic/unitMeasure')).toBe(true)
})
