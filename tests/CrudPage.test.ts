import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { routeLocationKey } from 'vue-router'
import ElementPlus from 'element-plus';import { useAuth } from '../src/stores/auth'
import CrudPage from '../src/components/CrudPage.vue'
const fields = [{ key: 'id', label: '标识', kind: 'text', readonly: true }, { key: 'code', label: '编码', kind: 'text', required: true }, { key: 'name', label: '名称', kind: 'text', required: true }] as const
function api() { return { list: vi.fn().mockResolvedValue({ items: [{ id: '9007199254740993', code: 'TEST', name: 'TEST ONLY' }], total: 1, offset: 0, limit: 20 }), create: vi.fn(), update: vi.fn(), remove: vi.fn() } }
beforeEach(() => { setActivePinia(createPinia());vi.stubGlobal('ResizeObserver', class {observe() {}unobserve() {}disconnect() {}}) })
describe('shared CRUD view', () => {
  it('loads rows and hides write buttons without grants', async() => { const pinia = createPinia();const auth = useAuth(pinia);auth.factoryPermissions = ['test:read'];const target = api();const wrapper = mount(CrudPage, { props: { title: '合成配置', permission: 'test', api: target, fields: [...fields] }, global: { plugins: [pinia, ElementPlus] }});await flushPromises();expect(wrapper.text()).toContain('TEST ONLY');expect(wrapper.text()).not.toContain('新增');expect(target.list).toHaveBeenCalledWith({ offset: 0, limit: 20 });wrapper.unmount() })
  it('shows safe error and clears old records when reload fails', async() => { const pinia = createPinia();useAuth(pinia).factoryPermissions = ['test:read'];const target = api();target.list.mockRejectedValue(new Error('当前范围没有此操作权限'));const wrapper = mount(CrudPage, { props: { title: '合成配置', permission: 'test', api: target, fields: [...fields] }, global: { plugins: [pinia, ElementPlus] }});await flushPromises();expect(wrapper.text()).toContain('当前范围没有此操作权限');expect(wrapper.text()).toContain('暂无记录');wrapper.unmount() })
})

describe('list response contract', () => {
  it('reports invalid response rather than silently displaying an empty table', async() => {
    const pinia = createPinia();useAuth(pinia).factoryPermissions = ['test:read']
    const target = { ...api(), list: vi.fn().mockResolvedValue({ rows: [{ id: '1' }], total: 1 }) }
    const wrapper = mount(CrudPage, { props: { title: 'TEST ONLY', permission: 'test', api: target, fields: [...fields] }, global: { plugins: [pinia, ElementPlus] }})
    await flushPromises()
    expect(wrapper.find('.el-alert').text()).toContain('列表响应格式无效')
    wrapper.unmount()
  })
})

describe('one permission per CRUD action', () => {
  function page(grants: string[]) {
    const pinia = createPinia(), auth = useAuth(pinia)
    auth.factoryPermissions = grants.map(action => 'test:' + action)
    const target = { ...api(), delids: vi.fn().mockResolvedValue(undefined) }
    const wrapper = mount(CrudPage, { props: { title: '合成配置', permission: 'test', api: target, fields: [...fields] }, global: { plugins: [pinia, ElementPlus] }})
    return { wrapper, auth, target }
  }

  it.each([
    ['create', '新增'], ['update', '编辑'], ['delete', '删除']
  ])('renders only the matching write action for %s', async(action, label) => {
    const { wrapper } = page(['read', action]);await flushPromises()
    const buttons = wrapper.findAll('button').map(button => button.text())
    for (const candidate of ['新增', '编辑', '删除', '批量删除']) {
      expect(buttons.includes(candidate)).toBe(candidate === label || action === 'delete' && candidate === '批量删除')
    }
    expect(buttons).toContain('查询')
    wrapper.unmount()
  })

  it('does not use write as a wildcard and does not load without read', async() => {
    const { wrapper, target } = page(['write']);await flushPromises()
    expect(target.list).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('当前范围没有读取权限')
    expect(wrapper.text()).not.toContain('暂无记录')
    const buttons = wrapper.findAll('button').map(button => button.text())
    for (const label of ['查询', '新增', '编辑', '删除', '批量删除', '刷新']) expect(buttons).not.toContain(label)
    wrapper.unmount()
  })

  it('updates buttons and clears rows when grants change without a scope revision', async() => {
    const { wrapper, auth } = page(['read', 'create']);await flushPromises()
    expect(wrapper.text()).toContain('新增')
    auth.factoryPermissions = ['test:read', 'test:delete'];await flushPromises()
    expect(wrapper.text()).not.toContain('新增')
    expect(wrapper.text()).toContain('批量删除')
    auth.factoryPermissions = [];await flushPromises()
    expect(wrapper.text()).not.toContain('TEST ONLY')
    expect(wrapper.text()).not.toContain('查询')
    wrapper.unmount()
  })
})

describe('generated query field metadata', () => {
  it('uses declared business query fields rather than only literal code/name keys', async() => {
    const pinia = createPinia();useAuth(pinia).factoryPermissions = ['test:read']
    const target = api()
    const wrapper = mount(CrudPage, { props: {
      title: '工单', permission: 'test', api: target,
      fields: [
        { key: 'workorderCode', label: '工单编码', kind: 'text', searchable: true },
        { key: 'unitOfMeasure', label: '单位', kind: 'text', searchable: false }
      ]
    }, global: { plugins: [pinia, ElementPlus] }})
    await flushPromises()
    expect(wrapper.findAll('.filter-panel input')).toHaveLength(1)
    await wrapper.find('.filter-panel input').setValue('WO-001')
    await wrapper.find('.filter-panel').trigger('submit')
    await flushPromises()
    expect(target.list).toHaveBeenLastCalledWith({ offset: 0, limit: 20, workorderCode: 'WO-001' })
    wrapper.unmount()
  })
})

describe('CRUD scope follows menu URL prefixes', () => {
  it.each([
    ['/system/config', 'platform'], ['/tool/build', 'platform'],
    ['/monitor/job', 'platform'], ['/pro/proWorkorder', 'factory'],
    ['/systematic/config', 'factory']
  ])('uses the correct permission source for %s', async(path, scope) => {
    const pinia = createPinia(), auth = useAuth(pinia)
    const grants = ['business:test:read', 'business:test:create']
    auth.platformPermissions = scope === 'platform' ? grants : ['business:test:delete']
    auth.factoryPermissions = scope === 'factory' ? grants : ['business:test:delete']
    const target = api()
    const wrapper = mount(CrudPage, { props: {
      title: 'Scope fixture', permission: 'business:test', api: target, fields: [...fields]
    }, global: { plugins: [pinia, ElementPlus], provide: { [routeLocationKey as symbol]: { path }}}})
    await flushPromises()
    expect(target.list).toHaveBeenCalled()
    const buttons = wrapper.findAll('button').map(button => button.text())
    expect(buttons).toContain('新增')
    expect(buttons).not.toContain('删除')
    expect(buttons).not.toContain('批量删除')
    wrapper.unmount()
  })
})
