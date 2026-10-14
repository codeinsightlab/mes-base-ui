import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import { useAuth } from '../src/stores/auth'
import WorkOrder from '../src/views/production/workorder/index.vue'
import ExecutionList from '../src/components/business/production/ProductionExecutionList.vue'
import CrudPage from '../src/components/CrudPage.vue'
const wo = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn(), create: vi.fn(), update: vi.fn(), release: vi.fn(), remove: vi.fn(), routings: vi.fn(), allocation: vi.fn() }))
const executions = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), delids: vi.fn() }))
vi.mock('../src/api/production/workorder', () => ({ api: wo }))
vi.mock('../src/api/production/mesProductionExecution', () => ({ api: executions }))
vi.mock('../src/api/basic/material', () => ({ api: { list: vi.fn().mockResolvedValue({ items: [{ id: '1', code: 'P1', name: '产品一' }] }) } }))
const allocation = { workorderId: '1', plannedQty: '1000.000000', allocatedTargetQty: '1300.000000', remainingTargetQty: '-300.000000', excessTargetQty: '300.000000', executionCount: 2 }
const order = { id: '1', code: 'WO1', productId: '1', routingId: '1', plannedQty: '1000', status: 'DRAFT', revision: 0 }
const detail = () => ({ workorder: order, productCode: 'P1', productName: '产品一', routing: { id: '1', code: 'R1', version: 1 }, allocation, batches: [{ id: '7', batchNo: 'LEGACY_ONLY', plannedQty: '1000', routeStatus: 'LOCKED', path: [{ routingNodeId: '99', executionOrder: 1 }] }] })
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  for (const method of Object.values(wo)) method.mockReset()
  wo.list.mockResolvedValue({ items: [{ workorder: order, productCode: 'P1', productName: '产品一', routingCode: 'R1', routingVersion: 1, allocation }], total: 1 })
  wo.detail.mockResolvedValue(detail())
  wo.routings.mockResolvedValue([{ id: '1', code: 'R1', name: '发布版本', version: 1 }])
  executions.list.mockReset().mockResolvedValue({ items: [], total: 0, offset: 0, limit: 20 })
})
function setup(permissions: string[]) {
  const pinia = createPinia(), auth = useAuth(pinia)
  auth.factoryId = 'A'; auth.factoryPermissions = permissions
  return { auth, global: { plugins: [pinia, ElementPlus] } }
}
describe('single active execution chain', () => {
  it('shows signed allocation and historical batches as read-only, with execution list permission required', async() => {
    const c = setup(['workorder:list', 'workorder:query']), w = mount(WorkOrder, { global: c.global })
    await flushPromises()
    expect(w.text()).toContain('-300.000000')
    expect(w.text()).toContain('默认工艺')
    await w.findAll('button').find(b => b.text() === '详情 / 执行')!.trigger('click')
    await flushPromises()
    expect(w.text()).toContain('旧批次与已选路径（历史只读）')
    expect(w.text()).toContain('当前账号没有生产执行列表权限')
    for (const text of ['新增工单', '编辑', '删除', '重新选择', '保存完整路径']) expect(w.findAll('button').map(b => b.text())).not.toContain(text)
    expect(executions.list).not.toHaveBeenCalled()
    w.unmount()
  })
  it('opens a demand form with no batch array or path step and saves the exact demand', async() => {
    const c = setup(['workorder:list', 'workorder:create']), w = mount(WorkOrder, { global: c.global })
    await flushPromises(); await w.findAll('button').find(b => b.text() === '新增工单')!.trigger('click'); await flushPromises()
    const state = w.vm as unknown as { form: Record<string, unknown>; save: () => Promise<void> }
    expect(state.form).not.toHaveProperty('batches')
    expect(document.body.textContent).not.toContain('添加批次')
    Object.assign(state.form, { code: 'WO_NEW', productId: '1', routingId: '1', plannedQty: '1000.000001' })
    wo.create.mockResolvedValue(detail()); await state.save(); await flushPromises()
    expect(wo.create).toHaveBeenCalled()
    expect(wo.create.mock.calls[0]![0]).not.toHaveProperty('batches')
    expect(wo.create.mock.calls[0]![0].plannedQty).toBe('1000.000001')
    w.unmount()
  })
  it('binds execution queries and creates to the selected workorder using existing CRUD', async() => {
    const c = setup(['business:mes:production:execution:list', 'business:mes:production:execution:query']), w = mount(ExecutionList, { props: { workorderId: '9007199254740993', embedded: true }, global: c.global })
    await flushPromises()
    expect(executions.list).toHaveBeenCalledWith(expect.objectContaining({ workorderId: '9007199254740993' }))
    expect(w.findComponent(CrudPage).props('fixedValues')).toEqual({ workorderId: '9007199254740993' })
    expect(w.text()).toContain('实际工艺版本 ID')
    w.unmount()
  })
  it('rejects late workorder details after factory switch', async() => {
    let release!: (v: unknown) => void
    wo.detail.mockImplementationOnce(() => new Promise(r => { release = r }))
    const c = setup(['workorder:list', 'workorder:query']), w = mount(WorkOrder, { global: c.global })
    await flushPromises(); await w.findAll('button').find(b => b.text() === '详情 / 执行')!.trigger('click')
    c.auth.factoryId = 'B'; c.auth.revision++; await flushPromises()
    release({ ...detail(), productName: '过期工厂生产需求' }); await flushPromises()
    expect(w.text()).not.toContain('过期工厂生产需求')
    w.unmount()
  })
})
