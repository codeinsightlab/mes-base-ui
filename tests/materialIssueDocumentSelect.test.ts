import { afterEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import Select from '../src/components/business/warehouse/MaterialIssueDocumentSelect.vue'
import SearchSelect from '../src/components/SearchSelect.vue'
import { useAuth } from '../src/stores/auth'
const mocks = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn() }))
vi.mock('../src/api/wm/stockDocuments', () => ({ stockDocuments: mocks }))
let wrapper: ReturnType<typeof mount> | undefined
const id = '9007199254740999'
afterEach(() => { wrapper?.unmount();vi.clearAllMocks() })
function setup(value: string | null, disabled = false, permissions = ['list', 'query']) {
  const pinia = createPinia(), auth = useAuth(pinia)
  auth.factoryId = 'A';auth.factoryPermissions = permissions.map(action => 'business:wm:stock:document:' + action)
  wrapper = mount(Select, { props: { modelValue: value, disabled }, global: { plugins: [pinia, ElementPlus] }})
  return auth
}
it('queries posted material issues and presents business numbers while keeping the identifier internal', async() => {
  mocks.list.mockResolvedValue({ items: [{ id, documentNo: 'MI20261107001' }], total: 1 })
  setup(null);await flushPromises()
  expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ documentType: 'MATERIAL_ISSUE', status: 'POSTED', offset: 0, limit: 20 }), 'OUT')
  expect(wrapper!.findComponent(SearchSelect).props('options')).toMatchObject([{ value: id, label: 'MI20261107001' }])
})
it('does not show an internal identifier when a saved reference cannot be resolved', async() => {
  setup(id, true, []);await flushPromises()
  expect(wrapper!.text()).toContain('领料单名称待确认');expect(wrapper!.text()).not.toContain(id)
  expect(mocks.list).not.toHaveBeenCalled();expect(mocks.detail).not.toHaveBeenCalled()
})
it('invalidates a pending selected-reference lookup on a factory switch', async() => {
  let finish!: (value: unknown) => void
  mocks.detail.mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockResolvedValue({ document: { id, documentType: 'MATERIAL_ISSUE', documentNo: 'CURRENT' }})
  const auth = setup(id, true);auth.factoryId = 'B';auth.revision++;await flushPromises()
  finish({ document: { id, documentType: 'MATERIAL_ISSUE', documentNo: 'OLD-SECRET' }});await flushPromises()
  expect(wrapper!.text()).not.toContain('OLD-SECRET');expect(wrapper!.emitted('update:modelValue')).toContainEqual([null])
})
