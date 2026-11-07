import { clearDictionaries } from '../src/utils/dictionaries'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { defineComponent } from 'vue'
import ElementPlus from 'element-plus'
import { useAuth } from '../src/stores/auth'
import Page from '../src/views/wm/stockDocuments/StockDocumentPage.vue'

const mocks = vi.hoisted(() => ({ request: vi.fn(), query: {} as Record<string, string> }))
vi.mock('../src/lib/request', () => ({ request: mocks.request }))
vi.mock('vue-router', () => ({ useRoute: () => ({ query: mocks.query }), useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))
const Document = defineComponent({
  props: ['headerPermissionOverrides', 'initialSearch', 'headerApi'],
  template: `<div><slot name="items" :header="{id:'44',documentType:'MATERIAL_ISSUE'}" :items="[{id:'99',materialId:'2',quantity:'1'}]" :writable="false" :saving="false" :add="()=>{}" :remove="()=>{}" /></div>`
})
let wrapper: ReturnType<typeof mount> | undefined
beforeEach(() => {
  vi.clearAllMocks()
  clearDictionaries()
  mocks.query = {}
  mocks.request.mockResolvedValue([])
  vi.stubGlobal('ResizeObserver', class {
    observe() {} unobserve() {} disconnect() {}
  })
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

function setup(permissions: string[]) {
  const pinia = createPinia(), auth = useAuth(pinia)
  auth.factoryId = 'A'
  auth.factoryPermissions = permissions
  wrapper = mount(Page, { props: { direction: 'OUT' }, global: { plugins: [pinia, ElementPlus], stubs: { MasterDetailDocument: Document, RouterLink: true, teleport: true }}})
  return { auth, document: wrapper.findComponent(Document) }
}

it('limits issue-only list and leaves lines hidden without item permission', async() => {
  const { document } = setup(['business:mes:material:issue:list', 'business:mes:material:issue:query'])
  expect(document.props('headerPermissionOverrides')).toMatchObject({ list: 'business:mes:material:issue:list', query: 'business:mes:material:issue:query' })
  expect(document.props('initialSearch')).toEqual({ direction: 'OUT', documentType: 'MATERIAL_ISSUE' })
  expect(wrapper!.text()).toContain('没有领料明细列表权限')
  expect(wrapper!.text()).not.toContain('读取明细')
})
it('reads only the explicitly requested line with item query permission', async() => {
  mocks.query = { documentId: '44', lineId: '99' }
  mocks.request.mockImplementation((url: string) => Promise.resolve(url.includes('/common/dict/') ? { data: [] } : { id: '99', documentId: '44', materialId: '2', quantity: '1', unitId: '3' }))
  setup(['business:mes:material:issue:item:query'])
  await flushPromises()
  expect(mocks.request).toHaveBeenCalledWith('/api/wm/outbound-documents/44/lines/99', { query: { documentType: 'MATERIAL_ISSUE' }, scope: 'factory' })
  expect(wrapper!.text()).not.toContain('明细 ID')
})
it('drops a late single-line response after a factory change', async() => {
  mocks.query = { documentId: '44', lineId: '99' }
  let finish!: (value: unknown) => void
  mocks.request.mockImplementation((url: string) => url.includes('/common/dict/') ? Promise.resolve({ data: [] }) : new Promise(resolve => {
    finish = resolve
  }))
  const { auth } = setup(['business:mes:material:issue:item:query'])
  auth.factoryId = 'B'
  await flushPromises()
  finish({ id: '99', documentId: '44', materialId: 'SECRET', quantity: '1' })
  await flushPromises()
  expect(wrapper!.text()).not.toContain('SECRET')
})
it('lets an item-list-only role read lines by document ID without header access', async() => {
  mocks.query = { documentId: '44' }
  mocks.request.mockImplementation((url: string) => Promise.resolve(url.includes('/common/dict/') ? { data: [] } : url.endsWith('/line-labels') ? [] : url.endsWith('/lines') ? [{ id: '99', materialId: '2', quantity: '1' }] : { workorderCode: 'WO1', outputQty: '1', issueQty: '2' }))
  setup(['business:mes:material:issue:item:list'])
  await flushPromises()
  expect(mocks.request).toHaveBeenCalledWith('/api/wm/outbound-documents/44/lines', { query: { documentType: 'MATERIAL_ISSUE' }, scope: 'factory' })
  expect(wrapper!.text()).toContain('WO1')
})
