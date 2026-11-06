import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ElMessageBox } from 'element-plus'
import type { Order } from '../src/api/production/workorder'
import { createPinia } from 'pinia'
import { defineComponent } from 'vue'
import ElementPlus from 'element-plus'
import WorkOrders from '../src/views/production/workorder/index.vue'
import { useAuth } from '../src/stores/auth'
const confirmed = Object.assign('confirm' as const, { value: '', action: 'confirm' as const })
const { list, routings, materials, recall, release, numberingRules } = vi.hoisted(() => ({ list: vi.fn(), routings: vi.fn(), materials: vi.fn(), recall: vi.fn(), release: vi.fn(), numberingRules: vi.fn() }))
vi.mock('../src/api/production/workorder', () => ({ api: { list, routings, recall, release, numberingRules }}))
vi.mock('../src/api/basic/material', () => ({ api: { list: materials }}))
type State = { create: () => void; form: { productId: string; routingId: string }; productChanged: (value: string) => Promise<void>; searchRoutes: (s?: string) => Promise<void>; routeOptions: { id: string }[]; routesLoading: boolean; dialog: boolean; hasPublishedRoutes: boolean | null }
let wrapper: ReturnType<typeof mount>
beforeEach(() => {
  vi.resetAllMocks(); vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  list.mockResolvedValue({ items: [], total: 0 }); materials.mockResolvedValue({ items: [], total: 0 }); routings.mockResolvedValue([]);numberingRules.mockResolvedValue([{ ruleCode: 'WO_RULE', ruleName: '工单', prefix: 'WO' }])
})
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = '' })
async function setup() {
  const pinia = createPinia(), auth = useAuth(pinia); auth.factoryId = 'A'; auth.factoryPermissions = ['workorder:list', 'workorder:create', 'workorder:query', 'business:material:list']
  wrapper = mount(WorkOrders, { global: { plugins: [pinia, ElementPlus], stubs: { WorkorderMaterialEditor: defineComponent({ setup(_, { expose }) { expose({ confirmReset: async() => true }); return () => null } }) }}}); await flushPromises()
  const state = wrapper.vm as unknown as State; state.create(); await flushPromises(); return { state, auth }
}
it('requires a product before choosing its published routes without restricting the output material type', async() => {
  const { state } = await setup(); await state.searchRoutes()
  expect(routings).not.toHaveBeenCalled(); expect(materials).toHaveBeenCalledWith({ keyword: '', status: 'ENABLED', offset: 0, limit: 20 })
  const selects = wrapper.findAllComponents({ name: 'ElSelect' })
  expect(selects.find(s => s.props('placeholder') === '请先选择产出物料')?.props('disabled')).toBe(true)
  state.form.productId = '101'; await state.searchRoutes('装配')
  expect(routings).toHaveBeenCalledWith('101', '装配')
})
it('clears the old selected route immediately and ignores responses from the previous product', async() => {
  const { state } = await setup()
  let release!: (v: unknown) => void, next!: (v: unknown) => void
  routings.mockImplementationOnce(() => new Promise(r => { release = r })).mockImplementationOnce(() => new Promise(r => { next = r }))
  state.form.productId = '101'; const pending = state.searchRoutes(); state.form.routingId = '201'
  await state.productChanged('102')
  expect(state.form.routingId).toBe(''); expect(state.routeOptions).toEqual([])
  next([{ id: '202' }]); await flushPromises(); release([{ id: '201' }]); await pending
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
  await state.productChanged('101')
  expect(routings).toHaveBeenLastCalledWith('101', '')
  await flushPromises(); expect(state.form.routingId).toBe('201')
  await state.productChanged('102'); expect(state.form.routingId).toBe('')
  await flushPromises(); expect(state.form.routingId).toBe(''); expect(state.routeOptions).toHaveLength(2)
  routings.mockResolvedValueOnce([{ id: '301' }]); await state.searchRoutes('关键字')
  expect(state.form.routingId).toBe('')
})

