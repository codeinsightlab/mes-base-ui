import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, reactive } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus, { ElSelect } from 'element-plus'
import { useAuth } from '../src/stores/auth'
import Page from '../src/views/wm/stockDocuments/StockDocumentPage.vue'

const mocks = vi.hoisted(() => ({ request: vi.fn(), query: {} as Record<string, string>, router: { push: vi.fn(), replace: vi.fn() }}))
vi.mock('../src/lib/request', () => ({ request: mocks.request }))
vi.mock('vue-router', () => ({ useRoute: () => ({ query: mocks.query }), useRouter: () => mocks.router }))
const Document = defineComponent({
  props: ['aggregateApi', 'headerFields'],
  setup(props) { const draft = reactive(Object.fromEntries(props.headerFields.map((field:any) => [field.key, field.defaultValue ?? null])));draft.reason = '实物交接';draft.ruleCode = 'IN_RULE';return { draft } },
  template: `<section><slot name="header-actions" :row="draft" :refresh="()=>Promise.resolve()" :dirty="false"/><slot name="field-documentType" :draft="draft" :disabled="false"/><slot name="field-ruleCode" :draft="draft" :disabled="false"/><slot name="field-sourceExecutionId" :draft="draft" :disabled="false"/><button @click="aggregateApi.create({...draft, items:[{materialId:'2',stockId:'3',warehouseId:'4',unitId:'5',quantity:'1'}]})">保存主单</button></section>`
})
const RouterLinkStub = defineComponent({ name: 'RouterLink', props: ['to'], template: '<a><slot /></a>' })
const ExecutionSelect = defineComponent({ props: ['modelValue', 'disabled', 'statuses'], emits: ['update:modelValue'], template: '<div />' })
let wrapper:ReturnType<typeof mount>
beforeEach(() => { vi.clearAllMocks();mocks.query = {};mocks.request.mockImplementation((url:string, options:any) => url.endsWith('/types') ? Promise.resolve([{ value: 'PRODUCTION_RECEIPT', direction: 'IN', label: '生产入库', origin: '工单生产完成', requiredDocuments: '', approvalAvailable: true, qualityReceipt: false, enabled: true }, { value: 'OTHER_RECEIPT', direction: 'IN', label: '其他入库', origin: '其他', requiredDocuments: '', approvalAvailable: true, qualityReceipt: false, enabled: true }]) : url.includes('/numbering-rules') ? Promise.resolve([]) : Promise.resolve({ document: { id: '1', direction: options?.query?.direction ?? 'IN' }, lines: [] }));vi.stubGlobal('ResizeObserver', class {observe() {}unobserve() {}disconnect() {}}) })
afterEach(() => { wrapper?.unmount();document.body.innerHTML = '';vi.unstubAllGlobals() })
async function setup() { const pinia = createPinia(), auth = useAuth(pinia);auth.factoryId = 'A';auth.runtimeMode = 'LOCAL';wrapper = mount(Page, { props: { direction: 'IN' }, global: { plugins: [pinia, ElementPlus], stubs: { MasterDetailDocument: Document, ProductionExecutionSelect: ExecutionSelect, RouterLink: RouterLinkStub, StockDocumentActions: true }}});await flushPromises();return wrapper.findComponent(Document) }

it('creates production inbound from the ordinary menu with a selectable execution and the formal type', async() => {
  const document = await setup(), type = wrapper.findComponent(ElSelect)
  expect(type.findAllComponents({ name: 'ElOption' }).map(option => option.props('value'))).toContain('PRODUCTION_RECEIPT')
  expect(type.findAllComponents({ name: 'ElOption' }).map(option => option.props('value'))).not.toContain('DEFECT_RECEIPT')
  expect(type.findAllComponents({ name: 'ElOption' }).map(option => option.props('value'))).not.toContain('SCRAP_RECEIPT')
  expect(wrapper.findComponent(ExecutionSelect).props('disabled')).toBe(true)
  type.vm.$emit('update:modelValue', 'PRODUCTION_RECEIPT');type.vm.$emit('change', 'PRODUCTION_RECEIPT');await flushPromises()
  const state = (document.vm.$ as unknown as { setupState: { draft: Record<string, unknown> }}).setupState;state.draft.ruleCode = 'IN_RULE'
  expect(wrapper.findComponent(ExecutionSelect).props('disabled')).toBe(false)
  wrapper.findComponent(ExecutionSelect).vm.$emit('update:modelValue', '9007199254740999');await flushPromises()
  await document.get('button').trigger('click');await flushPromises()
  expect(mocks.request.mock.calls.find(call => call[1]?.method === 'POST')?.[1].body).toMatchObject({ header: { ruleCode: 'IN_RULE', documentType: 'PRODUCTION_RECEIPT', sourceExecutionId: '9007199254740999' }, items: [{ materialId: '2', quantity: '1' }] })
  type.vm.$emit('update:modelValue', 'OTHER_RECEIPT');type.vm.$emit('change', 'OTHER_RECEIPT');await flushPromises();expect(state.draft.ruleCode).toBeNull();state.draft.ruleCode = 'OTHER_IN_RULE'
  await document.get('button').trigger('click');await flushPromises()
  expect(mocks.request.mock.calls.filter(call => call[1]?.method === 'POST').at(-1)?.[1].body).toMatchObject({ header: { ruleCode: 'OTHER_IN_RULE', documentType: 'OTHER_RECEIPT', sourceExecutionId: null }})
})

it('preserves the deep-linked execution as a visible production type and allows changing it before save', async() => {
  mocks.query = { executionId: '9007199254740999' }
  const document = await setup()
  expect(wrapper.findComponent(ElSelect).props('modelValue')).toBe('PRODUCTION_RECEIPT')
  expect(wrapper.findComponent(ExecutionSelect).props('disabled')).toBe(false)
  await document.get('button').trigger('click');await flushPromises()
  expect(mocks.request.mock.calls.find(call => call[1]?.method === 'POST')?.[1].body).toMatchObject({ header: { ruleCode: 'IN_RULE', documentType: 'PRODUCTION_RECEIPT', sourceExecutionId: '9007199254740999' }, items: [{ materialId: '2', quantity: '1' }] })
})

it('links each transfer direction directly to the paired transfer detail through the authorized menu', async() => {
  const document = await setup()
  const state = (wrapper.vm.$ as unknown as { setupState: Record<string, any> }).setupState
  state.auth.factoryMenus = [{ id: 'transfer', name: '库存调拨', path: '/custom/transfers', component: 'wm/stockTransfers/index', kind: 'MENU', children: [] }]
  const draft = (document.vm.$ as unknown as { setupState: { draft: Record<string, unknown> }}).setupState.draft
  for (const type of ['TRANSFER_RECEIPT', 'TRANSFER_ISSUE']) {
    draft.id = '9007199254740999'; draft.documentType = type; await flushPromises()
    const link = wrapper.findAllComponents(RouterLinkStub).find(item => item.text() === '查看关联调拨')
    expect(link?.props('to')).toEqual({ path: '/custom/transfers', query: { documentId: '9007199254740999' }})
  }
})
