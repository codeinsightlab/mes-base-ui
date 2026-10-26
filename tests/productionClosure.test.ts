import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import { useAuth } from '../src/stores/auth'
import Panel from '../src/components/business/production/ProductionClosurePanel.vue'
import Acceptance from '../src/components/business/warehouse/WarehouseAcceptancePanel.vue'
const calls = vi.hoisted(() => ({ summary: vi.fn(), recheckReceipt: vi.fn(), release: vi.fn(), history: vi.fn(), execute: vi.fn(), state: vi.fn(), acceptHistory: vi.fn(), acceptExecute: vi.fn(), stock: vi.fn() }))
vi.mock('../src/api/production/productionClosure', () => ({ productionClosure: { summary: calls.summary, recheckReceipt: calls.recheckReceipt, release: calls.release, history: calls.history, execute: calls.execute }}))
vi.mock('../src/api/wm/warehouseAcceptance', () => ({ warehouseAcceptance: { state: calls.state, history: calls.acceptHistory, execute: calls.acceptExecute }}))
vi.mock('../src/api/wm/wmInventory', () => ({ api: { list: calls.stock }}))
let wrapper:ReturnType<typeof mount>
beforeEach(() => { sessionStorage.clear();vi.clearAllMocks();vi.stubGlobal('ResizeObserver', class {observe() {}unobserve() {}disconnect() {}});calls.summary.mockResolvedValue({ executionId: '9007199254740999', status: 'RUNNING', targetQty: '100', effective: '94.000001', receivedQty: '80', defectQty: '6', receiptState: 'PARTIAL', orderBlockedReason: '还有执行未完全入库', received: '80', accepted: '80', remainingHandover: '14.000001', pendingAcceptance: '0', blockedReason: '投入数量与报工及不良未闭合', completion: null });calls.release.mockResolvedValue({ currentReleaseId: 'prior', basisHash: 'basis', basisValid: true });calls.history.mockResolvedValue({ items: [], total: 0 });calls.execute.mockResolvedValue({ id: 'done' });calls.state.mockResolvedValue({ receiptId: 'receipt', executionId: '1', productId: '2', warehouseId: '3', pending: '20.000001', accepted: '60', netHandover: '80.000001' });calls.acceptHistory.mockResolvedValue({ items: [], total: 0 });calls.acceptExecute.mockResolvedValue({ id: 'done' });calls.stock.mockResolvedValue({ items: [], total: 0 }) })
afterEach(() => { wrapper?.unmount();document.body.innerHTML = '';vi.unstubAllGlobals() })
async function setup(accept = false, write = true) { const pinia = createPinia(), auth = useAuth(pinia);auth.factoryId = 'A';auth.factoryPermissions = ['business:mes:production:execution:query', 'business:wm:acceptance:read', ...(write ? ['business:production:execution:complete', 'business:wm:acceptance:create', 'business:wm:acceptance:reverse'] : [])];wrapper = mount(accept ? Acceptance : Panel, { props: accept ? { receiptId: 'receipt' } : { id: '9007199254740999' }, global: { plugins: [pinia, ElementPlus], stubs: { RouterLink: { props: ['to'], template: '<a :href="to.path"><slot /></a>' }}}});const s = (wrapper.vm.$ as unknown as { setupState: Record<string, any> }).setupState;s.open();await flushPromises();return { s, auth } }
it('reads receipt quantities without quality release permissions or API calls', async() => { const { s } = await setup(false, false);expect(s.data.effective).toBe('94.000001');expect(calls.summary).toHaveBeenCalledWith('9007199254740999');expect(calls.release).not.toHaveBeenCalled();expect(calls.history).not.toHaveBeenCalled();expect(calls.execute).not.toHaveBeenCalled();expect(document.body.querySelector('[title="94.000001"]')?.textContent).toBe('94.000001');expect(document.body.textContent).not.toContain('放行');expect(document.body.querySelector('form')).toBeNull() })
it.each(['factory', 'permission'])('drops late closure summaries after %s changes', async mode => { const { s, auth } = await setup();let finish!:(v:unknown) => void;calls.summary.mockImplementationOnce(() => new Promise(r => finish = r));const task = s.load();if (mode === 'factory')auth.factoryId = 'B';else auth.factoryPermissions = [];await flushPromises();finish({ executionId: 'stale' });await task;expect(s.data).toBeNull();expect(s.visible).toBe(false) })
it('shows completed receipt as a normal terminal state', async() => { calls.summary.mockResolvedValueOnce({ executionId: '9007199254740999', status: 'FULLY_RECEIVED', targetQty: '100', effective: '94', receivedQty: '94', defectQty: '6', receiptState: 'FULLY_RECEIVED', orderBlockedReason: null, completion: { id: 'complete-id', effectiveQty: '94', inboundQty: '94' }});const { s } = await setup();expect(s.canRecheck).toBe(false);expect(document.body.textContent).toContain('入库收尾记录：complete-id');expect(document.body.textContent).not.toContain('历史完工');expect(document.body.textContent).not.toContain('放行') })
it('does not restore retired release or manual completion requests into an active command', async() => { const original = { action: 'release', body: { requestId: 'old-release', reason: '原请求' }};sessionStorage.setItem('mes-closure::A:9007199254740999', JSON.stringify(original));const { s } = await setup();expect(s.pending).toBeUndefined();expect(calls.execute).not.toHaveBeenCalled();expect(sessionStorage.getItem('mes-closure::A:9007199254740999')).toBe(JSON.stringify(original));expect(document.body.textContent).not.toContain('核实原请求') })
it('shows an explicit retry when summary reading fails', async() => { calls.summary.mockRejectedValueOnce(new Error('数量读取失败'));const { s } = await setup();expect(s.data).toBeNull();expect(document.body.textContent).toContain('数量读取失败');const button = Array.from(document.body.querySelectorAll('button')).find(button => button.textContent?.includes('重试读取'))!;expect(button).toBeTruthy();button.click();await flushPromises();expect(s.data.effective).toBe('94.000001') })