it('recognizes no-routing only after a successful unfiltered product lookup', async() => {
  const { state } = await setup()
  await state.productChanged('101');await flushPromises()
  expect(state.hasPublishedRoutes).toBe(false)
  expect(state.form.routingId).toBe('')
  routings.mockResolvedValueOnce([{ id: '201' }]);await state.productChanged('102');await flushPromises()
  expect(state.hasPublishedRoutes).toBe(true)
  routings.mockResolvedValueOnce([]);await state.searchRoutes('无匹配的过滤词')
  expect(state.hasPublishedRoutes).toBe(true)
  expect(state.form.routingId).toBe('201')
  routings.mockRejectedValueOnce(new Error('工艺查询失败'));await state.productChanged('103');await flushPromises()
  expect(state.hasPublishedRoutes).toBeNull()
})

it('returns a local released workorder to draft through the formal action and preserves its revision', async() => {
  const { auth } = await setup()
  auth.factoryPermissions = ['workorder:list', 'workorder:query', 'workorder:release']
  await flushPromises()
  const order = { id: '9007199254740993', code: 'TEST-RECALL', source: 'LOCAL', status: 'RELEASED', revision: 7 } as Order
  recall.mockResolvedValue({ workorder: { ...order, status: 'DRAFT', revision: 8 }})
  const confirm = vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue(confirmed)
  try {
    await (wrapper.vm as unknown as { recall: (row: Order) => Promise<void> }).recall(order)
    expect(recall).toHaveBeenCalledExactlyOnceWith('9007199254740993', 7)
    expect(list).toHaveBeenCalled()
  } finally { confirm.mockRestore() }
})

it('does not dispatch a late recall after factory selection changes during confirmation', async() => {
  const { auth } = await setup()
  auth.factoryPermissions = ['workorder:list', 'workorder:query', 'workorder:release']
  await flushPromises()
  let resolve!: (value: typeof confirmed) => void
  const confirm = vi.spyOn(ElMessageBox, 'confirm').mockImplementationOnce(() => new Promise(r => { resolve = r }))
  try {
    const pending = (wrapper.vm as unknown as { recall: (row: Order) => Promise<void> }).recall({ id: '40', code: 'TEST-RECALL', revision: 0 } as Order)
    auth.factoryId = 'B'; await flushPromises(); resolve(confirmed); await pending
    expect(recall).not.toHaveBeenCalled()
  } finally { confirm.mockRestore() }
})

it('explains unallocated execution quantity, removes excess allocation, and keeps a real negative remainder visible', async() => {
  list.mockResolvedValue({ items: [{ workorder: { id: '1', code: 'WO', plannedQty: '100', status: 'RELEASED' },
    allocation: { allocatedTargetQty: '110', remainingTargetQty: '-10', excessTargetQty: '10' }}], total: 1 })
  await setup()
  expect(wrapper.text()).toContain('未分配执行数量')
  expect(wrapper.findAllComponents({ name: 'ElTooltip' }).some(tip => tip.props('content') === '未分配执行数量＝计划数量－有效执行目标合计，不代表未完成量。')).toBe(true)
  expect(wrapper.text()).not.toContain('尚未分配')
  expect(wrapper.text()).not.toContain('超额分配')
  expect(wrapper.find('span[title="-10"]').text()).toBe('-10')
})

it('releases from the list with the original revision and blocks an external order', async() => {
  const { auth } = await setup()
  auth.runtimeMode = 'LOCAL'; auth.factoryPermissions = ['workorder:list', 'workorder:release']
  await flushPromises()
  const row = { id: '9007199254740993', code: 'WO', source: 'LOCAL', status: 'DRAFT', revision: 7 } as Order
  release.mockResolvedValue({ workorder: { ...row, status: 'RELEASED', revision: 8 }})
  const state = wrapper.vm as unknown as { release: (row: Order) => Promise<void> }
  await state.release(row)
  expect(release).toHaveBeenCalledExactlyOnceWith(row.id, 7)
  await state.release({ ...row, source: 'EXTERNAL' })
  expect(release).toHaveBeenCalledOnce()
})
