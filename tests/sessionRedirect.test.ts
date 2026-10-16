import { expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import ElementPlus from 'element-plus'
import * as icons from '@element-plus/icons-vue'
import App from '../src/App.vue'
import { useAuth } from '../src/stores/auth'
import { configureRequests, request, requestStream } from '../src/lib/request'
import { SESSION_KEY } from '../src/lib/sessionStorage'

it.each(['ordinary', 'streaming'])('redirects the current session to login after a %s request returns 401', async mode => {
 const pinia = createPinia(), auth = useAuth(pinia)
 auth.token = 'TEST_ONLY'; auth.factoryId = 'A'; auth.sessionReady = true; auth.persistSession()
 configureRequests(() => ({ token: auth.token, factoryId: auth.factoryId, revision: auth.revision }), () => auth.clear())
 const router = createRouter({ history: createMemoryHistory(), routes: [
  { path: '/secured', component: { template: '<p>受保护页面</p>' } },
  { path: '/login', component: { template: '<p>登录页</p>' } }
 ] })
 await router.push('/secured'); await router.isReady()
 const fetcher = vi.fn().mockResolvedValue(new Response('{"errorCode":"UNAUTHENTICATED"}', { status: 401 }))
 vi.stubGlobal('fetch', fetcher)
 const wrapper = mount(App, { global: { plugins: [pinia, router, ElementPlus], components: icons } })
 try {
  expect(router.currentRoute.value.path).toBe('/secured')
  await expect(mode === 'streaming' ? requestStream('/api/personal/inbox/events') : request('/api/session/info')).rejects.toMatchObject({ status: 401 })
  await flushPromises()
  expect(auth.token).toBe('')
  expect(localStorage.getItem(SESSION_KEY)).toBeNull()
  expect(router.currentRoute.value.path).toBe('/login')
  expect(wrapper.text()).toContain('登录页')
  expect(fetcher).toHaveBeenCalledTimes(1)
 } finally { wrapper.unmount(); vi.unstubAllGlobals() }
})
