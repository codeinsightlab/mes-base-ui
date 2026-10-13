// TEST ONLY: shared CrudPage/request; no server/database access.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import CrudPage from '../src/components/CrudPage.vue'
import { request } from '../src/lib/request'
import type { CrudApi, Field } from '../src/lib/crud'
const api: CrudApi = {
  list: query => request('/api/pro/pro-workorder', { query }),
  create: vi.fn(), update: vi.fn(), remove: vi.fn()
}
const props = { title: 'TEST ONLY', permission: 'business:pro:workorder', api, idKey: 'workorderId',
  fields: [{ key: 'workorderId', label: '编号', kind: 'text' }, { key: 'workorderCode', label: '编码', kind: 'text' },
    { key: 'workorderName', label: '名称', kind: 'text' }, { key: 'quantity', label: '数量', kind: 'number' }] as Field[] }

import { useAuth } from '../src/stores/auth'
import { configureRequests } from '../src/lib/request'

afterEach(() => { vi.unstubAllGlobals();configureRequests(() => ({ token: '', factoryId: '', revision: 0 }), () => {}) })
describe('Shared CRUD list response', () => {
  it('renders nonempty items through the request contract without response fallbacks', async() => {
    vi.stubGlobal('ResizeObserver', class {observe() {}unobserve() {}disconnect() {}})
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [{ workorderId: '9007199254740993', workorderCode: 'TEST-WO-001',
        workorderName: 'TEST ONLY workorder', quantity: 12.5 }],
      total: 1, offset: 0, limit: 20
    }), { status: 200, headers: { 'Content-Type': 'application/json' }}))
    vi.stubGlobal('fetch', fetch)
    const pinia = createPinia(), auth = useAuth(pinia)
    auth.factoryPermissions = ['business:pro:workorder:read']
    configureRequests(() => ({ token: '', factoryId: 'TEST-ONLY', revision: 0 }), () => {})
    const wrapper = mount(CrudPage, { props, global: { plugins: [pinia, ElementPlus] }})
    try {
      await flushPromises()
      expect(fetch).toHaveBeenCalledOnce()
      expect(fetch.mock.calls[0][0]).toBe('/api/pro/pro-workorder?offset=0&limit=20')
      expect(fetch.mock.calls[0][1].headers.get('X-Factory-Id')).toBe('TEST-ONLY')
      expect(wrapper.text()).toContain('TEST-WO-001')
      expect(wrapper.text()).toContain('TEST ONLY workorder')
      expect(wrapper.text()).toContain('9007199254740993')
      expect(wrapper.text()).toContain('12.5')
      expect(wrapper.findAll('.el-table__body tbody tr')).toHaveLength(1)
    } finally { wrapper.unmount() }
  })
})
