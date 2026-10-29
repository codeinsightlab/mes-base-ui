import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, reactive, ref } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import { useAuth } from '../src/stores/auth'
import Page from '../src/views/wm/stockDocuments/StockDocumentPage.vue'

const mocks = vi.hoisted(() => ({ request: vi.fn(), direction: 'IN' }))
vi.mock('../src/lib/request', () => ({ request: mocks.request }))
vi.mock('vue-router', () => ({ useRoute: () => ({ query: { direction: mocks.direction }}), useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))
// Match the real document boundary: page metadata loads before a user opens the new form.
const Document = defineComponent({
  props: ['headerFields'],
  setup(props) {
    const draft = reactive(Object.fromEntries(props.headerFields.map((field: { key: string; defaultValue?: unknown }) => [field.key, field.defaultValue ?? null])))
    return { draft, opened: ref(false) }
  },
  template: '<section><button @click="opened=true">新增草稿</button><div v-if="opened"><slot name="field-ruleCode" :draft="draft" :disabled="false"/></div></section>'
})
let wrapper: ReturnType<typeof mount> | undefined
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
})
afterEach(() => { wrapper?.unmount();wrapper = undefined;vi.unstubAllGlobals() })

it.each([
  ['IN', 'OTHER_RECEIPT', 'OIR', 'OIR20261029001'],
  ['OUT', 'OTHER_ISSUE', 'OIS', 'OIS20261029001']
])('automatically matches the initial %s type to its rule and preview without allocating a number', async(direction, type, prefix, preview) => {
  mocks.direction = direction
  mocks.request.mockImplementation((url: string) => {
    if (url.endsWith('/types')) return Promise.resolve([{ value: type, direction, label: type, enabled: true }])
    if (url.endsWith('/numbering-rules')) return Promise.resolve([
      { typeKey: 'UNRELATED', ruleCode: 'UNRELATED', ruleName: '别的类型', prefix: 'WRONG', preview: 'WRONG001', available: true },
      { typeKey: type, ruleCode: type, ruleName: '当前类型规则', prefix, preview, available: true }
    ])
    return Promise.resolve([])
  })
  const pinia = createPinia(), auth = useAuth(pinia)
  auth.factoryId = 'A';auth.runtimeMode = 'LOCAL';auth.factoryPermissions = ['business:wm:stock:document:create', 'business:wm:stock:document:list', 'business:wm:stock:document:query']
  wrapper = mount(Page, { props: { direction: direction as 'IN' | 'OUT' }, global: { plugins: [pinia, ElementPlus], stubs: { MasterDetailDocument: Document, RouterLink: true }}})
  await flushPromises()
  expect(mocks.request.mock.calls.filter(([url]) => url.endsWith('/numbering-rules'))).toHaveLength(0)
  await wrapper.findComponent(Document).get('button').trigger('click');await flushPromises()
  const state = (wrapper.findComponent(Document).vm.$ as unknown as { setupState: { draft: Record<string, unknown> }}).setupState
  expect(state.draft.documentType).toBe(type)
  expect(state.draft.ruleCode).toBe(type)
  expect(wrapper.text()).toContain(`实际前缀 ${prefix}`)
  expect(wrapper.text()).toContain(`本次预览 ${preview}`)
  expect(wrapper.text()).not.toContain('WRONG001')
  expect(mocks.request.mock.calls.filter(([url]) => url.endsWith('/numbering-rules'))).toEqual([
    [`/api/wm/${direction === 'IN' ? 'inbound' : 'outbound'}-documents/numbering-rules`, { scope: 'factory' }]
  ])
  expect(mocks.request.mock.calls.every(([, options]) => !options?.method || options.method === 'GET')).toBe(true)
})
