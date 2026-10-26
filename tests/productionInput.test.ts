import { invalidateQuantityRules } from '../src/lib/production/quantityRuleInvalidation'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import Input from '../src/views/production/productionInput/index.vue'
import { useAuth } from '../src/stores/auth'
const rules = vi.hoisted(() => ({ material: vi.fn(), unit: vi.fn() }))
vi.mock('../src/api/basic/material', () => ({ api: { detail: rules.material } }))
vi.mock('../src/api/basic/unitMeasure', () => ({ api: { detail: rules.unit } }))
const { query, preview, calculate, submit, draft } = vi.hoisted(() => ({ query: vi.fn(), preview: vi.fn(), calculate: vi.fn(), submit: vi.fn(), draft: vi.fn() }))
vi.mock('../src/api/production/productionInput', () => ({ inputPermission: 'business:mes:material:issue:update', productionInput: { query, preview, calculate, submit, draft }}))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
const stock = { reference: '1', materialId: '1', materialCode: 'M1', lotCode: '000L', warehouseId: '1', warehouseCode: 'W1', binCode: 'B1', unitId: '1', unitCode: 'KG', availableQty: '1000.000001', observedAt: '2026-10-16T10:00:00' }
const order = { productId:'2', workorderId: '1', workorderCode: 'WO1', productCode: 'P1', productName: '控制臂', workCenter: 'CENTER', plannedQty: '1000', outputUnitCode: 'PCS', status: 'RELEASED', allowedWarehouses: ['1'] }
const definition = { routing: { id: '7', code: 'R1', name: '加工', version: 2 }, products: [], nodes: [{ id: '11', nodeCode: 'A', operationId: '1', operationName: '钻孔', displayOrder: 99, isKey: false, description: null }], edges: [] }
type State = { code: string; orderId: string; stockId: string; outputQty: string; selected: string[]; query: () => Promise<void>; calculate: () => Promise<void>; submit: () => Promise<void>; supply: unknown; preview: unknown; pending: { requestId: string } | null; result: { executionId: string } | null }
let wrapper:ReturnType<typeof mount>
beforeEach(() => { sessionStorage.clear(); vi.resetAllMocks();invalidateQuantityRules();rules.material.mockResolvedValue({unitId:'u'});rules.unit.mockResolvedValue({mustBeWholeNumber:0,quantityPrecision:6}); vi.stubGlobal('ResizeObserver', class {observe() {} unobserve() {} disconnect() {}}); query.mockResolvedValue({ sourceMode: 'LOCAL_ONLY', stocks: [stock], orders: [order] }); preview.mockResolvedValue({ definition, actual: null }); calculate.mockResolvedValue({ sourceMode: 'LOCAL_ONLY', order, stock, outputQty: '100', issueQty: '200.000000', calculationKey: 'freeze-1' }); submit.mockResolvedValue({ requestId: 'r', issueId: '2', executionId: '3', code: 'WO1:P1#000L', status: 'CONFIRMED', productionInputQty: '100', availableQty: '100' }) })
afterEach(() => { wrapper?.unmount();document.body.innerHTML = '' })
async function setup() { const pinia = createPinia(), auth = useAuth(pinia);auth.factoryId = 'A';auth.runtimeMode = 'LOCAL';auth.factoryPermissions = ['business:material:query','business:unit:measure:query','business:mes:material:issue:update', 'business:wm:stock:document:create', 'business:wm:stock:document:update', 'business:wm:stock:document:post'];wrapper = mount(Input, { global: { plugins: [pinia, ElementPlus], stubs: { RoutingGraphPreview: true }}});const s = wrapper.vm as unknown as State;s.code = 'WO1:M1#000L';await s.query();await flushPromises();return { s, auth } }
it('queries without writes, auto-selects only one order, and keeps separate material and output quantities', async() => { const { s } = await setup();expect(s.orderId).toBe('1');expect(submit).not.toHaveBeenCalled();expect(wrapper.text()).toContain('独立 MES');s.stockId = '1';s.outputQty = '100';await flushPromises();await s.calculate();expect(wrapper.text()).toContain('200');s.selected = ['11'];await s.submit();expect(submit.mock.calls[0]![0]).toMatchObject({ code: 'WO1:M1#000L', outputQty: '100', calculationKey: 'freeze-1', inputKind: 'PRODUCTION_INPUT' });expect(submit.mock.calls[0]![0]).not.toHaveProperty('issueQty');expect(wrapper.text()).toContain('3') })
it('keeps an unmatched workorder and product empty rather than choosing another order', async() => { query.mockResolvedValue({ sourceMode: 'LOCAL_ONLY', stocks: [], orders: [], total: 0, offset: 0, limit: 20 });const { s } = await setup();expect(s.orderId).toBe('');expect(preview).not.toHaveBeenCalled();expect(query).toHaveBeenCalledWith('WO1:M1#000L') })
it('keeps the same request after a lost response and prevents double submission', async() => { const { s } = await setup();s.stockId = '1';s.outputQty = '100';await flushPromises();await s.calculate();s.selected = ['11'];submit.mockRejectedValueOnce(new Error('网络断开'));await s.submit();const first = { ...submit.mock.calls[0]![0] };await s.submit();expect(submit.mock.calls[1]![0]).toEqual(first) })
it.each(['factory', 'permission'])('clears state and rejects late responses on %s change', async(kind) => { const { s, auth } = await setup();let release!:(v:unknown) => void;query.mockImplementationOnce(() => new Promise(r => { release = r }));const task = s.query();if (kind === 'factory')auth.factoryId = 'B';else auth.factoryPermissions = ['business:material:query','business:unit:measure:query',];await flushPromises();release({ sourceMode: 'LOCAL_ONLY', stocks: [stock], orders: [order] });await task;expect(s.supply).toBeNull();expect(s.pending).toBeNull();expect(s.code).toBe('') })
it('selects the exact sole order while preserving the page contract', async() => { query.mockResolvedValueOnce({ sourceMode: 'LOCAL_ONLY', stocks: [stock], orders: [order], total: 1, offset: 0, limit: 20 });const { s } = await setup();expect(s.orderId).toBe('1');expect(preview).toHaveBeenCalledWith('WO1:M1#000L', '1');expect(wrapper.text()).toContain('1 / 1');expect(wrapper.text()).not.toContain('加载更多匹配工单') })

