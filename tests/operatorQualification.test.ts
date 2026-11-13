import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { defineComponent } from 'vue'
import ElementPlus, { ElSwitch } from 'element-plus'
import { useAuth } from '../src/stores/auth'
import Panel from '../src/components/business/production/OperatorQualificationPanel.vue'
const api = vi.hoisted(() => ({ summary: vi.fn(), grant: vi.fn(), revoke: vi.fn() }))
const confirm = vi.hoisted(() => vi.fn())
vi.mock('../src/api/production/operatorQualification', () => ({ operatorQualification: api }))
vi.mock('../src/api/production/operatorConfiguration', () => ({ operatorConfiguration: { users: vi.fn().mockResolvedValue({ items: [], total: 0 }) }}))
vi.mock('../src/lib/searchOptionSettings', () => ({ loadSearchOptionLimit: vi.fn().mockResolvedValue(20), searchOptionLimit: { value: 20 }}))
vi.mock('../src/lib/pageMessageBox', () => ({ usePageMessageBox: () => ({ confirm }) }))
const Search = defineComponent({ emits: ['update:modelValue'], template: '<div><button @click="$emit(\'update:modelValue\', \'9007199254740993\')">选择人员</button><button @click="$emit(\'update:modelValue\', \'2\')">其他人员</button></div>' })
const state = (all = false, revision = 0, valid = true) => ({ userId: '9007199254740993', allOperations: all, revision, validUser: valid, explicitTotal: 1, enabledExplicitTotal: 1, operations: [{ operationId: '10', code: 'QA', name: '保留工序', status: 'ENABLED' }], offset: 0, limit: 20 })
const wrappers: ReturnType<typeof mount>[] = []
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('ResizeObserver', class {
    observe() {} disconnect() {} unobserve() {}
  })
  api.summary.mockResolvedValue(state())
  api.grant.mockResolvedValue(undefined)
  api.revoke.mockResolvedValue(undefined)
  confirm.mockResolvedValue('confirm')
})
afterEach(() => {
  wrappers.splice(0).forEach(w => w.unmount())
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

function setup(actions = ['list', 'create', 'delete']) {
  const pinia = createPinia(), auth = useAuth(pinia)
  auth.factoryId = 'A'
  auth.factoryPermissions = actions.map(action => 'business:mes:operation:user:' + action)
  const wrapper = mount(Panel, { global: { plugins: [pinia, ElementPlus], stubs: { SearchSelect: Search }}})
  wrappers.push(wrapper)
  return { wrapper, auth }
}

async function choose(wrapper: ReturnType<typeof mount>) {
  await wrapper.findAll('button')[0]!.trigger('click')
  await flushPromises()
}

describe('用户工序资格配置', () => {
  it('grants ALL with exact user ID and revision then refreshes the retained summary', async() => {
    const { wrapper } = setup()
    await choose(wrapper)
    expect(wrapper.text()).toContain('指定工序')
    expect(wrapper.text()).toContain('保留工序')
    api.summary.mockResolvedValue(state(true, 1))
    wrapper.findComponent(ElSwitch).vm.$emit('change', true)
    await flushPromises()
    expect(api.grant).toHaveBeenCalledWith('9007199254740993', 0)
    expect(api.summary).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('包括未来新增工序')
    expect(wrapper.text()).toContain('保留工序')
    expect(wrapper.emitted('changed')).toHaveLength(1)
  })
  it('confirms revocation and restores selected qualification without deleting relations', async() => {
    api.summary.mockResolvedValue(state(true, 5))
    const { wrapper } = setup()
    await choose(wrapper)
    api.summary.mockResolvedValue(state(false, 6))
    wrapper.findComponent(ElSwitch).vm.$emit('change', false)
    await flushPromises()
    expect(confirm.mock.calls[0]![0]).toContain('关闭后将恢复已配置的指定工序资格')
    expect(api.revoke).toHaveBeenCalledWith('9007199254740993', 5)
    expect(wrapper.text()).toContain('当前有效模式：指定工序')
    expect(wrapper.text()).toContain('保留工序')
  })
  it('read permission alone disables grants and revoked read permission clears the panel', async() => {
    const { wrapper, auth } = setup(['list'])
    await choose(wrapper)
    expect(wrapper.findComponent(ElSwitch).props('disabled')).toBe(true)
    wrapper.findComponent(ElSwitch).vm.$emit('change', true)
    await flushPromises()
    expect(api.grant).not.toHaveBeenCalled()
    auth.factoryPermissions = []
    await flushPromises()
    expect(wrapper.text()).not.toContain('保留工序')
    expect(wrapper.text()).toContain('没有工序资格查询权限')
  })
  it('allows revocation for an inactive target but cannot grant to it', async() => {
    api.summary.mockResolvedValue(state(true, 1, false))
    const { wrapper } = setup(['list', 'delete'])
    await choose(wrapper)
    expect(wrapper.findComponent(ElSwitch).props('disabled')).toBe(false)
    wrapper.findComponent(ElSwitch).vm.$emit('change', false)
    await flushPromises()
    expect(api.revoke).toHaveBeenCalledWith('9007199254740993', 1)
    expect(wrapper.text()).toContain('无资格（账号失效')
  })
  it('keeps stale revision failures visible and requires a refresh', async() => {
    const { wrapper } = setup()
    await choose(wrapper)
    api.grant.mockRejectedValue(new Error('配置冲突'))
    wrapper.findComponent(ElSwitch).vm.$emit('change', true)
    await flushPromises()
    expect(wrapper.text()).toContain('请刷新资格后重试')
    expect(wrapper.findComponent(ElSwitch).props('modelValue')).toBe(false)
    expect(wrapper.findComponent(ElSwitch).props('loading')).toBe(false)
  })
  it('ignores a summary arriving after Factory changes', async() => {
    let release!: (value: ReturnType<typeof state>) => void
    api.summary.mockImplementation(() => new Promise(resolve => {
      release = resolve
    }))
    const { wrapper, auth } = setup()
    await wrapper.findAll('button')[0]!.trigger('click')
    auth.factoryId = 'B'
    await flushPromises()
    release(state(true, 1))
    await flushPromises()
    expect(wrapper.text()).not.toContain('保留工序')
    expect(wrapper.findComponent(ElSwitch).exists()).toBe(false)
  })
  it('ignores an older user summary when the selected identity changes', async() => {
    let release!: (value: ReturnType<typeof state>) => void
    api.summary.mockImplementationOnce(() => new Promise(resolve => {
      release = resolve
    })).mockResolvedValue({ ...state(), userId: '2', operations: [], explicitTotal: 0, enabledExplicitTotal: 0 })
    const { wrapper } = setup()
    await wrapper.findAll('button')[0]!.trigger('click')
    await wrapper.findAll('button')[1]!.trigger('click')
    await flushPromises()
    release(state(true, 1))
    await flushPromises()
    expect(wrapper.text()).not.toContain('保留工序')
    expect(wrapper.text()).toContain('当前有效模式：无资格')
  })
})
