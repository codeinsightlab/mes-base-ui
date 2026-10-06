import { nextTick, reactive } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SidebarNode from '../src/components/SidebarNode.vue'
const route = reactive({ path: '/' })
vi.mock('vue-router', () => ({ useRoute: () => route }))
const menu = { id: 'p', name: '生产管理', path: '/production', permission: '', kind: 'DIRECTORY', children: [{ id: 'q', name: '报工管理', path: '/reporting', permission: '', kind: 'DIRECTORY', children: [{ id: 'r', name: '报工列表', path: '/reports', permission: '', kind: 'PAGE', children: [] }] }] }
const global = { stubs: { 'el-icon': true, RouterLink: { props: ['to'], template: '<a><slot /></a>' }}}
beforeEach(() => { route.path = '/' })
describe('navigation expansion with future nested business menus', () => {
  it('starts inactive directories collapsed, then opens the current route ancestors', async() => {
    const wrapper = mount(SidebarNode, { props: { menu }, global })
    expect(wrapper.find('button').attributes('aria-expanded')).toBe('false')
    expect(wrapper.text()).not.toContain('报工列表')
    route.path = '/reports';await nextTick()
    expect(wrapper.find('button').attributes('aria-expanded')).toBe('true')
    expect(wrapper.text()).toContain('报工列表');wrapper.unmount()
  })
  it('delegates root toggles to the shell instead of opening roots independently', async() => {
    const wrapper = mount(SidebarNode, { props: { menu, root: true, expanded: false }, global })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('toggle')).toHaveLength(1)
    expect(wrapper.find('button').attributes('aria-expanded')).toBe('false')
    await wrapper.setProps({ expanded: true })
    expect(wrapper.find('button').attributes('aria-expanded')).toBe('true');wrapper.unmount()
  })
})