it('keeps UNKNOWN query enabled and retains the original request across reopening', async() => { const { s } = await setup();s.stockId = '1';s.outputQty = '100';await flushPromises();await s.calculate();s.selected = ['11'];submit.mockResolvedValueOnce({ requestId: 'r', issueId: '2', executionId: '3', status: 'SUBMIT_UNKNOWN' });await s.submit();const first = JSON.parse(JSON.stringify(submit.mock.calls[0]![0]));expect(wrapper.text()).toContain('打开本次领料单并核实');const retry = wrapper.findAll('button').find(b => b.text() === '使用原请求重查');expect(retry?.attributes('disabled')).toBeUndefined();wrapper.unmount();const { s: reopened } = await setup();await reopened.submit();expect(submit.mock.calls[1]![0]).toEqual(first) })

it('keeps a historical replay without a code explicitly ungenerated', async() => {
  const { s } = await setup();s.stockId = '1';s.outputQty = '100';await flushPromises();await s.calculate();s.selected = ['11']
  submit.mockResolvedValueOnce({ requestId: 'r', issueId: '2', executionId: '3', code: null, status: 'CONFIRMED', productionInputQty: '100', availableQty: '100' })
  await s.submit();expect(wrapper.text()).toContain('未生成（未记录批次）')
  expect(query).toHaveBeenCalledWith('WO1:M1#000L')
})

