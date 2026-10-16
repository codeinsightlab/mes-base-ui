import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import WorkOrders from '../src/views/production/workorder/index.vue'
import { useAuth } from '../src/stores/auth'
const { list, routings, materials } = vi.hoisted(() => ({ list: vi.fn(), routings: vi.fn(), materials: vi.fn() }))
vi.mock('../src/api/production/workorder', () => ({ api: { list, routings } }))
vi.mock('../src/api/basic/material', () => ({ api: { list: materials } }))
type State = { create: () => void; form: { productId: string; routingId: string }; productChanged: () => void; searchRoutes: (s?: string) => Promise<void>; routeOptions: { id: string }[]; routesLoading: boolean; dialog: boolean }
let wrapper: ReturnType<typeof mount>
beforeEach(() => {
 vi.resetAllMocks(); vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
 list.mockResolvedValue({ items: [], total: 0 }); materials.mockResolvedValue({ items: [], total: 0 }); routings.mockResolvedValue([])
})
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = '' })
async function setup() {
 const pinia = createPinia(), auth = useAuth(pinia); auth.factoryId = 'A'; auth.factoryPermissions = ['workorder:list', 'workorder:create', 'workorder:query']
 wrapper = mount(WorkOrders, { global: { plugins: [pinia, ElementPlus] } }); await flushPromises()
 const state = wrapper.vm as unknown as State; state.create(); await flushPromises(); return { state, auth }
}
it('requires a product before choosing its published routes without restricting the output material type', async() => {
 const { state } = await setup(); await state.searchRoutes()
 expect(routings).not.toHaveBeenCalled(); expect(materials).toHaveBeenCalledWith({ name: '', status: 'ENABLED', limit: 100 })
 const selects = wrapper.findAllComponents({ name: 'ElSelect' })
 expect(selects.find(s => s.props('placeholder') === '请先选择产出物料')?.props('disabled')).toBe(true)
 state.form.productId = '101'; await state.searchRoutes('装配')
 expect(routings).toHaveBeenCalledWith('101', '装配')
})
it('clears the old selected route immediately and ignores responses from the previous product', async() => {
 const { state } = await setup()
 let release!: (v: unknown) => void
 routings.mockImplementationOnce(() => new Promise(r => { release = r })).mockResolvedValueOnce([{ id: '202' }])
 state.form.productId = '101'; const pending = state.searchRoutes(); state.form.routingId = '201'
 state.form.productId = '102'; state.productChanged()
 expect(state.form.routingId).toBe(''); expect(state.routeOptions).toEqual([])
 await flushPromises(); release([{ id: '201' }]); await pending
 expect(state.routeOptions).toEqual([{ id: '202' }]); expect(state.routesLoading).toBe(false)
})
it.each(['close', 'factory', 'permission'])('rejects a late route response after %s', async(change) => {
 const { state, auth } = await setup(); let release!: (v: unknown) => void
 routings.mockImplementationOnce(() => new Promise(r => { release = r }))
 state.form.productId = '101'; const pending = state.searchRoutes()
 if (change === 'close') state.dialog = false
 if (change === 'factory') auth.factoryId = 'B'
 if (change === 'permission') auth.factoryPermissions = []
 await flushPromises(); release([{ id: '201' }]); await pending
 expect(state.routeOptions).toEqual([]); expect(state.routesLoading).toBe(false)
})

it('queries on product selection, auto-selects the only match, and leaves multiple matches unselected', async() => {
 const { state } = await setup()
 routings.mockResolvedValueOnce([{ id: '201' }]).mockResolvedValueOnce([{ id: '301' }, { id: '302' }])
 state.form.productId = '101'; state.productChanged()
 expect(routings).toHaveBeenLastCalledWith('101', '')
 await flushPromises(); expect(state.form.routingId).toBe('201')
 state.form.productId = '102'; state.productChanged(); expect(state.form.routingId).toBe('')
 await flushPromises(); expect(state.form.routingId).toBe(''); expect(state.routeOptions).toHaveLength(2)
 routings.mockResolvedValueOnce([{ id: '301' }]); await state.searchRoutes('关键字')
 expect(state.form.routingId).toBe('')
})
