import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, reactive } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus, { ElSelect } from 'element-plus'
import { useAuth } from '../src/stores/auth'
import Page from '../src/views/wm/stockDocuments/index.vue'

const mocks = vi.hoisted(() => ({ request: vi.fn(), query: {} as Record<string, string> }))
vi.mock('../src/lib/request', () => ({ request: mocks.request }))
vi.mock('vue-router', () => ({ useRoute: () => ({ query: mocks.query }) }))
const Document = defineComponent({
  props: ['headerApi', 'headerFields'],
  setup(props) { const draft = reactive(Object.fromEntries(props.headerFields.map((field:any) => [field.key, field.defaultValue ?? null])));draft.reason = '实物交接';return { draft } },
  template: '<section><slot name="field-documentType" :draft="draft" :disabled="false"/><slot name="field-sourceExecutionId" :draft="draft" :disabled="false"/><button @click="headerApi.create(draft)">保存主单</button></section>'
})
const ExecutionSelect = defineComponent({ props: ['modelValue', 'disabled', 'statuses'], emits: ['update:modelValue'], template: '<div />' })
let wrapper:ReturnType<typeof mount>
beforeEach(() => { vi.clearAllMocks();mocks.query = {};mocks.request.mockResolvedValue({ document: { id: '1' }, lines: [] });vi.stubGlobal('ResizeObserver', class {observe() {}unobserve() {}disconnect() {}}) })
afterEach(() => { wrapper?.unmount();document.body.innerHTML = '';vi.unstubAllGlobals() })
async function setup() { const pinia = createPinia(), auth = useAuth(pinia);auth.factoryId = 'A';auth.runtimeMode = 'LOCAL';wrapper = mount(Page, { global: { plugins: [pinia, ElementPlus], stubs: { MasterDetailDocument: Document, ProductionExecutionSelect: ExecutionSelect }}});await flushPromises();return wrapper.findComponent(Document) }

it('creates production inbound from the ordinary menu with a selectable execution and the formal type', async() => {
  const document = await setup(), type = wrapper.findComponent(ElSelect)
  expect(type.findAllComponents({ name: 'ElOption' }).map(option => option.props('value'))).toContain('PRODUCTION_RECEIPT')
  expect(type.findAllComponents({ name: 'ElOption' }).map(option => option.props('value'))).not.toContain('DEFECT_RECEIPT')
  expect(type.findAllComponents({ name: 'ElOption' }).map(option => option.props('value'))).not.toContain('SCRAP_RECEIPT')
  expect(wrapper.findComponent(ExecutionSelect).props('disabled')).toBe(true)
  type.vm.$emit('update:modelValue', 'PRODUCTION_RECEIPT');type.vm.$emit('change', 'PRODUCTION_RECEIPT');await flushPromises()
  expect(wrapper.findComponent(ExecutionSelect).props('disabled')).toBe(false)
  wrapper.findComponent(ExecutionSelect).vm.$emit('update:modelValue', '9007199254740999');await flushPromises()
  await document.get('button').trigger('click');await flushPromises()
  expect(mocks.request.mock.calls[0]![1].body).toMatchObject({ documentType: 'PRODUCTION_RECEIPT', sourceExecutionId: '9007199254740999' })
  type.vm.$emit('update:modelValue', 'OTHER_RECEIPT');type.vm.$emit('change', 'OTHER_RECEIPT');await flushPromises()
  await document.get('button').trigger('click');await flushPromises()
  expect(mocks.request.mock.calls[1]![1].body).toMatchObject({ documentType: 'OTHER_RECEIPT', sourceExecutionId: null })
})

it('preserves the deep-linked execution as a visible production type and allows changing it before save', async() => {
  mocks.query = { executionId: '9007199254740999' }
  const document = await setup()
  expect(wrapper.findComponent(ElSelect).props('modelValue')).toBe('PRODUCTION_RECEIPT')
  expect(wrapper.findComponent(ExecutionSelect).props('disabled')).toBe(false)
  await document.get('button').trigger('click');await flushPromises()
  expect(mocks.request.mock.calls[0]![1].body).toMatchObject({ documentType: 'PRODUCTION_RECEIPT', sourceExecutionId: '9007199254740999' })
})
