import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ElementPlus, { ElMessageBox } from 'element-plus'
import { createMemoryHistory, createRouter } from 'vue-router'
import { KeepAlive, defineComponent, h, ref } from 'vue'
import { createPinia } from 'pinia'
import { useAuth } from '../src/stores/auth'
import { invalidateQuantityRules } from '../src/lib/production/quantityRuleInvalidation'
import { ApiError } from '../src/lib/request'
import Panel from '../src/components/business/warehouse/LocalStockPanel.vue'
import QuantityInput from '../src/components/business/material/QuantityInput.vue'
const calls = vi.hoisted(() => ({ detail: vi.fn(), actions: vi.fn(), execute: vi.fn() }))
vi.mock('../src/api/wm/wmInventory', () => ({ api: { detail: calls.detail }}))
vi.mock('../src/api/wm/localStock', async importOriginal => ({ ...(await importOriginal<object>()), localStock: { actions: calls.actions, execute: calls.execute }}))
vi.mock('../src/api/basic/material', () => ({ api: { detail: vi.fn().mockResolvedValue({ unitId: '77' }) }}))
vi.mock('../src/api/basic/unitMeasure', () => ({ api: { detail: vi.fn().mockResolvedValue({ mustBeWholeNumber: 0, quantityPrecision: 6 }) }}))
let wrapper: ReturnType<typeof mount>
beforeEach(() => { sessionStorage.clear();vi.clearAllMocks();invalidateQuantityRules();vi.stubGlobal('ResizeObserver', class {observe() {}unobserve() {}disconnect() {}});calls.detail.mockResolvedValue({ id: '9007199254740999', quantity: '800.000001', availableQuantity: '700.000001', materialId: '1', warehouseId: '2', warehouseSource: 'LOCAL', batchNo: 'LOT', binCode: 'BIN' });calls.actions.mockResolvedValue({ items: [], total: 0 });calls.execute.mockResolvedValue({ id: 'done' }) })
afterEach(() => { wrapper?.unmount();document.body.innerHTML = '';vi.unstubAllGlobals();vi.restoreAllMocks() })
async function setup(write = true) { const pinia = createPinia(), auth = useAuth(pinia);auth.factoryId = 'A';auth.runtimeMode = 'LOCAL';auth.factoryMenus = [{ id: 'inbound', name: '入库单', path: '/wm/inboundDocuments', component: 'wm/inboundDocuments/index', kind: 'MENU', permission: 'business:wm:stock:document:list', children: [] }, { id: 'stock', name: '出入库单', path: '/wm/stockDocuments', component: 'wm/outboundDocuments/index', kind: 'MENU', permission: 'business:wm:stock:document:list', children: [] }];auth.factoryPermissions = ['business:material:query', 'business:unit:measure:query', 'business:wm:inventory:query', 'business:wm:stock:action:list', ...(write ? ['business:wm:stock:gain'] : [])];const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' }}, { path: '/wm/stockDocuments', component: { template: '<div />' }}] });await router.push('/');wrapper = mount(Panel, { global: { plugins: [pinia, ElementPlus, router] }});const s = (wrapper.vm.$ as unknown as { setupState: Record<string, any> }).setupState;s.open('9007199254740999');await flushPromises();return { s, auth, router } }
it('sends exact decimal strings and server balance preconditions without client actor or fabricated facts', async() => { const { s } = await setup();Object.assign(s.form, { quantity: '0.000001', reason: 'TEST 盘盈核对' });await flushPromises();await s.submit();const command = calls.execute.mock.calls[0]![1];expect(command).toMatchObject({ stockId: '9007199254740999', quantity: '0.000001', expectedQuantity: '800.000001', expectedAvailable: '700.000001' });expect(command).not.toHaveProperty('operatorUserId');expect(command).not.toHaveProperty('quantityAfter');expect(s.pending).toBeNull() })
it('freezes the request after uncertainty and restores it on reopen', async() => { const { s } = await setup();Object.assign(s.form, { quantity: '3', reason: 'TEST arrival' });calls.execute.mockRejectedValueOnce(new Error('lost response'));await flushPromises();await s.submit();const first = JSON.parse(JSON.stringify(calls.execute.mock.calls[0]![1]));wrapper.unmount();const { s: again } = await setup();Object.assign(again.form, { quantity: '999', reason: 'changed' });await flushPromises();await again.submit();expect(calls.execute.mock.calls[1]![1]).toEqual(first) })
it.each(['factory', 'permission'])('rejects late balance and action results after %s changes', async type => { const { s, auth } = await setup();let release!:(v:unknown) => void;calls.detail.mockImplementationOnce(() => new Promise(r => release = r));const waiting = s.load();if (type === 'factory')auth.factoryId = 'B';else auth.factoryPermissions = [];await flushPromises();release({ id: 'old', quantity: '999' });await waiting;expect(s.stock).toBeNull();expect(s.rows).toEqual([]);expect(s.visible).toBe(false) })
it('read permission does not authorize a stock command', async() => { const { s } = await setup(false);Object.assign(s.form, { quantity: '3', reason: 'TEST' });await flushPromises();await s.submit();expect(calls.execute).not.toHaveBeenCalled() })
it('retains a previously unknown request after a later rejection', async() => { const { s } = await setup();Object.assign(s.form, { quantity: '3', reason: 'TEST' });calls.execute.mockRejectedValueOnce(new Error('lost')).mockRejectedValueOnce(new ApiError('FORBIDDEN', '撤权', '', 403));await flushPromises();await s.submit();const first = JSON.parse(JSON.stringify(calls.execute.mock.calls[0]![1]));await flushPromises();await s.submit();expect(s.pending.command).toEqual(first);expect(sessionStorage.length).toBeGreaterThan(0) })

it('does not execute local actions for external mirror inventory but keeps original uncertain UUID recovery', async() => {
  const { s, auth } = await setup();calls.detail.mockResolvedValueOnce({ id: '9007199254740999', quantity: '0', availableQuantity: '0', warehouseSource: 'EXTERNAL' });await s.load();Object.assign(s.form, { quantity: '1', reason: 'TEST' });await flushPromises();await s.submit();expect(calls.execute).not.toHaveBeenCalled()
  calls.detail.mockResolvedValueOnce({ id: '9007199254740999', quantity: '800', availableQuantity: '700', materialId: '1', warehouseSource: 'LOCAL' });await s.load();calls.execute.mockRejectedValueOnce(new Error('lost'));await flushPromises();await s.submit();const first = JSON.parse(JSON.stringify(s.pending.command));auth.runtimeMode = 'ERP';calls.execute.mockRejectedValueOnce(new ApiError('BUSINESS_SOURCE_CONFLICT', '按原请求核实', '', 409));await flushPromises();await s.submit();expect(calls.execute.mock.calls[1]![1]).toEqual(first);expect(s.pending.command).toEqual(first)
})

it('selects the first permitted local operation after loading source metadata', async() => {
  const { s, auth } = await setup(false);auth.factoryPermissions = ['business:material:query', 'business:unit:measure:query', 'business:wm:inventory:query', 'business:wm:stock:action:list', 'business:wm:stock:gain'];s.open('9007199254740999');await flushPromises();expect(s.operation).toBe('gain');Object.assign(s.form, { quantity: '1', reason: 'TEST gain' });await flushPromises();await s.submit();expect(calls.execute.mock.calls[0]![0]).toBe('gain')
})

it('closes the stock drawer before navigating to material issues and rejects late reads', async() => {
  const { s, router } = await setup();let release!:(v:unknown) => void
  calls.detail.mockImplementationOnce(() => new Promise(r => release = r));const reading = s.load()
  await s.openIssues();await flushPromises()
  expect(router.currentRoute.value.path).toBe('/wm/stockDocuments');expect(router.currentRoute.value.query).toEqual({ documentType: 'MATERIAL_ISSUE' });expect(s.visible).toBe(false)
  release({ id: 'late', quantity: '999' });await reading;expect(s.stock).toBeNull()
  expect(calls.execute).not.toHaveBeenCalled()
})
it('keeps unsaved stock input and the drawer when navigation discard is cancelled', async() => {
  const { s, router } = await setup();Object.assign(s.form, { quantity: '2', reason: '未保存' })
  vi.spyOn(ElMessageBox, 'confirm').mockRejectedValueOnce('cancel')
  await s.openIssues();expect(router.currentRoute.value.path).toBe('/');expect(s.visible).toBe(true);expect(s.form.quantity).toBe('2')
})
it('preserves the frozen uncertain request when leaving for issue verification', async() => {
  const { s, router } = await setup();Object.assign(s.form, { quantity: '2', reason: 'TEST' })
  calls.execute.mockRejectedValueOnce(new Error('lost'));await flushPromises();await s.submit()
  const frozen = sessionStorage.getItem(sessionStorage.key(0)!)
  // Element Plus intersects its confirm/message/prompt overload return types.
  vi.spyOn(ElMessageBox, 'confirm').mockResolvedValueOnce('confirm' as never)
  await s.openIssues();await flushPromises()
  expect(router.currentRoute.value.path).toBe('/wm/stockDocuments');expect(s.visible).toBe(false)
  expect(sessionStorage.getItem(sessionStorage.key(0)!)).toBe(frozen);expect(calls.execute).toHaveBeenCalledTimes(1)
})
it('closes a deactivated cached stock drawer and rejects its pending read', async() => {
  const pinia = createPinia(), auth = useAuth(pinia);auth.factoryId = 'A';auth.runtimeMode = 'LOCAL'
  auth.factoryPermissions = ['business:material:query', 'business:unit:measure:query', 'business:wm:inventory:query', 'business:wm:stock:action:list']
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' }}] });await router.push('/')
  const shown = ref(true)
  wrapper = mount(defineComponent({ setup: () => () => h(KeepAlive, null, { default: () => shown.value ? h(Panel) : null }) }), { global: { plugins: [pinia, ElementPlus, router] }})
  const panel = wrapper.findComponent(Panel), s = (panel.vm.$ as unknown as { setupState: Record<string, any> }).setupState
  s.open('9007199254740999');await flushPromises()
  let release!:(v:unknown) => void;calls.detail.mockImplementationOnce(() => new Promise(r => release = r));const reading = s.load()
  shown.value = false;await flushPromises();expect(s.visible).toBe(false)
  release({ id: 'late', quantity: '999' });await reading;expect(s.stock).toBeNull();expect(s.rows).toEqual([])
  shown.value = true;await flushPromises();expect(s.visible).toBe(false)
})

it('does not offer a new raw receipt even with its old permission', async() => { const { s, auth } = await setup(false);auth.factoryPermissions.push('business:wm:stock:receipt');s.open('9007199254740999');await flushPromises();expect(s.options.some((o:any) => o.value === 'receipt')).toBe(false);Object.assign(s.form, { quantity: '1', reason: 'TEST' });await flushPromises();await s.submit();expect(calls.execute).not.toHaveBeenCalled() })
it('can replay a pre-convergence raw receipt UUID while offering no new receipt command', async() => { const { s, auth } = await setup(false);auth.factoryPermissions.push('business:wm:stock:receipt');await flushPromises();const command = { requestId: '8e112c7b-f726-46cc-9d31-a6a6b2194902', stockId: '9007199254740999', quantity: '1', expectedQuantity: '800', expectedAvailable: '700', reason: 'TEST old immutable request', issueId: null };sessionStorage.setItem(`mes-stock-pending:${auth.username}:${auth.factoryId}:9007199254740999`, JSON.stringify({ operation: 'receipt', command }));s.open('9007199254740999');await flushPromises();await flushPromises();await s.submit();expect(calls.execute).toHaveBeenCalledWith('receipt', command) })

it.each(['', '0', '-1'])('rejects an invalid gain quantity %j before creating an intent', async quantity => {
  const { s } = await setup(); s.form.reason = 'TEST gain direction'
  await wrapper.findComponent(QuantityInput).get('input').setValue(quantity)
  await flushPromises(); await s.submit()
  expect(calls.execute).not.toHaveBeenCalled(); expect(s.pending).toBeNull()
})

it('permits a negative correction while preserving its exact decimal delta', async() => {
  const { s, auth } = await setup(false)
  auth.factoryPermissions.push('business:wm:stock:correction'); await flushPromises()
  s.open('9007199254740999'); await flushPromises(); s.form.reason = 'TEST signed correction'
  await wrapper.findComponent(QuantityInput).get('input').setValue('-0.123456000')
  await flushPromises(); await s.submit()
  expect(calls.execute).toHaveBeenCalledWith('correction', expect.objectContaining({ quantity: '-0.123456' }))
})

it('submits new returns with the unified document identity', async() => {
  const { s, auth } = await setup(false);auth.factoryPermissions.push('business:wm:stock:return');await flushPromises()
  s.open('9007199254740999');await flushPromises();s.operation = 'return';Object.assign(s.form, { quantity: '1', reason: 'TEST 退料', documentId: '9007199254740998' });await flushPromises();await s.submit()
  expect(calls.execute).toHaveBeenCalledWith('return', expect.objectContaining({ documentId: '9007199254740998' }))
  expect(calls.execute.mock.calls[0]![1]).not.toHaveProperty('issueId')
})
it('replays an older uncertain return with the original request and issue identity intact', async() => {
  const { s, auth } = await setup(false);auth.factoryPermissions.push('business:wm:stock:return');await flushPromises()
  const command = { requestId: '8e112c7b-f726-46cc-9d31-a6a6b2194902', stockId: '9007199254740999', quantity: '1', expectedQuantity: '800', expectedAvailable: '700', reason: 'TEST old', issueId: '47' }
  sessionStorage.setItem(`mes-stock-pending:${auth.username}:${auth.factoryId}:9007199254740999`, JSON.stringify({ operation: 'return', command }))
  s.open('9007199254740999');await flushPromises();await s.submit();expect(calls.execute).toHaveBeenCalledWith('return', command)
})
