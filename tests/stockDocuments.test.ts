import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import { useAuth } from '../src/stores/auth'
import { ApiError } from '../src/lib/request'
import Actions from '../src/components/business/warehouse/StockDocumentActions.vue'
import { stockDocuments, stockDocumentApis } from '../src/api/wm/stockDocuments'
const mocks = vi.hoisted(() => ({ request: vi.fn(), confirm: vi.fn() }))
vi.mock('../src/lib/request', async original => ({ ...await original<object>(), request: mocks.request }))
vi.mock('element-plus', async original => ({ ...await original<object>(), ElMessageBox: { confirm: mocks.confirm }}))
let wrapper:ReturnType<typeof mount> | undefined
beforeEach(() => { sessionStorage.clear();vi.clearAllMocks();mocks.confirm.mockResolvedValue('confirm');vi.stubGlobal('ResizeObserver', class {observe() {}unobserve() {}disconnect() {}}) })
afterEach(() => { wrapper?.unmount();wrapper = undefined;vi.unstubAllGlobals() })
function setup(post = true) {
  const pinia = createPinia(), auth = useAuth(pinia);auth.factoryId = 'PROD';auth.runtimeMode = 'LOCAL';auth.username = 'admin';auth.factoryPermissions = ['business:wm:stock:document:query', ...(post ? ['business:wm:stock:document:post'] : [])]
  const refresh = vi.fn().mockResolvedValue(undefined)
  wrapper = mount(Actions, { props: { row: { id: '9007199254740999', revision: '8', status: 'DRAFT', documentType: 'OTHER_RECEIPT' }, dirty: false, refresh }, global: { plugins: [pinia, ElementPlus], stubs: { RouterLink: true }}})
  return { auth, refresh, s: (wrapper.vm.$ as unknown as { setupState: Record<string, any> }).setupState }
}
it('freezes original post UUID/revision across UNKNOWN and later 403; scope changes reject late completion', async() => {
  const { s, auth, refresh } = setup();mocks.request.mockRejectedValueOnce(new Error('lost')).mockRejectedValueOnce(new ApiError('FORBIDDEN', '撤权', '', 403))
  await s.approve();await s.approve();const first = mocks.request.mock.calls[0]![1].body;expect(mocks.request.mock.calls[1]![1].body).toEqual(first);expect(first.expectedRevision).toBe('8');expect(Object.keys(first).sort()).toEqual(['expectedRevision', 'requestId']);expect(sessionStorage.length).toBe(1)
  let release!:(v:unknown) => void;mocks.request.mockImplementationOnce(() => new Promise(r => release = r));const waiting = s.approve();await flushPromises();auth.factoryId = 'B';await flushPromises();release({});await waiting;expect(refresh).not.toHaveBeenCalled();expect(s.intent.pending.value).toBeNull()
})
it('query permission cannot post; unsaved header blocks new commands', async() => {
  const { s, auth } = setup(false);await s.approve();expect(mocks.request).not.toHaveBeenCalled();auth.factoryPermissions.push('business:wm:stock:document:post');await wrapper!.setProps({ dirty: true });await s.approve();expect(mocks.request).not.toHaveBeenCalled();expect(s.error).toContain('保存主单')
})
it('saves one aggregate command with exact quantities and server-owned parent identity', async() => {
  const { aggregateApi } = stockDocumentApis()
  mocks.request.mockResolvedValueOnce({ document: { id: '9007199254740999' }, lines: [] })
  await aggregateApi.update('9007199254740999', { revision: '2', documentType: 'OTHER_RECEIPT', reason: 'TEST', items: [{ id: '4', documentId: 'other', stockId: '99', materialId: '2', warehouseId: '3', unitId: '5', batchNo: 'LOT', binCode: 'BIN', quantity: '0.000001', operatorUserId: 'hacker', status: 'POSTED', stockActionId: 'fake' }] })
  const [url, options] = mocks.request.mock.calls[0]!
  expect(url).toBe('/api/wm/stock-documents/9007199254740999/aggregate')
  expect(options.body.header.expectedRevision).toBe('2')
  expect(options.body.items[0]).toMatchObject({ id: '4', quantity: '0.000001' })
  for (const key of ['documentId', 'operatorUserId', 'status', 'stockActionId']) expect(options.body.items[0]).not.toHaveProperty(key)
  expect(mocks.request).toHaveBeenCalledOnce()
})
it('approval endpoint preserves the exact caller intent for replay', async() => { mocks.request.mockResolvedValue({});const body = { requestId: 'c7b6c1e2-2e51-41d6-86b6-620efc433027', expectedRevision: '7' };await stockDocuments.approve('8', body);expect(mocks.request).toHaveBeenCalledWith('/api/wm/stock-documents/8/actions/approve', { method: 'POST', body, scope: 'factory' }) })