it('selects the sole eligible stock without choosing the first of multiple stocks', async() => {
  const { s } = await setup(); expect(s.stockId).toBe('1')
  query.mockResolvedValueOnce({ sourceMode: 'LOCAL_ONLY', stocks: [stock, { ...stock, reference: '2', warehouseId: '2' }], orders: [{ ...order, allowedWarehouses: ['1', '2'] }] })
  await s.query(); await flushPromises(); expect(s.stockId).toBe('')
})
it('allows a fully received execution to accept an approved additional input on the same path', async() => {
  preview.mockResolvedValueOnce({ definition, actual: { executionId: '3', executionStatus: 'FULLY_RECEIVED', selectedNodeIds: ['11'] }})
  const { s } = await setup();s.outputQty = '10';await flushPromises();await s.calculate()
  expect(wrapper.text()).toContain('计划余额内的合法追加将复用本执行')
  const confirm = wrapper.findAll('button').find(b => b.text() === '确认正式投产')!
  expect(confirm.attributes('disabled')).toBeUndefined(); await s.submit();expect(submit).toHaveBeenCalledTimes(1)
})
it('clears only a definite local rejection so the operator can recompute instead of replaying a stale calculation forever', async() => {
  const { s } = await setup();s.outputQty = '100';await flushPromises();await s.calculate();s.selected = ['11']
  const { ApiError } = await import('../src/lib/request')
  submit.mockRejectedValueOnce(new ApiError('PRODUCTION_INPUT_STALE', 'BOM依据已变化', '', 409))
  await s.submit();const first = submit.mock.calls[0]![0]
  expect(s.pending).toBeNull();expect(wrapper.text()).toContain('本次未形成正式投入，请重新计算')
  expect(sessionStorage.getItem('mes-production-input-pending:' + useAuth().username + ':A')).toBeNull()
  await flushPromises();await s.calculate();await s.submit();expect(submit.mock.calls[1]![0].requestId).not.toBe(first.requestId)
})
it('retains the original external or unconfirmed operation when a retry cannot be classified as a rolled-back local input', async() => {
  const { s } = await setup();s.outputQty = '100'
  calculate.mockResolvedValueOnce({ sourceMode: 'CONNECTED', order, stock, outputQty: '100', issueQty: '200', calculationKey: 'erp-frozen' })
  await flushPromises();await s.calculate();s.selected = ['11'];const { ApiError } = await import('../src/lib/request')
  submit.mockRejectedValueOnce(new ApiError('PRODUCTION_INPUT_STALE', '外部结果待核实', '', 409))
  await s.submit();const first = { ...submit.mock.calls[0]![0] };expect(s.pending).not.toBeNull()
  await s.submit();expect(submit.mock.calls[1]![0]).toEqual(first)
})

it('saves a formal material issue draft with one command and does not confirm production input', async() => {
  const { s } = await setup();s.outputQty = '100';await flushPromises();await s.calculate();s.selected = ['11']
  draft.mockResolvedValueOnce({ document: { id: '901', documentNo: 'MI-QA-1' }, lines: [] })
  await (s.submit as (kind:string) => Promise<void>)('draft')
  expect(draft).toHaveBeenCalledOnce();expect(submit).not.toHaveBeenCalled()
  expect(draft.mock.calls[0]![0]).toMatchObject({ code: 'WO1:M1#000L', outputQty: '100', inputKind: 'PRODUCTION_INPUT' })
  expect(wrapper.text()).toContain('库存和生产投入未改变');expect(s.pending).toBeNull()
})
it('a draft creator without approval authority can save but cannot run the convenience confirmation', async() => {
  const { s, auth } = await setup();auth.factoryPermissions = auth.factoryPermissions.filter(p => !p.endsWith(':post'));await flushPromises()
  s.code = 'WO1:M1#000L';await s.query();await flushPromises();s.outputQty = '100';await flushPromises();await s.calculate();s.selected = ['11']
  await s.submit();expect(submit).not.toHaveBeenCalled()
  draft.mockResolvedValueOnce({ document: { id: '902', documentNo: 'MI-QA-2' }, lines: [] })
  await (s.submit as (kind:string) => Promise<void>)('draft');expect(draft).toHaveBeenCalledOnce()
})
it('replays a lost draft response as the same draft request and cannot switch it into confirmation', async() => {
  const { s } = await setup();s.outputQty = '100';await flushPromises();await s.calculate();s.selected = ['11'];draft.mockRejectedValueOnce(new Error('response lost'))
  await (s.submit as (kind:string) => Promise<void>)('draft');const first = JSON.parse(JSON.stringify(draft.mock.calls[0]![0]))
  await (s.submit as (kind:string) => Promise<void>)('confirm');expect(submit).not.toHaveBeenCalled()
  draft.mockResolvedValueOnce({ document: { id: '903', documentNo: 'MI-QA-3' }, lines: [] })
  await s.submit();expect(draft.mock.calls[1]![0]).toEqual(first)
})
