import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import Dialog from '../src/views/system/factory/FactoryOapiDialog.vue'
const api = vi.hoisted(() => ({ getFactoryOapi: vi.fn(), saveFactoryOapi: vi.fn() }))
vi.mock('../src/api/system/datasource', () => api)
vi.mock('../src/stores/auth', () => ({ useAuth: () => ({ token: 'TEST', factoryId: 'A', revision: 1, platformPermissions: ['system:factory:edit'] }) }))
vi.mock('element-plus', () => ({ ElMessage: { success: vi.fn() } }))
const settings = () => ({ endpoint: 'https://erp.invalid/oapi', host: { ver: '5.7', prod: 'TEST', timezone: '8', ip: 'TEST', id: '', lang: 'zh_CN', acct: 'TEST' }, service: { prod: 'TEST', ip: 'TEST', id: 'TEST' } })
const view = (locked = false) => ({ factoryId: 'A', factoryRevision: 7, reference: 'binding', configurationRevision: 2, locked, settings: settings() })
function create() {
  return mount(Dialog, { props: { factory: { factoryId: 'A', factoryName: 'TEST', runtimeMode: 'LOCAL' } }, global: { directives: { loading: {} }, stubs: {
    PageDialog: { template: '<div><slot /><slot name="footer" /></div>' },
    ElForm: { template: '<form><slot /></form>', methods: { validate: () => Promise.resolve(true) } },
    ElFormItem: { template: '<label><slot /></label>' }, ElDivider: { template: '<div><slot /></div>' }, ElAlert: true,
    ElInput: { props: ['modelValue'], emits: ['update:modelValue'], template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' },
    ElButton: { template: '<button><slot /></button>' }
  } } })
}
beforeEach(() => vi.clearAllMocks())
describe('factory OAPI configuration', () => {
  it('loads the factory configuration, preserves empty host id and saves only configuration with optimistic revision', async() => {
    api.getFactoryOapi.mockResolvedValue(view())
    api.saveFactoryOapi.mockResolvedValue({ ...view(), factoryRevision: 8, configurationRevision: 3 })
    const wrapper = create(); await flushPromises()
    expect(api.getFactoryOapi).toHaveBeenCalledWith('A')
    expect((wrapper.find('#oapi-host-id').element as HTMLInputElement).value).toBe('')
    await wrapper.find('#oapi-endpoint').setValue('https://erp.invalid/new')
    await wrapper.findAll('button').find(b => b.text() === '保存配置')!.trigger('click'); await flushPromises()
    expect(api.saveFactoryOapi).toHaveBeenCalledWith('A', 7, expect.objectContaining({ endpoint: 'https://erp.invalid/new', host: expect.objectContaining({ id: '' }) }))
    expect(wrapper.emitted('saved')).toHaveLength(1)
    expect(wrapper.text()).toContain('配置版本 3')
    wrapper.unmount()
  })
  it('shows active ERP configuration as read only without a save action', async() => {
    api.getFactoryOapi.mockResolvedValue(view(true))
    const wrapper = create(); await flushPromises()
    expect(wrapper.text()).toContain('参数只读')
    expect(wrapper.text()).not.toContain('保存配置')
    expect(api.saveFactoryOapi).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('shows read failure without presenting an empty writable configuration', async() => {
    api.getFactoryOapi.mockRejectedValue(new Error('configuration unavailable'))
    const wrapper = create(); await flushPromises()
    expect(wrapper.text()).toContain('configuration unavailable')
    expect(wrapper.find('#oapi-endpoint').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('保存配置')
    wrapper.unmount()
  })
  it('discards a late response after the factory dialog closes', async() => {
    let resolve!: (value: unknown) => void
    api.getFactoryOapi.mockImplementation(() => new Promise(done => { resolve = done }))
    const wrapper = create(); await flushPromises(); wrapper.unmount()
    resolve(view()); await flushPromises()
    expect(wrapper.emitted('saved')).toBeUndefined()
    expect(api.saveFactoryOapi).not.toHaveBeenCalled()
  })
})
