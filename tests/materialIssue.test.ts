import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { defineComponent, h, KeepAlive, ref } from 'vue'
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
  const router = createRouter({history:createMemoryHistory(),routes:[{path:'/',component:{template:'<div />'}}]})
  const wrapper = mount(Header, { global: { plugins: [pinia, ElementPlus, router], stubs: { MaterialSelect: true, WarehouseSelect: true }}})
  return { wrapper, auth, router }
}
async function open(wrapper: ReturnType<typeof setup>['wrapper']) {
  await flushPromises()
  await wrapper.findAll('button').find(b => b.text() === '打开单据')!.trigger('click')
  await flushPromises()
}
describe('master detail material issue document', () => {
  it('returns to the issue list when re-entering the cached inventory verification entry', async() => {
    const pinia=createPinia(),auth=useAuth(pinia)
    auth.factoryId='A';auth.factoryPermissions=['business:mes:material:issue:list','business:mes:material:issue:query','business:mes:material:issue:item:list']
    const router=createRouter({history:createMemoryHistory(),routes:[{path:'/issue/mesMaterialIssue',component:{template:'<div />'}}]})
    await router.push({path:'/issue/mesMaterialIssue',query:{view:'list'}})
    const shown=ref(true)
    const wrapper=mount(defineComponent({setup:()=>()=>h(KeepAlive,null,{default:()=>shown.value?h(Header):null})}),{global:{plugins:[pinia,ElementPlus,router],stubs:{MaterialSelect:true,WarehouseSelect:true}}})
    await open(wrapper)
    expect(wrapper.text()).toContain('主单信息')
    shown.value=false;await flushPromises();shown.value=true;await flushPromises()
    expect(wrapper.text()).not.toContain('主单信息')
    expect(wrapper.findAll('button').some(b=>b.text()==='打开单据')).toBe(true)
    expect(header.update).not.toHaveBeenCalled();expect(header.remove).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('opens the exact linked issue and keeps factory changes from reopening the old ID',async()=>{
    const {wrapper,router,auth}=setup(); await router.push({path:'/',query:{issueId:parent}});await flushPromises();
    expect(header.detail).toHaveBeenCalledWith(parent);expect(wrapper.text()).toContain('主单信息');
    const count=header.detail.mock.calls.length;auth.factoryId='B';auth.revision++;await flushPromises();
    expect(header.detail).toHaveBeenCalledTimes(count);expect(wrapper.text()).not.toContain('主单信息');wrapper.unmount()
  })
  it('opens a single document and reads only its lines, preserving ID and decimal strings', async() => {
    const { wrapper } = setup()
    await open(wrapper)
    expect(item.list).toHaveBeenLastCalledWith(expect.objectContaining({ issueId: parent, offset: 0, limit: 20 }))
    expect(wrapper.text()).toContain('主单信息')
    expect(wrapper.text()).toContain('单据明细')
    expect(wrapper.text()).toContain('99999999999999.12')
    expect(wrapper.text()).toContain('自由/批次')
    expect(wrapper.findAll('button').some(b => ['新增', '保存主单', '删除主单', '编辑'].includes(b.text()))).toBe(false)
    wrapper.unmount()
  })
  it('directs new issues to the formal BOM draft flow and never creates an unbound legacy parent', async() => {
    const { wrapper } = setup(['list', 'query', 'create'])
    await flushPromises()
    expect(wrapper.findAll('button').some(b => b.text() === '新增单据')).toBe(false)
    expect(wrapper.text()).toContain('按BOM与库存来源保存正式出库草稿')
    expect(item.list).not.toHaveBeenCalled();expect(header.create).not.toHaveBeenCalled()
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
  it('keeps legacy header and lines read only even for a user with edit permissions', async() => {
    const { wrapper } = setup(['list', 'query', 'create', 'update'])
    await open(wrapper)
    const lines = wrapper.findAllComponents(CrudPage).find(c => c.props('embedded'))!
    expect(lines.props('readonly')).toBe(true)
    expect(lines.props('fixedValues')).toEqual({ issueId: parent })
    expect(wrapper.findAll('button').some(b => ['保存主单', '新增', '编辑'].includes(b.text()))).toBe(false)
    expect(item.create).not.toHaveBeenCalled();expect(header.update).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('does not invoke old saves and clears the read-only document when scope changes', async() => {
    const { wrapper, auth } = setup(['list', 'query', 'update'])
    await open(wrapper)
    const doc = wrapper.findComponent(Document)
    await (doc.vm as unknown as { save(): Promise<void> }).save()
    expect(header.update).not.toHaveBeenCalled()
    auth.revision++; auth.factoryId = 'B';await flushPromises()
    expect(wrapper.text()).not.toContain('主单信息')
    wrapper.unmount()
  })
})
