// TEST ONLY: component contract; no server/database operations.
import { afterEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import CrudPage from '../src/components/CrudPage.vue'
import { useAuth } from '../src/stores/auth'
import type { Row } from '../src/lib/crud'
const mounted: ReturnType<typeof mount>[] = []
afterEach(() => { mounted.splice(0).forEach(w => w.unmount());document.body.innerHTML = '';vi.unstubAllGlobals() })
function setup(beforeCreate:() => Promise<Row | null>) {
  vi.stubGlobal('ResizeObserver', class {observe() {}unobserve() {}disconnect() {}})
  const pinia = createPinia(), auth = useAuth(pinia)
  auth.factoryPermissions = ['business:material:list', 'business:material:create']
  const create = vi.fn(), wrapper = mount(CrudPage, { attachTo: document.body, props: { title: 'TEST ONLY', permission: 'business:material', permissionScope: 'factory', listAction: 'list', detailAction: 'query', beforeCreate, api: { list: vi.fn().mockResolvedValue({ items: [], total: 0, offset: 0, limit: 20 }), create, update: vi.fn(), remove: vi.fn() }, fields: [{ key: 'materialId', label: '组件物料', kind: 'text', required: true }, { key: 'quantity', label: '标准用量', kind: 'decimal', required: true }] }, global: { plugins: [pinia, ElementPlus] }})
  mounted.push(wrapper);return { wrapper, auth, create }
}
it('selects a component before opening the editor and requires an explicit quantity', async() => {
  const { wrapper, create } = setup(async() => ({ materialId: '9007199254740993' }));await flushPromises()
  await wrapper.findAll('button').find(b => b.text() === '新增')!.trigger('click');await flushPromises()
  const dialog = document.querySelector('[role=dialog]')!
  expect(dialog).not.toBeNull();expect((dialog.querySelector('input[placeholder="请输入组件物料"]') as HTMLInputElement).value).toBe('9007199254740993')
  expect((dialog.querySelector('input[placeholder="请输入标准用量"]') as HTMLInputElement).value).toBe('')
  expect(create).not.toHaveBeenCalled()
})
it('does not reopen a component editor when selection completes after authorization changed', async() => {
  let finish!:(value:Row | null) => void
  const { wrapper, auth } = setup(() => new Promise(resolve => { finish = resolve }));await flushPromises()
  const action = wrapper.findAll('button').find(b => b.text() === '新增')!.trigger('click');await flushPromises()
  auth.revision++;await flushPromises();finish({ materialId: 'OLD' });await action;await flushPromises()
  expect(document.querySelector('input[placeholder="请输入组件物料"]')).toBeNull()
  expect(document.body.textContent).not.toContain('OLD')
})
