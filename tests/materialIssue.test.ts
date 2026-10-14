import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import { useAuth } from '../src/stores/auth'
import Header from '../src/views/issue/mesMaterialIssue/index.vue'
import Document from '../src/components/document/MasterDetailDocument.vue'
import CrudPage from '../src/components/CrudPage.vue'

const header = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), delids: vi.fn() }))
const item = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), delids: vi.fn() }))
vi.mock('../src/api/issue/mesMaterialIssue', () => ({ api: header }))
vi.mock('../src/api/issue/mesMaterialIssueItem', () => ({ api: item }))
const parent = '9007199254740993'
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  vi.clearAllMocks()
  header.list.mockResolvedValue({ items: [{ id: parent, issueNo: 'QA', status: 'RECORDED' }], total: 1, offset: 0, limit: 20 })
  header.detail.mockResolvedValue({ id: parent, issueNo: 'QA', status: 'RECORDED' })
  item.list.mockResolvedValue({ items: [{ id: '9', issueId: parent, materialCode: 'M', batchNo: '自由/批次', quantity: '99999999999999.123456' }], total: 1, offset: 0, limit: 20 })
})
function setup(actions = ['list', 'query']) {
  const pinia = createPinia(), auth = useAuth(pinia)
  auth.factoryId = 'A'
  auth.factoryPermissions = [
    ...actions.map(a => 'business:mes:material:issue:' + a),
    ...actions.map(a => 'business:mes:material:issue:item:' + a)
  ]
  const wrapper = mount(Header, { global: { plugins: [pinia, ElementPlus], stubs: { MaterialSelect: true, WarehouseSelect: true }}})
  return { wrapper, auth }
}
async function open(wrapper: ReturnType<typeof setup>['wrapper']) {
  await flushPromises()
  await wrapper.findAll('button').find(b => b.text() === '打开单据')!.trigger('click')
  await flushPromises()
}
describe('master detail material issue document', () => {
  it('opens a single document and reads only its lines, preserving ID and decimal strings', async() => {
    const { wrapper } = setup()
    await open(wrapper)
    expect(item.list).toHaveBeenLastCalledWith(expect.objectContaining({ issueId: parent, offset: 0, limit: 20 }))
    expect(wrapper.text()).toContain('主单信息')
    expect(wrapper.text()).toContain('单据明细')
    expect(wrapper.text()).toContain('99,999,999,999,999.123456')
    expect(wrapper.text()).toContain('自由/批次')
    expect(wrapper.findAll('button').some(b => ['新增', '保存主单', '删除主单', '编辑'].includes(b.text()))).toBe(false)
    wrapper.unmount()
  })
  it('never lists unbound lines before a new parent is saved', async() => {
    const { wrapper } = setup(['list', 'query', 'create'])
    await flushPromises()
    await wrapper.findAll('button').find(b => b.text() === '新增单据')!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('先保存主单')
    expect(item.list).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('rejects late parent detail after changing factory', async() => {
    let release!: (value: unknown) => void
    header.detail.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
    const { wrapper, auth } = setup()
    await flushPromises()
    await wrapper.findAll('button').find(b => b.text() === '打开单据')!.trigger('click')
    auth.factoryId = 'B'; auth.revision++
    await flushPromises()
    release({ id: parent, issueNo: '过期工厂资料' })
    await flushPromises()
    expect(wrapper.text()).not.toContain('过期工厂资料')
    expect(item.list).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('fixes parent query and create command even if a child draft supplies another parent', async() => {
    const { wrapper } = setup(['list', 'query', 'create', 'update'])
    await open(wrapper)
    const lines = wrapper.findAllComponents(CrudPage).find(c => c.props('embedded'))!
    const vm = lines.vm as unknown as { open(): Promise<void>; draft: Record<string, unknown>; save(): Promise<void> }
    await vm.open()
    Object.assign(vm.draft, { issueId: 'forged-parent', materialId: '1', quantity: '0.123456' })
    item.create.mockResolvedValue({ id: '10' })
    await vm.save()
    expect(item.create).toHaveBeenLastCalledWith(expect.objectContaining({ issueId: parent, quantity: '0.123456' }))
    expect(lines.props('fixedValues')).toEqual({ issueId: parent })
    wrapper.unmount()
  })
  it('does not apply a late successful save after the context changed', async() => {
    let release!: (value: unknown) => void
    header.update.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
    const { wrapper, auth } = setup(['list', 'query', 'update'])
    await open(wrapper)
    const doc = wrapper.findComponent(Document)
    const saving = (doc.vm as unknown as { save(): Promise<void> }).save()
    auth.revision++; auth.factoryId = 'B'
    await flushPromises()
    release({ id: parent, issueNo: '过期保存结果' })
    await saving; await flushPromises()
    expect(wrapper.text()).not.toContain('过期保存结果')
    expect(wrapper.text()).not.toContain('主单信息')
    wrapper.unmount()
  })
})