it('uses the authorized menu path for the unified inbound document link', async() => { const { s, auth } = await setup();auth.factoryMenus = [{ id: 'inbound', name: '入库单', path: '/custom/inbound', component: 'wm/stockDocuments/index', kind: 'MENU', permission: 'read', children: [] }];await flushPromises();expect(s.inboundPath).toBe('/custom/inbound');expect(document.body.querySelector('a[href="/custom/inbound"]')?.textContent).toContain('办理入库单') })

it.each([['PENDING', '待入库'], ['PARTIAL', '部分入库'], ['FULLY_RECEIVED', '完全入库']])('shows actual receipt state %s independently of order completion', async(receiptState, label) => { calls.summary.mockResolvedValueOnce({ executionId: '9007199254740999', status: receiptState === 'FULLY_RECEIVED' ? 'FULLY_RECEIVED' : 'RUNNING', effective: '90', receivedQty: '90', defectQty: '10', receiptState, orderBlockedReason: '计划数量尚未满足', completion: null });await setup();expect(document.body.textContent + wrapper.text()).toContain(label);expect(document.body.textContent).toContain('工单未完结：计划数量尚未满足');expect(document.body.textContent).not.toContain('自动生产完工') })

it('uses the explicit receipt recheck button and displays remaining blockers without declaring completion', async() => {
  const { s } = await setup()
  calls.recheckReceipt.mockResolvedValueOnce({ ...s.data, receivedQty: '100', effective: '100', blockedReason: '存在未决领料草稿', orderBlockedReason: '工单尚有未完成执行' })
  const button = Array.from(document.body.querySelectorAll('button')).find(button => button.textContent?.includes('复查入库收尾'))!
  expect(button).toBeTruthy();button.click();await flushPromises()
  expect(calls.recheckReceipt).toHaveBeenCalledWith('9007199254740999')
  expect(calls.execute).not.toHaveBeenCalled()
  expect(document.body.textContent).toContain('存在未决领料草稿')
  expect(document.body.textContent).toContain('工单未完结：工单尚有未完成执行')
  expect(document.body.textContent).toContain('尚未满足完全入库条件')
  expect(wrapper.emitted('changed')).toBeUndefined()
})

it.each(['factory', 'permission'])('rejects a late recheck result after %s changes', async mode => {
  const { s, auth } = await setup();let finish!:(v:unknown) => void
  calls.recheckReceipt.mockImplementationOnce(() => new Promise(resolve => finish = resolve))
  const task = s.recheck()
  if (mode === 'factory')auth.factoryId = 'B';else auth.factoryPermissions = []
  await flushPromises();finish({ executionId: 'stale', status: 'FULLY_RECEIVED', receiptState: 'FULLY_RECEIVED' });await task
  expect(s.data).toBeNull();expect(s.rechecking).toBe(false);expect(s.recheckMessage).toBe('');expect(wrapper.emitted('changed')).toBeUndefined()
})

it('does not offer recheck without its permission or for inactive, unknown and fully received execution states', async() => {
  const { s } = await setup(false, false);expect(s.canRecheck).toBe(false);await s.recheck();expect(calls.recheckReceipt).not.toHaveBeenCalled()
  wrapper.unmount();const { s: writer } = await setup();expect(writer.canRecheck).toBe(true)
  for (const status of ['READY', 'UNRECOGNIZED', 'FULLY_RECEIVED', 'CANCELLED']) { writer.data = { ...writer.data, status, orderBlockedReason: null };expect(writer.canRecheck).toBe(false) }
})

it('rechecks through the receipt rule and keeps an unfinished order distinct from full execution receipt', async() => {
  const { s } = await setup();calls.recheckReceipt.mockResolvedValueOnce({ ...s.data, status: 'FULLY_RECEIVED', receiptState: 'FULLY_RECEIVED', orderBlockedReason: '计划数量尚未满足' })
  await s.recheck();await flushPromises()
  expect(s.data.status).toBe('FULLY_RECEIVED');expect(s.canRecheck).toBe(true)
  expect(document.body.textContent).toContain('工单未完结：计划数量尚未满足')
  expect(document.body.textContent).toContain('工单是否完结以当前工单状态和阻断原因为准')
  expect(wrapper.emitted('changed')).toHaveLength(1)
})

it('can recheck an unfinished order through its fully received execution after the order blocker is removed', async() => {
  calls.summary.mockResolvedValueOnce({ executionId: '9007199254740999', status: 'FULLY_RECEIVED', receiptState: 'FULLY_RECEIVED', effective: '100', receivedQty: '100', defectQty: '0', orderBlockedReason: '工单仍有未归属执行的领料草稿', completion: { id: 'original-receipt', effectiveQty: '100', inboundQty: '100' }})
  const { s } = await setup();expect(s.canRecheck).toBe(true)
  calls.recheckReceipt.mockResolvedValueOnce({ ...s.data, orderBlockedReason: null })
  const button = Array.from(document.body.querySelectorAll('button')).find(button => button.textContent?.includes('复查工单收尾'))!
  expect(button).toBeTruthy();button.click();await flushPromises()
  expect(calls.recheckReceipt).toHaveBeenCalledExactlyOnceWith('9007199254740999');expect(calls.execute).not.toHaveBeenCalled()
  expect(s.data.completion.id).toBe('original-receipt');expect(s.data.orderBlockedReason).toBeNull();expect(s.canRecheck).toBe(false)
  expect(document.body.textContent).not.toContain('工单未完结：')
})
