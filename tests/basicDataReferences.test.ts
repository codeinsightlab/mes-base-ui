import { describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { defineComponent } from 'vue'
import { useAuth } from '../src/stores/auth'
import { useBasicDataReferences } from '../src/lib/basicDataReferences'
import type { CrudApi, Page } from '../src/lib/crud'

describe('factory reference options', () => {
  it('reloads when navigation permissions arrive and ignores the previous factory response', async() => {
    const pinia = createPinia(), auth = useAuth(pinia)
    let release!: (value: Page) => void
    const list = vi.fn().mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
      .mockResolvedValue({ items: [{ id: '2', code: 'B', name: '当前工厂单位' }], total: 1, offset: 0, limit: 100 })
    const api: CrudApi = { list, create: vi.fn(), update: vi.fn(), remove: vi.fn() }
    const wrapper = mount(defineComponent({ setup() { return useBasicDataReferences(api, 'business:unit:measure') }, template: '<div>{{ options }}</div>' }), { global: { plugins: [pinia] } })
    expect(list).not.toHaveBeenCalled()
    auth.factoryPermissions = ['business:unit:measure:list']
    await flushPromises()
    expect(list).toHaveBeenCalledTimes(1)
    auth.factoryPermissions = []
    auth.revision++
    await flushPromises()
    auth.factoryPermissions = ['business:unit:measure:list']
    await flushPromises()
    release({ items: [{ id: '1', code: 'A', name: '旧工厂单位' }], total: 1, offset: 0, limit: 100 })
    await flushPromises()
    expect(wrapper.text()).toContain('当前工厂单位')
    expect(wrapper.text()).not.toContain('旧工厂单位')
    wrapper.unmount()
  })
})
