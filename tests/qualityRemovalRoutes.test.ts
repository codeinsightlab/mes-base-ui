import { expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { synchronizeMenuRoutes } from '../src/lib/dynamicRoutes'

it('removes obsolete quality routes while the real remaining page catalog stays routable', () => {
  const router = createRouter({ history: createMemoryHistory(), routes: [] })
  const installed = new Set<string>()
  const catalog = import.meta.glob('/src/views/**/index.vue')
  const menu = (path: string) => ({ id: path, path, name: 'TEST ONLY', permission: 'read', kind: 'MENU', children: [] })
  // A previously authorized route must disappear after navigation refresh.
  synchronizeMenuRoutes(router, [menu('/qc/qcIndex')], {
    '/src/views/qc/qcIndex/index.vue': async () => ({})
  }, installed)
  expect(router.hasRoute('generated:/qc/qcIndex')).toBe(true)
  synchronizeMenuRoutes(router, [menu('/basic/materials'), menu('/qc/qcIndex'), menu('/qc/qcDefect')], catalog, installed)
  expect(router.hasRoute('generated:/qc/qcIndex')).toBe(false)
  expect(router.hasRoute('generated:/qc/qcDefect')).toBe(false)
  expect(router.hasRoute('generated:/basic/materials')).toBe(true)
  expect(Object.keys(catalog).some(path => path.startsWith('/src/views/qc/'))).toBe(false)
})
