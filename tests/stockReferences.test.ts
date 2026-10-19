import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import { useAuth } from '../src/stores/auth'
import MaterialSelect from '../src/components/business/MaterialSelect.vue'
import WarehouseSelect from '../src/components/business/WarehouseSelect.vue'
import Inventory from '../src/views/wm/wmInventory/index.vue'

const material = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn() }))
const warehouse = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn() }))
const stock = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), delids: vi.fn() }))
vi.mock('../src/api/basic/material', () => ({ api: material }))
vi.mock('../src/api/wm/wmWarehouse', () => ({ api: warehouse }))
vi.mock('../src/api/wm/wmInventory', () => ({ api: stock, sync: vi.fn() }))
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  material.list.mockReset().mockResolvedValue({ items: [], total: 0 })
  warehouse.list.mockReset().mockResolvedValue({ items: [], total: 0 })
  stock.list.mockReset().mockResolvedValue({ items: [], total: 0, offset: 0, limit: 20 })
})
describe('stock reference selection', () => {
  it.each([[MaterialSelect, material, 'business:material'], [WarehouseSelect, warehouse, 'business:wm:warehouse']] as const)(
    'clears references on factory switch and rejects a late result', async(component, api, permission) => {
      const pinia = createPinia(), auth = useAuth(pinia)
      auth.factoryId = 'A'; auth.runtimeMode = 'LOCAL'
      auth.factoryPermissions = [permission + ':list', permission + ':query']
      let release!: (value: unknown) => void
      api.list.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
        .mockResolvedValue({ items: [{ id: '9007199254740993', code: 'B', name: '当前引用', source: 'LOCAL' }], total: 1 })
      api.detail.mockResolvedValue({ id: '9007199254740993', code: 'B', name: '当前引用', source: 'LOCAL' })
      const wrapper = mount(component, { props: { modelValue: '9007199254740993' }, global: { plugins: [pinia, ElementPlus] }})
      auth.factoryId = 'B'; auth.revision++
      await flushPromises()
      release({ items: [{ id: 'old', code: 'A', name: '过期引用' }], total: 1 })
      await flushPromises()
      const select = wrapper.findComponent({ name: 'ElSelect' })
      expect(select.props('disabled')).toBe(false)
      expect(wrapper.emitted('update:modelValue')).toContainEqual([null])
      expect(wrapper.html()).not.toContain('过期引用')
      auth.factoryPermissions = []
      await flushPromises()
      expect(select.props('disabled')).toBe(true)
      wrapper.unmount()
    }
  )
  it('filters warehouse sources and clears a selected identity when the source changes', async() => {
    const pinia = createPinia(), auth = useAuth(pinia)
    auth.factoryId = 'A'; auth.runtimeMode = 'LOCAL'
    auth.factoryPermissions = ['business:wm:warehouse:list', 'business:wm:warehouse:query']
    warehouse.list.mockResolvedValue({ items: [
      { id: '1', code: 'L', name: '本地仓', source: 'LOCAL' },
      { id: '2', code: 'E', name: '外部仓', source: 'EXTERNAL' }
    ], total: 2 })
    const wrapper = mount(WarehouseSelect, { props: { modelValue: null }, global: { plugins: [pinia, ElementPlus] } })
    await flushPromises()
    expect(warehouse.list).toHaveBeenLastCalledWith(expect.objectContaining({ source: 'LOCAL' }))
    expect((wrapper.vm as unknown as { rows: { id: string }[] }).rows.map(row => row.id)).toEqual(['1'])
    auth.runtimeMode = 'ERP'
    await flushPromises()
    expect(warehouse.list).toHaveBeenLastCalledWith(expect.objectContaining({ source: 'EXTERNAL' }))
    expect((wrapper.vm as unknown as { rows: { id: string }[] }).rows.map(row => row.id)).toEqual(['2'])
    auth.runtimeMode = null
    await flushPromises()
    expect(wrapper.findComponent({ name: 'ElSelect' }).props('disabled')).toBe(true)
    wrapper.unmount()
  })
  it('renders named quantities and hides sync with CRUD-only grants', async() => {
    const pinia = createPinia(), auth = useAuth(pinia)
    auth.factoryId = 'A'; auth.runtimeMode = 'LOCAL'
    auth.factoryPermissions = ['business:wm:inventory:list', 'business:wm:inventory:create', 'business:wm:inventory:update', 'business:wm:inventory:delete']
    stock.list.mockResolvedValue({ items: [{ id: '9007199254740993', materialName: '物料一', warehouseName: '一号仓', quantity: '12345678901234.1234', availableQuantity: null, status: 'ENABLED' }], total: 1, offset: 0, limit: 20 })
    const wrapper = mount(Inventory, { global: { plugins: [pinia, ElementPlus] }})
    await flushPromises()
    expect(wrapper.text()).toContain('物料一')
    expect(wrapper.text()).toContain('一号仓')
    expect(wrapper.text()).toContain('12,345,678,901,234.1234')
    expect(wrapper.findAll('button').map(b => b.text())).not.toContain('同步')
    auth.factoryPermissions.push('business:wm:inventory:sync'); auth.runtimeMode='ERP'
    await flushPromises()
    expect(wrapper.findAll('button').map(b => b.text())).toContain('同步')
    wrapper.unmount()
  })
})