it('creates a document and its lines with the selected rule in one request', async() => {
  const { aggregateApi } = stockDocumentApis();mocks.request.mockResolvedValueOnce({ document: { id: '1' }, lines: [] })
  await aggregateApi.create({ ruleCode: 'IN_RULE', documentType: 'PRODUCTION_RECEIPT', sourceExecutionId: '9007199254740999', reason: 'TEST', remark: null, items: [{ materialId: '2', quantity: '1' }] })
  expect(mocks.request.mock.calls[0]![0]).toBe('/api/wm/stock-documents/aggregate')
  expect(mocks.request.mock.calls[0]![1].body).toMatchObject({ header: { ruleCode: 'IN_RULE', sourceExecutionId: '9007199254740999' }, items: [{ materialId: '2', quantity: '1' }] })
})
it('requires a selected rule before creating a stock document', async() => { const { aggregateApi } = stockDocumentApis();await expect(aggregateApi.create({ documentType: 'OTHER_RECEIPT', items: [] })).rejects.toThrow('请选择出入库单编码规则');expect(mocks.request).not.toHaveBeenCalled() })
it('queries stock numbering rules with the fixed document category', async() => { mocks.request.mockResolvedValueOnce([]);await stockDocuments.numberingRules('STOCK_OUT');expect(mocks.request).toHaveBeenCalledExactlyOnceWith('/api/wm/stock-documents/numbering-rules', { query: { type: 'STOCK_OUT' }, scope: 'factory' }) })
it('reads production allowance through the inbound document API without creating handover', async() => { mocks.request.mockResolvedValue({ remaining: '40' });await stockDocuments.productionBasis('9007199254740999');expect(mocks.request).toHaveBeenCalledWith('/api/wm/stock-documents/executions/9007199254740999/basis', { scope: 'factory' }) })

it('keeps unsupported source categories as drafts without attempting approval', async() => {
  const { s } = setup();await wrapper!.setProps({ row: { id: '1', revision: '0', documentType: 'PURCHASE_RECEIPT', status: 'DRAFT' }})
  await s.approve();expect(mocks.request).not.toHaveBeenCalled();expect(s.error).toContain('禁止审核')
})

it('production receipt convenience preserves the caller UUID and decimal strings in one server command', async() => {
  mocks.request.mockResolvedValue({ document: { id: '1' }, lines: [] });const command = { requestId: '11111111-2222-4333-8444-555555555555', stockId: '9007199254740999', quantity: '1.000001', reason: '实物核对' }
  await stockDocuments.receiveProduction('9007199254740998', command)
  expect(mocks.request).toHaveBeenCalledExactlyOnceWith('/api/production/executions/9007199254740998/inbound', { method: 'POST', body: command, scope: 'factory' })
})
it('material issue approval requires production authorization for the saved draft', async() => {
  const { s, auth } = setup();await wrapper!.setProps({ row: { id: '1', revision: '0', status: 'DRAFT', documentType: 'MATERIAL_ISSUE', postRequestId: '11111111-2222-4333-8444-555555555555' }})
  await s.approve();expect(mocks.request.mock.calls.filter(call => String(call[0]).endsWith('/actions/approve'))).toHaveLength(0)
  auth.factoryPermissions.push('business:mes:material:issue:update');await flushPromises()
  mocks.request.mockResolvedValue({ document: { id: '1' }, lines: [] });await s.approve()
  const approvals = mocks.request.mock.calls.filter(call => String(call[0]).endsWith('/actions/approve'));expect(approvals).toHaveLength(1)
  expect(mocks.confirm.mock.calls.at(-1)![0]).toContain('减少所选库存')
  expect(approvals[0]![1].body.requestId).toBe('11111111-2222-4333-8444-555555555555')
})
it('keeps the safe material issue basis visible to the draft approver without exposing frozen request JSON', async() => {
  const basis = { requestId: '11111111-2222-4333-8444-555555555555', code: 'WO:M#0001 ', workorderId: '9007199254740999', outputQty: '10.000001', routingId: '7', routingNodeIds: ['11', '12'] }
  const { aggregateApi } = stockDocumentApis();mocks.request.mockResolvedValue({ document: { id: '1', documentType: 'MATERIAL_ISSUE' }, lines: [], materialIssueBasis: basis })
  const { header } = await aggregateApi.detail('1');expect(header.materialIssueBasis).toEqual(basis);expect(header).not.toHaveProperty('sourceRequestJson')
  const { s } = setup();await wrapper!.setProps({ row: { ...header, status: 'DRAFT', revision: '0' }});await flushPromises()
  expect(wrapper!.text()).toContain('10');expect(wrapper!.text()).toContain('11 → 12');expect(wrapper!.text()).toContain('WO:M#0001')
  expect(s.materialIssueBasis.code).toBe('WO:M#0001 ')
})

