import { clearDictionaries } from '../src/utils/dictionaries'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { defineComponent } from 'vue'
import ElementPlus from 'element-plus'
import Page from '../src/views/wm/stockDocuments/StockDocumentPage.vue'
import { useAuth } from '../src/stores/auth'

const mocks = vi.hoisted(() => ({ request: vi.fn(), route: { path: '/stock/inboundDocuments', query: {} as Record<string, string> }}))
vi.mock('../src/lib/request', () => ({ request: mocks.request }))
vi.mock('vue-router', async importOriginal => ({ ...await importOriginal<object>(), useRoute: () => mocks.route, useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))
const Material = defineComponent({
  name: 'MaterialSelect',
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: '<div data-test="material">{{ modelValue }}</div>'
})
let wrapper: ReturnType<typeof mount> | undefined
beforeEach(() => {
  vi.clearAllMocks()
  clearDictionaries()
  mocks.route.query = {}
  mocks.request.mockImplementation((url: string) => Promise.resolve(url.includes('/common/dict/') ? { data: [] } : { items: [], total: 0, offset: 0, limit: 20 }))
  vi.stubGlobal('ResizeObserver', class {
    observe() {} unobserve() {} disconnect() {}
  })
})
afterEach(() => {
  wrapper?.unmount()
  vi.unstubAllGlobals()
})

async function setup(direction: 'IN' | 'OUT') {
  const pinia = createPinia(), auth = useAuth(pinia)
  auth.factoryId = 'A'
  auth.factoryPermissions = ['business:wm:stock:document:list']
  wrapper = mount(Page, { props: { direction }, global: { plugins: [pinia, ElementPlus], stubs: { MaterialSelect: Material, RouterLink: true }}})
  await flushPromises()
}

it.each(['IN', 'OUT'] as const)('sends material, batch and bin filters through the real shared %s list', async direction => {
  await setup(direction)
  wrapper!.findComponent(Material).vm.$emit('update:modelValue', '9007199254740999')
  await wrapper!.get('input[placeholder="请输入批次号"]').setValue('LOT-01')
  await wrapper!.get('input[placeholder="请输入库位"]').setValue('BIN-A')
  await wrapper!.get('form').trigger('submit')
  await flushPromises()
  const root = '/api/wm/' + (direction === 'IN' ? 'inbound-documents' : 'outbound-documents')
  expect(mocks.request.mock.calls.filter(([url]) => url === root).at(-1)?.[1].query).toMatchObject({
    materialId: '9007199254740999', batchNo: 'LOT-01', binCode: 'BIN-A', direction, offset: 0
  })
})

it('clears the material safely and resets optional filters while preserving the linked stock scope', async() => {
  mocks.route.query = { stockId: '2420' }
  await setup('IN')
  const material = wrapper!.findComponent(Material)
  material.vm.$emit('update:modelValue', '1')
  await wrapper!.get('input[placeholder="请输入批次号"]').setValue('LOT')
  material.vm.$emit('update:modelValue', null)
  await wrapper!.get('form').trigger('submit')
  await flushPromises()
  let query = mocks.request.mock.calls.filter(([url]) => url === '/api/wm/inbound-documents').at(-1)?.[1].query
  expect(query).toMatchObject({ stockId: '2420', batchNo: 'LOT' })
  expect(query).not.toHaveProperty('materialId')
  await wrapper!.findAll('button').find(button => button.text() === '重置')!.trigger('click')
  await flushPromises()
  query = mocks.request.mock.calls.filter(([url]) => url === '/api/wm/inbound-documents').at(-1)?.[1].query
  expect(query).toMatchObject({ stockId: '2420', direction: 'IN' })
  expect(query).not.toHaveProperty('batchNo')
  expect(query).not.toHaveProperty('binCode')
})
