import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import { useAuth } from '../src/stores/auth'
import Document from '../src/components/document/MasterDetailDocument.vue'
import CrudPage from '../src/components/CrudPage.vue'
const parent = '9007199254740999'
let wrapper:ReturnType<typeof mount>
const header = { list: vi.fn(), detail: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() }
const item = { list: vi.fn(), detail: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() }
beforeEach(() => { vi.clearAllMocks();header.list.mockResolvedValue({ items: [{ id: parent, reason: 'QA' }], total: 1 });header.detail.mockResolvedValue({ id: parent, reason: 'QA' });item.list.mockResolvedValue({ items: [], total: 0 });vi.stubGlobal('ResizeObserver', class {observe() {}unobserve() {}disconnect() {}}) })
afterEach(() => { wrapper?.unmount();vi.unstubAllGlobals() })
async function setup(extra:Record<string, unknown> = {}) {
  const pinia = createPinia(), auth = useAuth(pinia);auth.factoryId = 'A';auth.factoryPermissions = ['list', 'query', 'create', 'update', 'delete'].map(action => 'qa:' + action)
  wrapper = mount(Document, { props: { title: 'QA', headerApi: header, itemApi: item, headerFields: [{ key: 'reason', label: '依据', kind: 'text' }], itemFields: [{ key: 'documentId', label: '主单', kind: 'text' }, { key: 'quantity', label: '数量', kind: 'text' }], headerPermission: 'qa', itemPermission: 'qa', parentKey: 'documentId', ...extra }, global: { plugins: [pinia, ElementPlus] }})
  await flushPromises();return { auth, s: (wrapper.vm.$ as unknown as { setupState: Record<string, any> }).setupState }
}
it('default creation leaves children unread until the parent has been saved', async() => {
  const { s } = await setup();await s.open();await flushPromises();expect(wrapper.text()).toContain('先保存主单');expect(item.list).not.toHaveBeenCalled()
})
it('freezes formal source lines while keeping the draft reason editable and parent fixed', async() => {
  const { s } = await setup({ itemsReadonly: () => true });await s.open({ id: parent });await flushPromises()
  expect(wrapper.text()).toContain('保存主单');const lines = wrapper.findComponent(CrudPage)
  expect(lines.props('readonly')).toBe(true);expect(lines.props('fixedValues')).toEqual({ documentId: parent })
})
it('preserves the parent identifier even when a writable child draft contains a forged parent', async() => {
  const { s } = await setup();await s.open({ id: parent });await flushPromises()
  const lines = wrapper.findComponent(CrudPage), vm = lines.vm as unknown as { open: () => Promise<void>;save: () => Promise<void>;draft: Record<string, unknown> }
  await vm.open();Object.assign(vm.draft, { documentId: 'forged', quantity: '0.12' });item.create.mockResolvedValue({ id: '9' })
  await vm.save();expect(item.create).toHaveBeenCalledWith(expect.objectContaining({ documentId: parent, quantity: '0.12' }))
})
it('discards a completed save after the factory context has changed', async() => {
  const { s, auth } = await setup();await s.open({ id: parent });let finish!:(v:unknown) => void
  header.update.mockImplementationOnce(() => new Promise(resolve => finish = resolve));s.draft.reason = 'new';const saving = s.save()
  auth.factoryId = 'B';auth.revision++;await flushPromises();finish({ id: parent, reason: 'stale' });await saving
  expect(wrapper.text()).not.toContain('主单信息');expect(wrapper.text()).not.toContain('stale')
})
