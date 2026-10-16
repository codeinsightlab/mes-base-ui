import { expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import router from '../src/router'
import { useAuth } from '../src/stores/auth'

it('preserves workorder, execution and hash when login restoration installs the initial dynamic route', async() => {
 setActivePinia(createPinia())
 const auth = useAuth()
 auth.token = 'TEST_ONLY'
 const restore = vi.spyOn(auth, 'restoreSession').mockImplementation(async() => {
  if (!router.hasRoute('TEST_ONLY_REPORT')) router.addRoute({
   name: 'TEST_ONLY_REPORT', path: '/production/productionReport', component: { template: '<p>数量管理</p>' }
  })
 })
 try {
  await router.push('/production/productionReport?executionId=90&workorderId=77#nodes')
  expect(router.currentRoute.value.name).toBe('TEST_ONLY_REPORT')
  expect(router.currentRoute.value.query).toEqual({ executionId: '90', workorderId: '77' })
  expect(router.currentRoute.value.hash).toBe('#nodes')
 } finally { router.removeRoute('TEST_ONLY_REPORT'); restore.mockRestore() }
})
