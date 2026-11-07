import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import Page from '../src/views/wm/stockDocuments/StockDocumentPage.vue'
import { useAuth } from '../src/stores/auth'
import { clearDictionaries } from '../src/utils/dictionaries'
const mocks = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('../src/lib/request', () => ({ request: mocks.request }))
vi.mock('vue-router', () => ({ useRoute: () => ({ path: '/', query: {}}), useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }))
let wrapper: ReturnType<typeof mount>
beforeEach(() => {
  vi.clearAllMocks()
  clearDictionaries()
  vi.stubGlobal('ResizeObserver', class {
    observe() {} unobserve() {} disconnect() {}
  })
  mocks.request.mockImplementation((url: string) => Promise.resolve(url.includes('/common/dict/')
    ? { data: url.endsWith('_in_type') ? [{ dictValue: 'PURCHASE_RECEIPT', dictLabel: '字典采购名称' }] : [{ dictValue: 'OTHER_ISSUE', dictLabel: '字典出库名称' }] }
    : { items: [], total: 0, offset: 0, limit: 20 }))
})
afterEach(() => {
  wrapper?.unmount()
  vi.unstubAllGlobals()
})
it.each([['IN', 'PURCHASE_RECEIPT', '字典采购名称'], ['OUT', 'OTHER_ISSUE', '字典出库名称']] as const)('reads %s page type options directly through the common dictionary reader', async(direction, value, label) => {
  const pinia = createPinia(), auth = useAuth(pinia)
  auth.factoryId = 'A'
  auth.factoryPermissions = ['business:wm:stock:document:list', 'business:wm:stock:document:query']
  wrapper = mount(Page, { props: { direction }, global: { plugins: [pinia, ElementPlus], stubs: { MasterDetailDocument: true, RouterLink: true }}})
  await flushPromises()
  const state = (wrapper.vm.$ as unknown as { setupState: { headerFields: { key: string; options?: unknown[] }[] }}).setupState
  expect(state.headerFields.find(field => field.key === 'documentType')?.options).toEqual([{ value, label }])
  expect(mocks.request.mock.calls.some(([url]) => String(url).includes('/common/dict/stock_document_'))).toBe(true)
  expect(mocks.request.mock.calls.some(([url]) => String(url).endsWith('/types'))).toBe(false)
})
