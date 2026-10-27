import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import { useAuth } from '../src/stores/auth'
import { invalidateQuantityRules } from '../src/lib/production/quantityRuleInvalidation'
import ReceiptAction from '../src/components/business/production/ProductionReceiptAction.vue'
import QuantityInput from '../src/components/business/material/QuantityInput.vue'
import { ApiError } from '../src/lib/request'
const quantityReads = vi.hoisted(() => ({ unit: vi.fn() }))
const calls = vi.hoisted(() => ({ basis: vi.fn(), receive: vi.fn(), confirm: vi.fn() }))
vi.mock('../src/api/wm/stockDocuments', () => ({ stockDocumentPermission: 'business:wm:stock:document', stockDocuments: { productionBasis: calls.basis, receiveProduction: calls.receive }}))
vi.mock('element-plus', async original => ({ ...await original<object>(), ElMessageBox: { confirm: calls.confirm }}))
vi.mock('../src/api/basic/material', () => ({ api: { detail: vi.fn().mockResolvedValue({ unitId: '77' }) }}))
vi.mock('../src/api/basic/unitMeasure', () => ({ api: { detail: quantityReads.unit }}))
let wrapper: ReturnType<typeof mount>
beforeEach(() => {
  sessionStorage.clear(); vi.clearAllMocks(); invalidateQuantityRules();quantityReads.unit.mockResolvedValue({ mustBeWholeNumber: 0, quantityPrecision: 6 })
  calls.basis.mockResolvedValue({ executionId: '9007199254740999', productId: '88', effective: '100', received: '90', remaining: '10', canReceive: true, blockedReason: null })
  calls.receive.mockResolvedValue({ document: { id: '901', status: 'POSTED' }, lines: [] })
  calls.confirm.mockResolvedValue('confirm')
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
})
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = '';vi.unstubAllGlobals() })
async function setup(approve = true) {
  const pinia = createPinia(), auth = useAuth(pinia);auth.factoryId = 'A';auth.runtimeMode = 'LOCAL';auth.username = 'qa'
  auth.factoryPermissions = ['business:material:query', 'business:unit:measure:query', 'business:wm:stock:document:create', ...(approve ? ['business:wm:stock:document:post'] : [])]
  wrapper = mount(ReceiptAction, { props: { executionId: '9007199254740999' }, global: { plugins: [pinia, ElementPlus], stubs: { WarehouseSelect: true, StockSourceSelect: true }}})
  const s = (wrapper.vm.$ as unknown as { setupState: Record<string, any> }).setupState
  s.open();await flushPromises()
  return { s, auth }
}
function fill(s:Record<string, any>) { s.warehouseId = '33';s.stockId = '99';s.selectStock({ id: '99', materialId: '88', warehouseId: '33', batchNo: '000L#x ', binCode: '01' }, '77');s.quantity = '10.000001';s.reason = 'QA 实物核对' }
it('posts one frozen backend command instead of a client-side create/line/approve sequence', async() => {
  const { s } = await setup();fill(s);await flushPromises();await s.submit()
  expect(calls.receive).toHaveBeenCalledExactlyOnceWith('9007199254740999', { requestId: expect.any(String), stockId: '99', quantity: '10.000001', reason: 'QA 实物核对' })
  expect(wrapper.emitted('changed')).toHaveLength(1)
  expect(s.intent.pending.value).toBeNull();expect(sessionStorage.length).toBe(0)
})
it('a creator without approval cannot open or invoke the convenience command', async() => {
  const { s } = await setup(false);fill(s);await flushPromises();await s.submit()
  expect(calls.basis).not.toHaveBeenCalled();expect(calls.receive).not.toHaveBeenCalled();expect(s.visible).toBe(false)
})
it('keeps UUID and full contents unchanged across an unknown response, closing and reopening', async() => {
  const { s } = await setup();fill(s);calls.receive.mockRejectedValueOnce(new Error('lost response'))
  await flushPromises();await s.submit();const first = JSON.parse(JSON.stringify(calls.receive.mock.calls[0]![1]))
  await s.close();s.open();await flushPromises();s.quantity = '99';s.reason = 'edited';await flushPromises();await s.submit()
  expect(calls.receive.mock.calls[1]![1]).toEqual(first)
})
it('a definite local rejection leaves no completed UI state and permits corrected input', async() => {
  const { s } = await setup();fill(s);calls.receive.mockRejectedValueOnce(new ApiError('INSUFFICIENT_STOCK', '数量超额', '', 409))
  await flushPromises();await s.submit();expect(s.intent.pending.value).toBeNull();expect(wrapper.emitted('changed')).toBeUndefined();expect(s.intent.error.value).toContain('数量超额')
  s.quantity = '1';await flushPromises();await s.submit();expect(calls.receive.mock.calls[1]![1].requestId).not.toBe(calls.receive.mock.calls[0]![1].requestId)
})
it.each(['factory', 'permission', 'close'])('rejects a late completion after %s changes and preserves original recovery intent', async mode => {
  const { s, auth } = await setup();fill(s);let finish!:(v:unknown) => void
  calls.receive.mockImplementationOnce(() => new Promise(resolve => finish = resolve));await flushPromises();const pending = s.submit();await flushPromises()
  if (mode === 'factory')auth.factoryId = 'B';else if (mode === 'permission')auth.factoryPermissions = [];else await s.close()
  await flushPromises();finish({ document: { id: 'late' }, lines: [] });await pending
  expect(wrapper.emitted('changed')).toBeUndefined();expect(s.visible).toBe(false);expect(s.basis).toBeNull()
  expect(sessionStorage.getItem('production-receipt:qa:A:9007199254740999')).toContain('requestId')
})
it('an unreadable quantity basis remains an explicit retry region and cannot create a receipt', async() => {
  calls.basis.mockRejectedValueOnce(new Error('数量依据不可读取'));const { s } = await setup();fill(s);await flushPromises();await s.submit()
  expect(s.error).toContain('核对可入库数量');expect(calls.receive).not.toHaveBeenCalled()
  await s.load();expect(s.basis.remaining).toBe('10')
})

