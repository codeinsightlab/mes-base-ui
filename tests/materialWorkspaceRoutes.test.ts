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
