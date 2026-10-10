import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'
import { ElMessageBox } from 'element-plus'
import CrudPage from '../src/components/CrudPage.vue'
import { useAuth } from '../src/stores/auth'
import type { CrudApi, Row } from '../src/lib/crud'

vi.mock('element-plus', () => ({ ElMessage: { warning: vi.fn(), success: vi.fn(), error: vi.fn() }, ElMessageBox: { confirm: vi.fn() }}))
const button = defineComponent({ props: ['disabled'], emits: ['click'], template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>' })
const dialog = defineComponent({ props: ['modelValue'], template: '<div v-if="modelValue" data-test="dialog"><slot /><slot name="footer" /></div>' })
const wrappers: ReturnType<typeof mount>[] = []
function page(api: CrudApi) {
  const pinia = createPinia();setActivePinia(pinia)
  const auth = useAuth();auth.platformPermissions = ['read', 'create', 'update', 'delete'].map(action => 'acceptance:person:' + action)
  const wrapper = mount(CrudPage, { props: { title: '人员', permission: 'acceptance:person', permissionScope: 'platform', api, fields: [{ key: 'id', label: '编号', kind: 'text', readonly: true }, { key: 'name', label: '姓名', kind: 'text', required: true, maxLength: 64 }] }, global: { plugins: [pinia], stubs: { ElButton: button, ElDialog: dialog, ElTable: true, ElTableColumn: true, ElForm: { template: '<form><slot /></form>' }, ElFormItem: { template: '<div><slot /></div>' }, ElInput: true, ElAlert: true, Pagination: true, RightToolbar: true }}})
  wrappers.push(wrapper);return { wrapper, auth }
}
const api = (): CrudApi => ({ list: vi.fn().mockResolvedValue({ items: [], total: 0, offset: 0, limit: 20 }), create: vi.fn(), update: vi.fn(), remove: vi.fn() })
afterEach(() => { for (const wrapper of wrappers.splice(0))wrapper.unmount() })
describe('generated CRUD scope and permission lifecycle', () => {
  it('does not delete an old context record after confirming in a new context', async() => {
    let confirm!: () => void
    vi.mocked(ElMessageBox.confirm).mockImplementationOnce(() => new Promise<void>(done => { confirm = done }) as never)
    const service = api(), { wrapper, auth } = page(service);await flushPromises()
    const exposed = wrapper.vm as unknown as { remove(row: Row): Promise<void> }
    const pending = exposed.remove({ id: '9007199254740993', name: '旧范围' })
    auth.revision++;await flushPromises();confirm();await pending
    expect(service.remove).not.toHaveBeenCalled()
  })
  it('hides create when permission is removed and closes a draft on context change', async() => {
    const { wrapper, auth } = page(api());await flushPromises()
    await wrapper.findAll('button').find(item => item.text() === '新增')!.trigger('click')
    expect(wrapper.find('[data-test="dialog"]').exists()).toBe(true)
    auth.platformPermissions = ['acceptance:person:read'];auth.revision++
    await flushPromises()
    expect(wrapper.find('[data-test="dialog"]').exists()).toBe(false)
    expect(wrapper.findAll('button').some(item => item.text() === '新增')).toBe(false)
  })
  it('does not reopen a detail dialog after switching context', async() => {
    let resolve!: (row: Row) => void
    const service = api();service.detail = vi.fn(() => new Promise<Row>(done => { resolve = done }))
    const { wrapper, auth } = page(service);await flushPromises()
    const exposed = wrapper.vm as unknown as { open(row: Row): Promise<void> }
    // script setup exposes state through the test wrapper, without a production test-only API.
    const pending = exposed.open({ id: '9007199254740993', name: '旧范围' })
    auth.revision++;await flushPromises();resolve({ id: '9007199254740993', name: '旧范围' })
    await pending;await flushPromises()
    expect(wrapper.find('[data-test="dialog"]').exists()).toBe(false)
  })
})
