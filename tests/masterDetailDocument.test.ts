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
it('keeps aggregate item controls read only when the document freezes its lines', async() => {
  const pinia = createPinia(), auth = useAuth(pinia);auth.factoryId = 'A';auth.factoryPermissions = ['list', 'query', 'create', 'update'].map(action => 'qa:' + action)
  const aggregate = { detail: vi.fn().mockResolvedValue({ header: { id: parent, reason: 'QA' }, items: [{ id: '4', quantity: '1' }] }), create: vi.fn(), update: vi.fn() }
  wrapper = mount(Document, { props: { title: 'QA', headerApi: header, itemApi: item, aggregateApi: aggregate, headerFields: [{ key: 'reason', label: '依据', kind: 'text' }], itemFields: [{ key: 'quantity', label: '数量', kind: 'text' }], headerPermission: 'qa', itemPermission: 'qa', parentKey: 'documentId', itemsReadonly: () => true }, slots: { items: '<template #items="{writable}"><span data-test="writable">{{ writable }}</span></template>' }, global: { plugins: [pinia, ElementPlus] }})
  const s = (wrapper.vm.$ as unknown as { setupState: Record<string, any> }).setupState;await s.open({ id: parent });await flushPromises()
  expect(wrapper.get('[data-test="writable"]').text()).toBe('false');expect(wrapper.text()).toContain('保存主单')
})

it('requires conditional purchase fields only while the purchase type is active', async() => {
  const { s } = await setup({ headerFields: [
    { key: 'documentType', label: '类型', kind: 'text', defaultValue: 'OTHER_RECEIPT' },
    { key: 'reason', label: '依据', kind: 'text', required: true },
    { key: 'supplierId', label: '供应商', kind: 'text', required: true, showWhen: { key: 'documentType', value: 'PURCHASE_RECEIPT' }},
    { key: 'businessDate', label: '日期', kind: 'date', required: true, showWhen: { key: 'documentType', value: 'PURCHASE_RECEIPT' }}
  ] })
  header.create.mockResolvedValue({ id: parent, reason: 'QA' })
  await s.open();s.draft.reason = 'QA';await s.save()
  expect(header.create).toHaveBeenCalledWith({ documentType: 'OTHER_RECEIPT', reason: 'QA' })
  await s.open();Object.assign(s.draft, { documentType: 'PURCHASE_RECEIPT', reason: 'QA' });await s.save()
  expect(header.create).toHaveBeenCalledTimes(1)
  Object.assign(s.draft, { supplierId: '20', businessDate: '2026-11-07' });await s.save()
  expect(header.create).toHaveBeenCalledTimes(2)
})

it('keeps the list mounted behind a dialog and closes without accepting a late detail response', async() => {
  const { s } = await setup({ presentation: 'dialog', documentNumberKey: 'documentNo' })
  let finish!: (value: unknown) => void
  header.detail.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const opening = s.open({ id: parent });await flushPromises()
  expect(wrapper.findComponent(CrudPage).exists()).toBe(true)
  expect(s.opened).toBe(true)
  await s.back();finish({ id: parent, documentNo: 'LATE-DOCUMENT', reason: 'late' });await opening;await flushPromises()
  expect(s.opened).toBe(false);expect(s.draft.documentNo).toBeUndefined()
  expect(header.list).toHaveBeenCalledTimes(2)
})

it('preserves unsaved dialog edits when dismissal is cancelled', async() => {
  const { ElMessageBox } = await import('element-plus')
  const confirmation = vi.spyOn(ElMessageBox, 'confirm').mockRejectedValueOnce('cancel').mockResolvedValueOnce(undefined as never)
  try {
    const { s } = await setup({ presentation: 'dialog', documentNumberKey: 'documentNo' })
    await s.open();s.draft.reason = '未保存的实物清点'
    const done = vi.fn();await s.closeDialog(done)
    expect(s.opened).toBe(true);expect(s.draft.reason).toBe('未保存的实物清点');expect(done).not.toHaveBeenCalled()
    await s.closeDialog(done)
    expect(s.opened).toBe(false);expect(done).toHaveBeenCalledTimes(1)
  } finally { confirmation.mockRestore() }
})

it('keeps hidden request identities out of the form while preserving the command whitelist', async() => {
  const { s } = await setup({ headerFields: [
    { key: 'reason', label: '依据', kind: 'text' },
    { key: 'requestId', label: '内部请求标识', kind: 'text', hidden: true, defaultValue: 'PRIVATE-REQUEST' }
  ] })
  header.create.mockResolvedValue({ id: parent, reason: 'QA' })
  await s.open();await flushPromises()
  expect(wrapper.text()).not.toContain('内部请求标识');expect(wrapper.html()).not.toContain('PRIVATE-REQUEST')
  await s.save();expect(header.create).toHaveBeenCalledWith(expect.objectContaining({ requestId: 'PRIVATE-REQUEST' }))
})
