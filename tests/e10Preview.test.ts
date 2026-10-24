import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import Preview from '../src/components/business/E10SyncPreview.vue'

const api = vi.hoisted(() => ({ capability: vi.fn(), preview: vi.fn(), sync: vi.fn() }))
vi.mock('../src/api/production/e10Preview', () => api)
const state = reactive({ factoryId: 'A', revision: 1, runtimeMode: 'ERP', granted: true })
vi.mock('../src/stores/auth', () => ({ useAuth: () => ({
  get factoryId() { return state.factoryId }, get revision() { return state.revision },
  get runtimeMode() { return state.runtimeMode }, hasPermission: () => state.granted
}) }))
const support = () => ({ supported: true, writeEnabled: false, blockers: ['身份尚未确认'] })
const result = () => ({ status: 'PREVIEW_ONLY', pageNo: 1, pageSize: 20, fetched: 1,
  created: 0, updated: 0, skipped: 0, possiblyMore: false, blockers: ['身份尚未确认'],
  candidates: [{ code: 'TEST_ONLY', plannedQty: '999999999999.123456' }] })
function create() {
  return mount(Preview, { props: { kind: 'workorder', permission: 'workorder:sync' }, global: { stubs: {
    ElButton: { template: '<button><slot /></button>' },
    ElDialog: { props: ['modelValue'], template: '<section v-if="modelValue"><slot /><slot name="footer" /></section>' },
    ElAlert: { props: ['title'], template: '<p>{{ title }}</p>' },
    ElTable: { props: ['data'], template: '<div>{{ JSON.stringify(data) }}<slot /></div>' },
    ElTableColumn: true
  }}})
}
async function click(wrapper: ReturnType<typeof create>, label: string) {
  const button = wrapper.findAll('button').find(item => item.text() === label)
  expect(button).toBeDefined(); await button!.trigger('click'); await flushPromises()
}
beforeEach(() => {
  vi.clearAllMocks(); Object.assign(state, { factoryId: 'A', revision: 1, runtimeMode: 'ERP', granted: true })
  api.capability.mockResolvedValue(support()); api.preview.mockResolvedValue(result())
})
describe('E10 controlled candidate preview', () => {
  it('requires ERP mode and its own permission, and capability does not trigger a query', async() => {
    state.runtimeMode = 'LOCAL'
    const local = create(); await flushPromises()
    expect(api.capability).not.toHaveBeenCalled(); expect(local.find('button').exists()).toBe(false); local.unmount()
    state.runtimeMode = 'ERP'; state.granted = false
    const denied = create(); await flushPromises(); expect(api.capability).not.toHaveBeenCalled(); denied.unmount()
    state.granted = true
    const allowed = create(); await flushPromises()
    expect(api.capability).toHaveBeenCalledWith('workorder'); expect(api.preview).not.toHaveBeenCalled()
    allowed.unmount()
  })
  it('shows blockers before explicit read and reports zero writes with exact decimal strings', async() => {
    const wrapper = create(); await flushPromises(); await click(wrapper, 'ERP同步准备')
    expect(wrapper.text()).toContain('身份尚未确认'); expect(api.preview).not.toHaveBeenCalled()
    await click(wrapper, '只读查询ERP候选')
    expect(api.preview).toHaveBeenCalledExactlyOnceWith('workorder', 1)
    expect(wrapper.text()).toContain('999999999999.123456'); expect(wrapper.text()).toContain('新增 0、更新 0')
    expect(wrapper.text()).toContain('仅预览'); wrapper.unmount()
  })
  it('clears errors and late candidate responses on close, factory change and revocation', async() => {
    let resolve!: (value: unknown) => void
    api.preview.mockImplementation(() => new Promise(done => { resolve = done }))
    const wrapper = create(); await flushPromises(); await click(wrapper, 'ERP同步准备'); await click(wrapper, '只读查询ERP候选')
    await click(wrapper, '关闭'); resolve(result()); await flushPromises()
    await click(wrapper, 'ERP同步准备'); expect(wrapper.text()).not.toContain('TEST_ONLY')
    state.factoryId = 'B'; state.revision++; await flushPromises(); expect(wrapper.find('section').exists()).toBe(false)
    state.granted = false; await flushPromises(); expect(wrapper.find('button').exists()).toBe(false)
    wrapper.unmount()
  })
  it('displays query failure and never presents success or falls back to local data', async() => {
    api.preview.mockRejectedValue(new Error('TEST_ONLY_QUERY_FAILED'))
    const wrapper = create(); await flushPromises(); await click(wrapper, 'ERP同步准备'); await click(wrapper, '只读查询ERP候选')
    expect(wrapper.text()).toContain('TEST_ONLY_QUERY_FAILED'); expect(wrapper.text()).not.toContain('状态：仅预览')
    expect(api.preview).toHaveBeenCalledTimes(1); wrapper.unmount()
  })
  it('runs server Dry Run without offering commit when capability denies it', async() => {
    api.sync.mockResolvedValue({ status: 'DRY_RUN', factoryId: 'A', provider: 'DIGIWIN_E10', binding: 'TEST', configurationVersion: '1', runToken: 'TEST_RUN',
      fetched: 1, duplicates: 0, creatable: 0, updatable: 0, unchanged: 0, conflicts: 0, blocked: 1, created: 0, updated: 0,
      items: [{ code: 'TEST_BLOCKED', action: 'IDENTITY_UNVERIFIED', reasons: ['IDENTITY_UNVERIFIED'] }] })
    const wrapper = create(); await flushPromises(); await click(wrapper, 'ERP同步准备'); await click(wrapper, 'Dry Run 校验')
    expect(api.sync).toHaveBeenCalledExactlyOnceWith('workorder', false)
    expect(wrapper.text()).toContain('IDENTITY_UNVERIFIED'); expect(wrapper.text()).toContain('DRY_RUN')
    expect(wrapper.text()).not.toContain('正式同步（重新校验）'); wrapper.unmount()
  })
  it('enables commit only after Dry Run and emits refresh with actual partial counts', async() => {
    api.capability.mockResolvedValue({ ...support(), writeEnabled: true })
    const output = { status: 'DRY_RUN', factoryId: 'A', provider: 'DIGIWIN_E10', binding: 'TEST', configurationVersion: '1', runToken: 'TEST_RUN',
      fetched: 2, duplicates: 0, creatable: 1, updatable: 0, unchanged: 0, conflicts: 1, blocked: 0, created: 0, updated: 0, items: [] }
    api.sync.mockResolvedValueOnce(output).mockResolvedValueOnce({ ...output, status: 'PARTIAL_SUCCESS', created: 1 })
    const wrapper = create(); await flushPromises(); await click(wrapper, 'ERP同步准备'); await click(wrapper, 'Dry Run 校验')
    await click(wrapper, '正式同步（重新校验）')
    expect(api.sync).toHaveBeenLastCalledWith('workorder', true); expect(wrapper.text()).toContain('PARTIAL_SUCCESS')
    expect(wrapper.text()).toContain('实际新增 1'); expect(wrapper.emitted('completed')).toHaveLength(1); wrapper.unmount()
  })
  it('discards late Dry Run and commit results when factory or permission changes', async() => {
    let resolve!: (value: unknown) => void
    api.sync.mockImplementation(() => new Promise(done => { resolve = done }))
    const wrapper = create(); await flushPromises(); await click(wrapper, 'ERP同步准备'); await click(wrapper, 'Dry Run 校验')
    state.granted = false; await flushPromises(); resolve({ status: 'COMMITTED', items: [] }); await flushPromises()
    expect(wrapper.text()).not.toContain('COMMITTED'); expect(wrapper.emitted('completed')).toBeUndefined(); wrapper.unmount()
  })

})
