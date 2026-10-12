// TEST ONLY: generated page, real CrudPage/API, synthetic HTTP responses; no live ERP/database.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus, { ElMessageBox } from 'element-plus'
import type { MessageBoxData } from 'element-plus'
import Material from '../src/views/material/material/index.vue'
import { useAuth } from '../src/stores/auth'
import { configureRequests } from '../src/lib/request'

afterEach(() => {
  vi.restoreAllMocks(); vi.unstubAllGlobals()
  configureRequests(() => ({ token: '', factoryId: '', revision: 0 }), () => {})
})
describe('Material generated page and synchronization', () => {
  it('binds current factory, refreshes the real list after sync, and leaves CRUD rendering intact', async() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
    vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue('confirm' as MessageBoxData)
    const fetch = vi.fn().mockImplementation(async(path: string) => new Response(JSON.stringify(
      path.endsWith('/actions/sync') ? { fetched: 2, created: 2, updated: 0, skipped: 0 }
        : { items: [{ id: '9007199254740993', code: 'M001', name: 'TEST ONLY', unit: 'PCS', status: 'ENABLED' }],
          total: 1, offset: 0, limit: 20 }
    ), { status: 200, headers: { 'Content-Type': 'application/json' }}))
    vi.stubGlobal('fetch', fetch)
    const pinia = createPinia(), auth = useAuth(pinia)
    auth.factoryPermissions = ['business:material:list', 'business:material:sync']
    configureRequests(() => ({ token: '', factoryId: 'TEST_ONLY_A', revision: 0 }), () => {})
    const wrapper = mount(Material, { global: { plugins: [pinia, ElementPlus] }})
    try {
      await flushPromises()
      const sync = wrapper.findAll('button').find(button => button.text() === '同步')!
      expect(sync.exists()).toBe(true)
      await sync.trigger('click'); await flushPromises()
      expect(fetch.mock.calls.filter(call => call[0].includes('?offset='))).toHaveLength(2)
      const request = fetch.mock.calls.find(call => call[0].endsWith('/actions/sync'))!
      expect(request[0]).toBe('/api/material/material/actions/sync')
      expect(request[1].method).toBe('POST')
      expect(request[1].headers.get('X-Factory-Id')).toBe('TEST_ONLY_A')
      expect(request[1].body).toBeUndefined()
      expect(wrapper.text()).toContain('M001')
      expect(wrapper.text()).toContain('9007199254740993')
    } finally { wrapper.unmount() }
  })
})

describe('Material detail loading', () => {
  it('loads edit and read-only detail from the ID endpoint instead of reusing list fields', async() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
    const id = '9007199254740993'
    const fetch = vi.fn().mockImplementation(async(path: string) => new Response(JSON.stringify(
      path === '/api/material/material/' + id
        ? { id, code: 'M001', name: 'DETAIL ONLY', unitId: '1', materialType: 'ITEM', status: 'ENABLED' }
        : { items: [{ id, code: 'M001', name: 'STALE LIST' }], total: 1, offset: 0, limit: 20 }
    ), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetch)
    const pinia = createPinia(), auth = useAuth(pinia)
    auth.factoryPermissions = ['business:material:list', 'business:material:query', 'business:material:update']
    configureRequests(() => ({ token: '', factoryId: 'TEST_ONLY_A', revision: 0 }), () => {})
    const wrapper = mount(Material, { global: { plugins: [pinia, ElementPlus], stubs: { teleport: true, ElSelect: true, ElOption: true } } })
    try {
      await flushPromises()
      expect(wrapper.text()).toContain('STALE LIST')
      await wrapper.findAll('button').find(button => button.text().replaceAll(' ', '') === '编辑')!.trigger('click')
      await flushPromises()
      expect(fetch.mock.calls.filter(call => call[0] === '/api/material/material/' + id)).toHaveLength(1)
      expect(wrapper.findAllComponents({ name: 'ElInput' })
        .some(input => input.props('modelValue') === 'DETAIL ONLY')).toBe(true)
      await wrapper.findAll('button').find(button => button.text() === '取消')!.trigger('click')
      await flushPromises()
      await wrapper.findAll('button').find(button => button.text() === '详情')!.trigger('click')
      await flushPromises()
      expect(fetch.mock.calls.filter(call => call[0] === '/api/material/material/' + id)).toHaveLength(2)
      expect(wrapper.text()).toContain('DETAIL ONLY')
      auth.revision++
      await flushPromises()
      expect(wrapper.findAllComponents({ name: 'ElDialog' }).every(dialog => !dialog.props('modelValue'))).toBe(true)
    } finally { wrapper.unmount() }
  })
})
