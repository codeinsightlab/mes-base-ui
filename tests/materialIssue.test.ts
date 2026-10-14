import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import { useAuth } from '../src/stores/auth'
import Header from '../src/views/issue/mesMaterialIssue/index.vue'
import Item from '../src/views/issue/mesMaterialIssueItem/index.vue'
import Details from '../src/components/business/issue/IssueRecordDetails.vue'

const header = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), delids: vi.fn() }))
const item = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), delids: vi.fn() }))
vi.mock('../src/api/issue/mesMaterialIssue', () => ({ api: header }))
vi.mock('../src/api/issue/mesMaterialIssueItem', () => ({ api: item }))
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  header.list.mockReset().mockResolvedValue({ items: [{ id: '9007199254740993', issueNo: 'QA', status: 'RECORDED' }], total: 1, offset: 0, limit: 20 })
  item.list.mockReset().mockResolvedValue({ items: [{ id: '9007199254740993', issueId: '1', materialCode: 'M', batchNo: '自由/批次', quantity: '99999999999999.123456' }], total: 1, offset: 0, limit: 20 })
  header.detail.mockReset()
  item.detail.mockReset()
})
describe('material issue administrative CRUD', () => {
  it.each([[Header, 'business:mes:material:issue'], [Item, 'business:mes:material:issue:item']] as const)(
    'allows detail with read grants and hides every mutation', async(component, prefix) => {
      const pinia = createPinia(), auth = useAuth(pinia)
      auth.factoryId = 'A'
      auth.factoryPermissions = [prefix + ':list', prefix + ':query']
      const wrapper = mount(component, { global: { plugins: [pinia, ElementPlus] }})
      await flushPromises()
      const buttons = wrapper.findAll('button').map(button => button.text())
      expect(buttons).toContain('详情')
      expect(buttons).not.toContain('新增')
      expect(buttons).not.toContain('编辑')
      expect(buttons).not.toContain('删除')
      expect(buttons).not.toContain('同步')
      if (component === Item) {
        expect(wrapper.text()).toContain('99,999,999,999,999.123456')
        expect(wrapper.text()).toContain('自由/批次')
      }
      wrapper.unmount()
    }
  )
  it('rejects late detail after a factory switch', async() => {
    const pinia = createPinia(), auth = useAuth(pinia)
    auth.factoryId = 'A'
    auth.factoryPermissions = ['business:mes:material:issue:query']
    let release!: (value: unknown) => void
    header.detail.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
    const wrapper = mount(Details, { props: { id: '1', api: header, fields: [{ key: 'issueNo', label: '单号', kind: 'text' }], permission: 'business:mes:material:issue:query' }, global: { plugins: [pinia, ElementPlus] }})
    await wrapper.find('button').trigger('click')
    auth.factoryId = 'B'
    auth.revision++
    await flushPromises()
    release({ id: '1', issueNo: '过期工厂资料' })
    await flushPromises()
    expect(wrapper.text()).not.toContain('过期工厂资料')
    wrapper.unmount()
  })
})
