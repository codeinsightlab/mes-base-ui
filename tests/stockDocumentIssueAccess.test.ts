import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { defineComponent } from 'vue'
import ElementPlus from 'element-plus'
import { useAuth } from '../src/stores/auth'
import Page from '../src/views/wm/stockDocuments/StockDocumentPage.vue'

const mocks = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('../src/lib/request', () => ({ request: mocks.request }))
vi.mock('vue-router', () => ({ useRoute: () => ({ query: {}}), useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))
const Document = defineComponent({
  props: ['headerPermissionOverrides', 'initialSearch', 'headerApi'],
  template: `<div><slot name="items" :header="{id:'44',documentType:'MATERIAL_ISSUE'}" :items="[{id:'99',materialId:'2',quantity:'1'}]" :writable="false" :saving="false" :add="()=>{}" :remove="()=>{}" /></div>`
})
let wrapper: ReturnType<typeof mount> | undefined
beforeEach(() => { vi.clearAllMocks();mocks.request.mockResolvedValue([]);vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }) })
afterEach(() => { wrapper?.unmount();wrapper = undefined;vi.unstubAllGlobals() })
function setup(permissions: string[]) {
  const pinia = createPinia(), auth = useAuth(pinia)
  auth.factoryId = 'A';auth.factoryPermissions = permissions
  wrapper = mount(Page, { props: { direction: 'OUT' }, global: { plugins: [pinia, ElementPlus], stubs: { MasterDetailDocument: Document, RouterLink: true }}})
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
  setup(['business:mes:material:issue:query', 'business:mes:material:issue:item:query'])
  mocks.request.mockResolvedValue({ id: '99', documentId: '44', materialId: '2', quantity: '1', unitId: '3' })
  await wrapper!.get('input[aria-label="领料明细 ID"]').setValue('99')
  const button = wrapper!.findAll('button').find(b => b.text().includes('读取明细'))!
  await button.trigger('click');await flushPromises()
  expect(mocks.request).toHaveBeenCalledWith('/api/wm/outbound-documents/44/lines/99', { query: { documentType: 'MATERIAL_ISSUE' }, scope: 'factory' })
  expect(wrapper!.text()).toContain('明细 ID')
})
it('drops a late single-line response after a factory change', async() => {
  const { auth } = setup(['business:mes:material:issue:query', 'business:mes:material:issue:item:query'])
  let finish!: (value: unknown) => void
  mocks.request.mockImplementation((url: string) => url.endsWith('/types') ? Promise.resolve([]) : new Promise(resolve => { finish = resolve }))
  await wrapper!.get('input[aria-label="领料明细 ID"]').setValue('99')
  await wrapper!.findAll('button').find(b => b.text().includes('读取明细'))!.trigger('click')
  auth.factoryId = 'B';await flushPromises()
  finish({ id: '99', documentId: '44', materialId: 'SECRET', quantity: '1' });await flushPromises()
  expect(wrapper!.text()).not.toContain('SECRET')
})
it('lets an item-list-only role read lines by document ID without header access', async() => {
  setup(['business:mes:material:issue:item:list'])
  mocks.request.mockImplementation((url: string) => Promise.resolve(url.endsWith('/types') ? [] : url.endsWith('/lines') ? [{ id: '99', materialId: '2', quantity: '1' }] : { workorderCode: 'WO1', outputQty: '1', issueQty: '2' }))
  await wrapper!.get('input[aria-label="领料单据 ID"]').setValue('44')
  await wrapper!.findAll('button').find(b => b.text().includes('读取明细列表'))!.trigger('click');await flushPromises()
  expect(mocks.request).toHaveBeenCalledWith('/api/wm/outbound-documents/44/lines', { query: { documentType: 'MATERIAL_ISSUE' }, scope: 'factory' })
  expect(wrapper!.text()).toContain('WO1')
})
