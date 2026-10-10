import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'
import Home from '../src/views/Home.vue'
import { useAuth } from '../src/stores/auth'
const global = { stubs: {
  PageHeader: { props: ['title'], template: '<header><h1>{{ title }}</h1><slot /></header>' },
  PlatformWorkspace: { emits: ['previewBusiness'], template: '<button @click="$emit(\'previewBusiness\')">查看业务工作台示例</button>' },
  BusinessWorkspace: { props: ['factoryName'], template: '<div class="business-fixture">示例数据 {{ factoryName }}</div>' },
  ScopeTag: true, 'el-alert': { props: ['title'], template: '<div>{{ title }}</div>' }, 'el-icon': true,
  'el-radio-group': { template: '<div><slot /></div>' }, 'el-radio-button': true, 'el-button': { template: '<button><slot /></button>' },
  'el-empty': true, RouterLink: true
}}
beforeEach(() => { localStorage.clear();setActivePinia(createPinia()) })
describe('role aware Home and clearly separated sample preview', () => {
  it('uses platform business grants on the selected factory without a factory role', async() => {
    const auth = useAuth()
    auth.workspaceAccess = { platform: true, platformBusiness: true, factoryIds: [] }
    auth.factoryId = 'F';auth.factories = [{ factoryId: 'F', name: '工厂 F' }]
    const wrapper = mount(Home, { global })
    expect(wrapper.find('h1').text()).toBe('业务工作台')
    expect(wrapper.find('.business-fixture').text()).toContain('工厂 F')
    expect(wrapper.text()).not.toContain('当前工厂没有')
    auth.factoryId = '';auth.revision++;await nextTick()
    expect(wrapper.text()).toContain('尚未选择工厂')
    wrapper.unmount()
  })
  it('keeps a platform-only account on the platform workbench, with a read-only sample preview', async() => {
    const auth = useAuth();auth.workspaceAccess = { platform: true, platformBusiness: false, factoryIds: [] }
    const wrapper = mount(Home, { global })
    expect(wrapper.find('h1').text()).toBe('平台工作台')
    await wrapper.find('button').trigger('click')
    expect(wrapper.find('h1').text()).toBe('业务工作台示例')
    expect(wrapper.text()).toContain('示例数据')
    expect(auth.factoryId).toBe('');expect(auth.factoryPermissions).toEqual([])
    await wrapper.find('button').trigger('click')
    expect(wrapper.find('h1').text()).toBe('平台工作台');wrapper.unmount()
  })
  it('defaults dual scopes to business without automatically selecting a factory', () => {
    const auth = useAuth();auth.workspaceAccess = { platform: true, platformBusiness: false, factoryIds: ['F'] };auth.factories = [{ factoryId: 'F', name: '工厂 F' }]
    const wrapper = mount(Home, { global })
    expect(wrapper.find('h1').text()).toBe('业务工作台');expect(wrapper.text()).toContain('尚未选择工厂')
    expect(wrapper.find('.business-fixture').text()).toContain('演示工厂');expect(auth.factoryId).toBe('');wrapper.unmount()
  })
  it('clears preview and selected-factory context when roles are revoked', async() => {
    const auth = useAuth();auth.workspaceAccess = { platform: true, platformBusiness: false, factoryIds: ['F'] };auth.factoryId = 'F';auth.factories = [{ factoryId: 'F', name: '工厂 F' }]
    const wrapper = mount(Home, { global });expect(wrapper.find('.business-fixture').text()).toContain('工厂 F')
    auth.workspaceAccess = { platform: true, platformBusiness: false, factoryIds: [] };auth.revision++;await nextTick()
    expect(wrapper.find('h1').text()).toBe('平台工作台');expect(wrapper.find('.business-fixture').exists()).toBe(false);wrapper.unmount()
  })
})
