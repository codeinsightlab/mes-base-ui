import { describe, expect, it, vi } from 'vitest'
import { flushPromises, shallowMount } from '@vue/test-utils'
import Factory from '../src/views/system/factory/index.vue'
const api = vi.hoisted(() => ({ listFactories: vi.fn(async() => ({ rows: [], total: 0 })), listDatasources: vi.fn(async() => ({ rows: [] })), factoryIntegrationOptions: vi.fn(async() => []), createFactory: vi.fn(), saveFactory: vi.fn(), deleteFactory: vi.fn() }))
vi.mock('../src/api/system/datasource', () => api)
vi.mock('../src/utils/factory', () => ({ refreshFactory: vi.fn() }))
const form = { template: '<form><slot /></form>', methods: { clearValidate() {}, validate(callback: (valid: boolean) => void) { callback(true) } } }
function mount() { return shallowMount(Factory, { global: { stubs: { ElTable: true, ElTableColumn: true, ElForm: form, ElDialog: { template: '<div><slot /><slot name="footer" /></div>' } }, directives: { hasPermi: {} }, mocks: { $message: { success: vi.fn() } } } }) }
describe('factory business integration maintenance', () => {
  it('defaults new factories to LOCAL and clears ERP fields on mode change', async() => {
    const wrapper = mount(); const vm = wrapper.vm as any
    vm.edit(); await flushPromises()
    expect(vm.form.runtimeMode).toBe('LOCAL'); expect(vm.form.erpProvider).toBeNull()
    vm.form.erpProvider = 'DINGJIE'; vm.form.erpConfigRef = 'binding'; vm.modeChanged()
    expect(vm.form.erpProvider).toBeNull(); expect(vm.form.erpConfigRef).toBeNull(); wrapper.unmount()
  })
  it('preserves ERP identity, version and irreversible lock in edit and save', async() => {
    const wrapper = mount(); const vm = wrapper.vm as any
    api.factoryIntegrationOptions.mockResolvedValueOnce([{ reference: 'binding', provider: 'DINGJIE', revision: 3 }] as never)
    vm.edit({ factoryId: 'A', enterpriseId: 'T', factoryCode: 'A', factoryName: 'A', datasourceId: '1', status: 'ENABLED', revision: 7, runtimeMode: 'ERP', erpProvider: 'DINGJIE', erpConfigRef: 'binding', integrationLocked: true })
    await flushPromises()
    expect(vm.integrationLocked).toBe(true); expect(vm.providers).toEqual(['DINGJIE']); expect(vm.matchingOptions).toHaveLength(1)
    vm.save(); await flushPromises()
    expect(api.saveFactory).toHaveBeenCalledWith(expect.objectContaining({ runtimeMode: 'ERP', erpProvider: 'DINGJIE', erpConfigRef: 'binding', revision: 7 }))
    wrapper.unmount()
  })
  it('does not downgrade ERP after configuration read failure or accept late options for another factory', async() => {
    const wrapper = mount(); const vm = wrapper.vm as any
    let resolve!: (value: any) => void
    api.factoryIntegrationOptions.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    vm.edit({ factoryId: 'A', runtimeMode: 'ERP', erpProvider: 'SAP', erpConfigRef: 'a', integrationLocked: true })
    api.factoryIntegrationOptions.mockRejectedValueOnce(new Error('configuration unavailable'))
    vm.edit({ factoryId: 'B', runtimeMode: 'ERP', erpProvider: 'DINGJIE', erpConfigRef: 'b', integrationLocked: true })
    await flushPromises(); resolve([{ provider: 'SAP', reference: 'a', revision: 1 }]); await flushPromises()
    expect(vm.form.runtimeMode).toBe('ERP'); expect(vm.form.erpConfigRef).toBe('b'); expect(vm.integrationOptions).toEqual([]); expect(vm.optionsError).toBe('configuration unavailable')
    wrapper.unmount()
  })
})
