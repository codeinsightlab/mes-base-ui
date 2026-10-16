import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import { useAuth } from '../src/stores/auth'
import Lookup from '../src/components/business/production/ExecutionIdentityLookup.vue'
import Page from '../src/components/business/production/ProductionExecutionList.vue'

const resolve = vi.hoisted(() => vi.fn())
const api = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), delids: vi.fn() }))
vi.mock('../src/api/production/productionIdentity', () => ({ resolveProductionIdentity: resolve }))
vi.mock('../src/api/production/mesProductionExecution', () => ({ api }))
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  resolve.mockReset()
  api.list.mockReset().mockResolvedValue({ items: [{ id: '9007199254740993', executionNo: 'EXE-9007199254740993', workorderId: '1', routingId: '3', targetQty: '99999999999999.123456', status: 'READY' }], total: 1, offset: 0, limit: 20 })
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
    expect(wrapper.text()).toContain('EXE-9007199254740993')
    expect(wrapper.text()).toContain('99,999,999,999,999.123456')
    await wrapper.findAll('button').find(b => b.text() === '更多操作')!.trigger('click'); await flushPromises()
    const buttons = [...document.querySelectorAll('button'), ...wrapper.element.querySelectorAll('button')].map(b => b.textContent?.trim())
    expect(buttons).toContain('扫码查询')
    expect(buttons).toContain('身份码')
    for (const text of ['新增', '编辑', '删除', '同步']) expect(buttons).not.toContain(text)
    wrapper.unmount()
  })
  it('queries exact identity code and never calls CRUD mutations', async() => {
    resolve.mockResolvedValue({ executionId: '9007199254740993', qrCode: 'EXE:9007199254740993', executionNo: 'EXE-9007199254740993', productName: '验收产品', routingVersion: 2 })
    const context = setup(), wrapper = mount(Lookup, { props: { id: '9007199254740993' }, global: context.global })
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(resolve).toHaveBeenCalledWith('EXE:9007199254740993')
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
