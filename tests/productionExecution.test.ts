import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import { useAuth } from '../src/stores/auth'
import Lookup from '../src/components/business/production/ExecutionIdentityLookup.vue'
import Page from '../src/components/business/production/ProductionExecutionList.vue'

const { resolve, scan } = vi.hoisted(() => ({ resolve: vi.fn(), scan: vi.fn() }))
vi.mock('../src/api/production/productionScan', () => ({ scanExecution: scan }))
const api = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), delids: vi.fn() }))
vi.mock('../src/api/production/productionIdentity', () => ({ readProductionIdentity: resolve }))
vi.mock('../src/api/production/mesProductionExecution', () => ({ api }))
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  resolve.mockReset();scan.mockReset()
  api.list.mockReset().mockResolvedValue({ items: [{ id: '9007199254740993', workorderId: '1', productId: '781234', productCode: 'P-001', routingId: '3', targetQty: '99999999999999.123456', status: 'READY' }], total: 1, offset: 0, limit: 20 })
})
function setup() {
  const pinia = createPinia(), auth = useAuth(pinia)
  auth.factoryId = 'A'
  auth.factoryPermissions = ['business:mes:production:execution:list', 'business:mes:production:execution:query']
  return { pinia, auth, global: { plugins: [pinia, ElementPlus] }}
}
describe('production execution identity', () => {
  it('read grants allow scanning and preserve decimal/ID precision while hiding mutations', async() => {
    const context = setup(), wrapper = mount(Page, { global: context.global })
    await flushPromises()
    expect(wrapper.text()).toContain('9007199254740993')
    expect(wrapper.text()).toContain('产出品号')
    expect(wrapper.text()).toContain('P-001')
    expect(wrapper.text()).not.toContain('781234')
    expect(wrapper.text()).not.toContain('产出产品 ID')
    expect(wrapper.text()).toContain('99999999999999.12')
    expect(wrapper.find('span[title="99999999999999.123456"]').exists()).toBe(true)
    await wrapper.findAll('button').find(b => b.text() === '更多操作')!.trigger('click'); await flushPromises()
    const buttons = [...document.querySelectorAll('button'), ...wrapper.element.querySelectorAll('button')].map(b => b.textContent?.trim())
    expect(buttons).toContain('扫码查询')
    expect(buttons).toContain('身份码')
    for (const text of ['新增', '编辑', '删除', '同步']) expect(buttons).not.toContain(text)
    wrapper.unmount()
  })
  it('queries exact identity code and never calls CRUD mutations', async() => {
    resolve.mockResolvedValue({ executionId: '9007199254740993', qrCode: 'WO001:P001#9007199254740993', batchNo: '9007199254740993', productName: '验收产品', routingVersion: 2 })
    const context = setup(), wrapper = mount(Lookup, { props: { id: '9007199254740993' }, global: context.global })
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(resolve).toHaveBeenCalledWith('9007199254740993');expect(scan).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('验收产品')
    for (const method of [api.create, api.update, api.remove, api.delids]) expect(method).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('clears error/results and rejects late responses on factory switch or permission loss', async() => {
    let release!: (value: unknown) => void
    resolve.mockImplementation(() => new Promise(r => { release = r }))
    const context = setup(), wrapper = mount(Lookup, { props: { id: '1' }, global: context.global })
    await wrapper.find('button').trigger('click')
    context.auth.factoryId = 'B'
    context.auth.revision++
    await flushPromises()
    release({ productName: '过期生产身份' })
    await flushPromises()
    expect(document.body.textContent).not.toContain('过期生产身份')
    context.auth.factoryPermissions = []
    await flushPromises()
    expect(wrapper.find('button').exists()).toBe(false)
    wrapper.unmount()
  })
  it('shows an explicit scan failure without producing a business action', async() => {
    resolve.mockRejectedValue(new Error('当前工厂未找到该生产执行身份'))
    const context = setup(), wrapper = mount(Lookup, { props: { id: '1' }, global: context.global })
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(document.body.textContent).toContain('当前工厂未找到该生产执行身份')
    expect(api.create).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})

it('routes scanner and manual code lookup through the shared audit function while showing the authoritative batch', async() => {
  scan.mockResolvedValue({ executionId: '9007199254740993', batchNo: 'BATCH-EXACT', productCode: 'PRODUCT', targetQty: '1' })
  const context = setup(), wrapper = mount(Lookup, { global: context.global })
  const state = (wrapper.vm.$ as unknown as { setupState: Record<string, any> }).setupState
  state.scanned(' WO:PRODUCT#BATCH ', 'IMAGE');await flushPromises()
  expect(scan).toHaveBeenCalledWith('EXECUTION_LOOKUP', ' WO:PRODUCT#BATCH ', 'IMAGE')
  expect(document.body.textContent).toContain('BATCH-EXACT');expect(resolve).not.toHaveBeenCalled()
  state.code = 'WO:PRODUCT#NEXT';await state.resolve()
  expect(scan).toHaveBeenLastCalledWith('EXECUTION_LOOKUP', 'WO:PRODUCT#NEXT', 'TEXT')
  wrapper.unmount()
})

it.each(['missing factory', 'switching'])('does not open or audit an identity lookup while %s', async mode => {
  const context = setup(), wrapper = mount(Lookup, { props: { id: '1' }, global: context.global })
  const state = (wrapper.vm.$ as unknown as { setupState: Record<string, any> }).setupState
  if (mode === 'missing factory')context.auth.factoryId = '';else context.auth.factorySwitching = true
  state.open();state.scanned('WO:PRODUCT#BATCH', 'TEXT')
  expect(state.allowed).toBe(false);expect(state.visible).toBe(false);expect(scan).not.toHaveBeenCalled();expect(resolve).not.toHaveBeenCalled()
  wrapper.unmount()
})
it.each(['factory', 'permission', 'switching', 'close', 'native close', 'unmount'])('invalidates an in-flight identity scan synchronously on %s', async mode => {
  let finish!:(value:unknown) => void;scan.mockImplementationOnce(() => new Promise(resolve => finish = resolve))
  const context = setup(), wrapper = mount(Lookup, { global: context.global })
  const state = (wrapper.vm.$ as unknown as { setupState: Record<string, any> }).setupState
  state.visible = true;state.code = 'WO:PRODUCT#BATCH';const wait = state.resolve()
  expect(scan).toHaveBeenCalledOnce();await flushPromises()
  if (mode === 'factory')context.auth.factoryId = 'B'
  else if (mode === 'permission')context.auth.factoryPermissions = []
  else if (mode === 'switching')context.auth.factorySwitching = true
  else if (mode === 'close')state.visible = false
  else if (mode === 'native close')wrapper.findAllComponents({ name: 'ElDialog' }).find(dialog => dialog.props('title') === '生产执行身份查询')!.props('beforeClose')!(vi.fn())
  else wrapper.unmount()
  expect(state.visible).toBe(false);expect(state.code).toBe('');expect(state.loading).toBe(false)
  finish({ executionId: 'old', batchNo: 'OLD-BATCH' });await wait
  expect(state.result).toBeNull();if (mode !== 'unmount')wrapper.unmount()
})

it('shows an execution with no historical batch as an ID and an ungenerated code', async() => {
  resolve.mockResolvedValueOnce({ executionId: '9007199254740993', batchNo: null, qrCode: null, productName: '历史产品' })
  const context = setup(), wrapper = mount(Lookup, { props: { id: '9007199254740993' }, global: context.global })
  await wrapper.get('button').trigger('click');await flushPromises()
  expect(resolve).toHaveBeenCalledExactlyOnceWith('9007199254740993');expect(scan).not.toHaveBeenCalled()
  expect(document.body.textContent).toContain('未生成（未记录批次）');expect(document.body.textContent).toContain('9007199254740993')
  wrapper.unmount()
})

it('keeps executions readable when a product code is not returned without substituting the internal ID', async() => {
  api.list.mockResolvedValueOnce({ items: [{ id: '1', workorderId: '1', productId: '781234', productCode: null, routingId: '3', targetQty: '1', status: 'READY' }], total: 1, offset: 0, limit: 20 })
  const context = setup(), wrapper = mount(Page, { global: context.global });await flushPromises()
  expect(wrapper.text()).toContain('品号未记录');expect(wrapper.text()).not.toContain('781234')
  wrapper.unmount()
})

it('creates executions through formal input even when the old create permission is still granted', async() => {
  const context = setup()
  context.auth.factoryPermissions.push('business:mes:production:execution:create', 'business:mes:material:issue:update')
  const wrapper = mount(Page, { global: context.global })
  await flushPromises()
  const buttons = wrapper.findAll('button').map(button => button.text())
  expect(buttons).not.toContain('新增')
  expect(buttons).toContain('正式领料创建执行')
  expect(api.create).not.toHaveBeenCalled()
  wrapper.unmount()
})
