import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import { useAuth } from '../src/stores/auth'
import Legacy from '../src/views/production/productionReceipt/index.vue'
const calls = vi.hoisted(() => ({ page: vi.fn() }))
vi.mock('../src/api/production/productionReceipt', () => ({ receiptPermissions: { list: 'business:production:receipt:list' }, productionReceipt: { page: calls.page }}))
let w:ReturnType<typeof mount>
beforeEach(() => { vi.clearAllMocks();calls.page.mockResolvedValue({ items: [], total: 0 });vi.stubGlobal('ResizeObserver', class {observe() {}disconnect() {}unobserve() {}}) })
afterEach(() => { w?.unmount();vi.unstubAllGlobals() })
function setup() { const p = createPinia(), a = useAuth(p);a.factoryId = 'A';a.factoryPermissions = ['business:production:receipt:list'];w = mount(Legacy, { global: { plugins: [p, ElementPlus], stubs: { RouterLink: true, WarehouseAcceptancePanel: true }}});return a }
it('retains a read-only historical route and sends no business commands', async() => { setup();await flushPromises();expect(calls.page).toHaveBeenCalledOnce();expect(w.text()).toContain('旧流程物流历史');expect(w.text()).not.toContain('登记交接');expect(w.text()).not.toContain('确认冲销') })
it('scope changes discard a late historical response', async() => { let resolve!:(v:unknown) => void;calls.page.mockImplementationOnce(() => new Promise(r => resolve = r));const auth = setup();auth.factoryId = 'B';await flushPromises();resolve({ items: [{ id: 'stale', receiptNo: 'STALE' }], total: 1 });await flushPromises();expect(w.text()).not.toContain('STALE') })

it('uses the authorized inbound workspace for the historical page action', async() => {
  const auth = setup()
  auth.factoryMenus = [{ id: 'inbound', name: '入库单', path: '/custom/inbound', component: 'wm/inboundDocuments/index', kind: 'MENU', permission: 'read', children: [] }]
  await flushPromises()
  expect((w.vm as unknown as { inboundPath: string }).inboundPath).toBe('/custom/inbound')
})