it('shows an unreadable material issue basis as a local error while preserving the raw document and lines', async() => {
  const raw = { document: { id: '1', documentNo: 'QA-RAW', documentType: 'MATERIAL_ISSUE', reason: '原始依据', status: 'DRAFT', revision: '0', postRequestId: '11111111-2222-4333-8444-555555555555' }, lines: [{ id: '8', documentId: '1', materialId: '2', batchNo: '0001 ', quantity: '2.500001' }], materialIssueBasis: null, materialIssueBasisError: '冻结领料依据无法解析，请核对原记录；禁止审核' }
  const { aggregateApi } = stockDocumentApis();mocks.request.mockResolvedValue(raw)
  const { header, items } = await aggregateApi.detail('1')
  expect(header.documentNo).toBe('QA-RAW');expect(header.reason).toBe('原始依据');expect(items).toEqual(raw.lines)
  const { s, auth } = setup();auth.factoryPermissions.push('business:mes:material:issue:update', 'business:wm:stock:document:create', 'business:wm:stock:document:update')
  await wrapper!.setProps({ row: header });await flushPromises();expect(wrapper!.text()).toContain('冻结领料依据无法解析');expect(wrapper!.text()).toContain('QA-RAW')
  expect(s.materialIssueBasis).toBeNull();expect(s.canApprove).toBe(false)
  mocks.request.mockClear();await s.approve();expect(mocks.request).not.toHaveBeenCalled()
})

it('approves an existing material issue draft with issue authority without stock permissions', async() => {
  const { s, auth } = setup(false);auth.factoryPermissions.push('business:mes:material:issue:update')
  await wrapper!.setProps({ row: { id: '17', revision: '4', status: 'DRAFT', documentType: 'MATERIAL_ISSUE', postRequestId: '11111111-2222-4333-8444-555555555555' }})
  expect(auth.hasPermission('business:wm:stock:document:create', 'factory')).toBe(false)
  expect(auth.hasPermission('business:wm:stock:document:update', 'factory')).toBe(false)
  expect(auth.hasPermission('business:wm:stock:document:post', 'factory')).toBe(false)
  expect(s.canApprove).toBe(true);mocks.request.mockResolvedValue({ document: { id: '17' }, lines: [] });await s.approve()
  const approvals = mocks.request.mock.calls.filter(call => String(call[0]).endsWith('/actions/approve'));expect(approvals).toEqual([['/api/wm/stock-documents/17/actions/approve', { method: 'POST', scope: 'factory', body: { requestId: '11111111-2222-4333-8444-555555555555', expectedRevision: '4' }}]])
})
it('does not approve or cancel a material issue in a non-local factory mode', async() => {
  const { s, auth } = setup(false);auth.factoryPermissions.push('business:mes:material:issue:update')
  await wrapper!.setProps({ row: { id: '17', revision: '4', status: 'DRAFT', documentType: 'MATERIAL_ISSUE', postRequestId: '11111111-2222-4333-8444-555555555555' }})
  auth.runtimeMode = 'ERP';await flushPromises();mocks.request.mockClear()
  await s.approve();await s.cancel()
  expect(s.canApprove).toBe(false);expect(s.canCancel).toBe(false);expect(mocks.request).not.toHaveBeenCalled()
})
it('uses the unified document identity for issue void and recovery', async() => {
  mocks.request.mockResolvedValue({});await stockDocuments.voidMaterialIssue('9007199254740999');await stockDocuments.voidMaterialIssue('9007199254740999', true)
  expect(mocks.request.mock.calls.map(call => call[0])).toEqual(['/api/wm/stock-documents/9007199254740999/actions/void', '/api/wm/stock-documents/9007199254740999/actions/reconcile-void'])
})

it('limits legacy issue access to material issue documents and retains distinct line identity', async() => {
  const { headerApi, aggregateApi } = stockDocumentApis({ issueListOnly: () => true, issueQueryOnly: () => true })
  mocks.request.mockResolvedValueOnce({ items: [], total: 0, offset: 0, limit: 20 })
  await headerApi.list({ documentType: 'OTHER_RECEIPT', offset: 0, limit: 20 })
  expect(mocks.request.mock.calls[0]![1].query.documentType).toBe('MATERIAL_ISSUE')
  mocks.request.mockResolvedValueOnce({ document: { id: '44', documentType: 'MATERIAL_ISSUE' }, lines: [] })
  await aggregateApi.detail('44')
  expect(mocks.request.mock.calls[1]).toEqual(['/api/wm/stock-documents/44', { query: { documentType: 'MATERIAL_ISSUE' }, scope: 'factory' }])
  mocks.request.mockResolvedValueOnce({ id: '99', documentId: '44' })
  await stockDocuments.materialIssueLine('44', '99')
  expect(mocks.request.mock.calls[2]).toEqual(['/api/wm/stock-documents/44/lines/99', { query: { documentType: 'MATERIAL_ISSUE' }, scope: 'factory' }])
})
