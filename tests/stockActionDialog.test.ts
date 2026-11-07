import { afterEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import Dialog from '../src/views/wm/stockDocuments/StockActionDialog.vue'
import { useAuth } from '../src/stores/auth'
const mocks = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('../src/lib/request', () => ({ request: mocks.request }))
let wrapper: ReturnType<typeof mount> | undefined
const record = { id: 'INTERNAL-HASH', stockId: 'INTERNAL-STOCK', operationId: 'INTERNAL-REQUEST', documentLineId: 'INTERNAL-LINE', batchNo: 'LOT-01', binCode: 'A01', quantityDelta: '3', quantityBefore: '0', quantityAfter: '3', occurredAt: '2026-11-07T10:00:00', reason: '收货清点' }
afterEach(() => { wrapper?.unmount(); vi.clearAllMocks() })
function setup() {
  const pinia = createPinia(), auth = useAuth(pinia)
  auth.factoryId = 'A';auth.factoryPermissions = ['business:wm:stock:action:query']
  wrapper = mount(Dialog, { global: { plugins: [pinia, ElementPlus], stubs: { teleport: true }}})
  return { auth, state: (wrapper.vm.$ as unknown as { setupState: Record<string, any> }).setupState }
}
it('shows movement facts without hashes or internal foreign keys', async() => {
  mocks.request.mockResolvedValue(record)
  const { state } = setup();await state.open('INTERNAL-HASH');await flushPromises()
  expect(wrapper!.text()).toContain('LOT-01');expect(wrapper!.text()).toContain('收货清点')
  expect(wrapper!.text()).not.toContain('INTERNAL-')
})
it('invalidates an in-flight record immediately on close and on factory switch', async() => {
  let finish!: (value: unknown) => void
  mocks.request.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const { auth, state } = setup()
  const opening = state.open('first');state.visible = false;finish(record);await opening
  expect(state.action).toBeNull();expect(state.visible).toBe(false)
  const next = state.open('second');auth.factoryId = 'B';finish(record);await next
  expect(state.action).toBeNull();expect(state.visible).toBe(false)
})
