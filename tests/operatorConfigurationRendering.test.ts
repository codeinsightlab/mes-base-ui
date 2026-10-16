import { expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import Panel from '../src/components/business/production/OperatorConfiguration.vue'
import { useAuth } from '../src/stores/auth'
const relations = vi.hoisted(() => ({ list: vi.fn().mockResolvedValue({ items: [{ id: '1', userId: '100' }], total: 1 }) }))
const config = vi.hoisted(() => ({ users: vi.fn() }))
vi.mock('../src/api/production/operatorConfiguration', () => ({ operatorConfiguration: config }))
vi.mock('../src/api/production/mesOperationUser', () => ({ api: relations }))
it('renders the saved user name when directory labels arrive after the relation list', async() => {
 vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
 let release!: (value: unknown) => void
 config.users.mockImplementation(() => new Promise(resolve => { release = resolve }))
 const pinia = createPinia(), auth = useAuth(pinia)
 auth.factoryId = 'A'; auth.factoryPermissions = ['business:mes:operation:user:list']
 const wrapper = mount(Panel, { props: { operationId: '7' }, global: { plugins: [pinia, ElementPlus] } })
 try {
  await wrapper.find('button').trigger('click'); await flushPromises()
  release({ items: [{ id: '100', name: '平台管理员' }], total: 1 }); await flushPromises()
  expect(document.body.querySelector('.el-table__body')?.textContent).toContain('平台管理员（100）')
  expect(relations.list).toHaveBeenCalledTimes(1)
 } finally { wrapper.unmount(); document.body.innerHTML = ''; vi.unstubAllGlobals() }
})