it.each(['', '0', '-1', '1.2345678'])('does not freeze or post an invalid new receipt quantity %j', async quantity => {
  const { s } = await setup(); fill(s); await flushPromises()
  await wrapper.findComponent(QuantityInput).get('input').setValue(quantity)
  await flushPromises(); await s.submit()
  expect(calls.receive).not.toHaveBeenCalled()
  expect(s.intent.pending.value).toBeNull()
  expect(sessionStorage.length).toBe(0)
})

it('normalizes only a new receipt command without losing significant decimals', async() => {
  const { s } = await setup(); fill(s); await flushPromises()
  await wrapper.findComponent(QuantityInput).get('input').setValue('1.234500000')
  await flushPromises(); await s.submit()
  expect(calls.receive.mock.calls[0]![1].quantity).toBe('1.2345')
})

it.each([
  { whole: 1, precision: 0 },
  { whole: 0, precision: 2 }
])('settles only the exact trusted old receipt remainder with rule $whole/$precision', async({ whole, precision }) => {
  quantityReads.unit.mockResolvedValue({ mustBeWholeNumber: whole, quantityPrecision: precision })
  calls.basis.mockResolvedValue({ executionId: '9007199254740999', productId: '88', effective: '1.234567', received: '0', remaining: '1.234567', canReceive: true, blockedReason: null })
  const { s } = await setup();fill(s);s.quantity = '0.234567'
  await flushPromises();await s.submit()
  expect(calls.receive).not.toHaveBeenCalled();expect(s.intent.pending.value).toBeNull()
  s.quantity = '1.234567';await flushPromises();await s.submit()
  expect(calls.receive.mock.calls[0]![1].quantity).toBe('1.234567')
})

it('keeps compliant partial receipt quantities valid after tightening and rejects an obsolete remainder after refresh', async() => {
  quantityReads.unit.mockResolvedValue({ mustBeWholeNumber: 1, quantityPrecision: 0 })
  calls.basis.mockResolvedValue({ executionId: '9007199254740999', productId: '88', effective: '2.234567', received: '0', remaining: '2.234567', canReceive: true, blockedReason: null })
  const { s } = await setup();fill(s);s.quantity = '1'
  await flushPromises();await s.submit()
  expect(calls.receive.mock.calls[0]![1].quantity).toBe('1')
  calls.receive.mockClear();s.quantity = '2.234567';s.reason = '重新核对余量'
  calls.basis.mockResolvedValueOnce({ executionId: '9007199254740999', productId: '88', effective: '2.234567', received: '1', remaining: '1.234567', canReceive: true, blockedReason: null })
  await s.load();await flushPromises();await s.submit()
  expect(calls.receive).not.toHaveBeenCalled()
})

it('does not mistake another execution remainder for settlement when the execution changes', async() => {
  quantityReads.unit.mockResolvedValue({ mustBeWholeNumber: 1, quantityPrecision: 0 })
  calls.basis.mockResolvedValue({ executionId: '9007199254740999', productId: '88', effective: '1.234567', received: '0', remaining: '1.234567', canReceive: true, blockedReason: null })
  const { s } = await setup();fill(s);s.quantity = '1.234567';await flushPromises()
  expect(s.quantityValid).toBe(true)
  await wrapper.setProps({ executionId: '123' });await flushPromises()
  expect(s.basis).toBeNull();expect(s.quantityValid).toBe(false)
  await s.submit();expect(calls.receive).not.toHaveBeenCalled()
})
