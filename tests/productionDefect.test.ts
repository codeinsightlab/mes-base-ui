import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus, { ElMessageBox } from 'element-plus'
import { createPinia } from 'pinia'
import { useAuth } from '../src/stores/auth'
import Page from '../src/views/quality/productionDefect/index.vue'
import { invalidateQuantityRules } from '../src/lib/production/quantityRuleInvalidation'
const quantityReads = vi.hoisted(() => ({ material: vi.fn(), unit: vi.fn() }))
vi.mock('../src/api/basic/material', () => ({ api: { detail: quantityReads.material }}))
vi.mock('../src/api/basic/unitMeasure', () => ({ api: { detail: quantityReads.unit }}))
const treatments = vi.hoisted(() => ({ details: vi.fn(), history: vi.fn() }))
vi.mock('../src/api/quality/qualityTreatment', async original => ({ ...await original<typeof import('../src/api/quality/qualityTreatment')>(), qualityTreatment: treatments }))
const api = vi.hoisted(() => ({ page: vi.fn(), history: vi.fn(), revise: vi.fn(), void: vi.fn() }))
vi.mock('../src/api/quality/productionDefect', async original => ({ ...await original<typeof import('../src/api/quality/productionDefect')>(), productionDefect: api }))
const row = { id: '1', declarationId: 'declaration-1', revisionNo: 2, recordAction: 'REVISE', revisionReason: '核对', executionId: '9007199254740999', affectedNodeId: '12', responsibleUserId: null, defectQty: '99999999999999.12', wasteCategory: 'PROCESS', defectReason: '裂纹', responsibilityRemark: null, occurredAt: '2026-01-01T10:00:00', recordedAt: '2026-01-01T10:00:00', reportedBy: '100', recordedBy: '100', reportedByName: '操作员', affectedNodeName: '车削', workorderCode: 'WO-001', productCode: 'P-001', productName: '轴套', batchNo: '000LOT-001', specification: 'Φ20×30', processingState: 'PENDING', pendingQuantity: '10', returnedQuantity: '0', transferredQuantity: '0', workorderStatus: 'RELEASED', executionStatus: 'RUNNING', source: 'LOCAL' }
let wrapper:ReturnType<typeof mount>
beforeEach(() => { sessionStorage.clear();vi.resetAllMocks();invalidateQuantityRules();quantityReads.material.mockResolvedValue({ unitId: '77' });quantityReads.unit.mockResolvedValue({ mustBeWholeNumber: 0, quantityPrecision: 6 });vi.stubGlobal('ResizeObserver', class {observe() {}unobserve() {}disconnect() {}});treatments.details.mockResolvedValue({ declarationId: row.declarationId, revision: 2, executionId: row.executionId, productId: '88', state: 'PENDING', attribution: 'INDEPENDENT', pendingDispositionQty: '10', recordAction: 'REVISE', returnedQty: '0', transferredQty: '0', defectQty: '10' });treatments.history.mockResolvedValue({ items: [], total: 0, offset: 0, limit: 20 });api.page.mockResolvedValue({ items: [row], total: 1 });api.history.mockResolvedValue({ items: [row], total: 1 });api.revise.mockResolvedValue({ record: row });api.void.mockResolvedValue({ record: row }) })
afterEach(() => { wrapper?.unmount();document.body.innerHTML = '';vi.restoreAllMocks();vi.unstubAllGlobals() })
async function setup(actions = ['read', 'create', 'revise', 'void']) { const pinia = createPinia(), auth = useAuth(pinia);auth.factoryId = 'A';auth.username = 'tester';auth.factoryPermissions = [...actions.map(a => 'business:quality:defect:' + a), 'business:material:query', 'business:unit:measure:query'];wrapper = mount(Page, { attachTo: document.body, global: { plugins: [pinia, ElementPlus] }});await flushPromises();return { s: (wrapper.vm.$ as unknown as { setupState: Record<string, any> }).setupState, auth } }
it('makes the workorder, product and processing state visible without technical IDs', async() => { await setup();const list = wrapper.find('.defect-list').text();expect(list).toContain('WO-001');expect(list).toContain('轴套');expect(list).toContain('000LOT-001');expect(list).toContain('Φ20×30');expect(list).toContain('待处理');expect(list).not.toContain('declaration-1');expect(wrapper.text()).not.toContain('历史兼容');expect(wrapper.text()).not.toContain('Execution');expect(wrapper.findComponent({ name: 'DefectStatisticsPanel' }).exists()).toBe(false) })
it('loads audit records only when a document is opened', async() => { const { s } = await setup();expect(api.history).not.toHaveBeenCalled();s.showHistory(row);await flushPromises();expect(api.history).toHaveBeenCalledWith('declaration-1', 0);expect(s.historyOpen).toBe(true) })
it('hides administration controls from ordinary declarers', async() => { const { s } = await setup(['read', 'create']);expect(wrapper.text()).toContain('登记不良');expect(wrapper.text()).not.toContain('更多');expect(s.actionable(row)).toBe(false) })
it('freezes identity and requires a reason when correcting a declaration', async() => { const { s } = await setup();s.begin('revise', row);await flushPromises();await s.submit();expect(api.revise).not.toHaveBeenCalled();s.reason = '核对责任';s.form.defectQty = '9.12';await flushPromises();await s.submit();expect(api.revise).toHaveBeenCalledWith(row.declarationId, expect.objectContaining({ expectedRevision: 2, revisionReason: '核对责任', facts: expect.objectContaining({ executionId: row.executionId, affectedNodeId: row.affectedNodeId, defectQty: '9.12' }) }));expect(api.revise.mock.calls[0]![1].facts).not.toHaveProperty('reportedBy') })
it('retains edits when discard is cancelled', async() => { const { s } = await setup();s.begin('revise', row);s.form.defectReason = '未保存';vi.spyOn(ElMessageBox, 'confirm').mockRejectedValueOnce('cancel');await s.closeDialog();expect(s.open).toBe(true);expect(s.form.defectReason).toBe('未保存') })
it('clears detail and rejects late audit responses on factory change', async() => { let release!:(v:unknown) => void;api.history.mockImplementationOnce(() => new Promise(r => release = r));const { s, auth } = await setup();s.showHistory(row);auth.factoryId = 'B';await flushPromises();release({ items: [{ ...row, revisionReason: '旧厂资料' }], total: 1 });await flushPromises();expect(s.historyOpen).toBe(false);expect(s.history).toEqual([]);expect(wrapper.text()).not.toContain('旧厂资料') })
it('replays the identical correction after an uncertain response', async() => { api.revise.mockRejectedValueOnce(new Error('响应丢失'));const { s } = await setup();s.begin('revise', row);s.reason = '核对';s.form.defectQty = '8';await flushPromises();await s.submit();const first = JSON.parse(JSON.stringify(api.revise.mock.calls[0]![1]));s.form.defectQty = '7';await s.submit();expect(api.revise.mock.calls[1]![1]).toEqual(first) })
it('hides processing and correction for completed, cancelled or voided records', async() => { const { s } = await setup();for (const patch of [{ executionStatus: 'FULLY_RECEIVED' }, { workorderStatus: 'CANCELLED' }, { recordAction: 'VOID' }, { processingState: 'TRANSFERRED', transferredQuantity: '10', pendingQuantity: '0' }])expect(s.actionable({ ...row, ...patch })).toBe(false) })
it('blocks closing while the processing request remains unknown', async() => { const { s } = await setup();s.showHistory(row);s.treatmentPending = true;await s.closeHistory();expect(s.historyOpen).toBe(true) })

it('shows successful version facts when the independent quality summary fails', async() => {
  treatments.details.mockRejectedValueOnce(new Error('数量摘要失败'))
  api.history.mockResolvedValueOnce({ items: [{ ...row, revisionReason: '成功取得的版本事实' }], total: 31 })
  const { s } = await setup();s.showHistory(row);await flushPromises()
  expect(document.body.textContent).toContain('数量摘要失败')
  expect(document.body.textContent).toContain('成功取得的版本事实');expect(s.historyTotal).toBe(31)
  expect(document.body.textContent).toContain('不良信息')
})

it('shows independent summary and raw facts when the version page fails and retries it', async() => {
  api.history.mockRejectedValueOnce(new Error('版本数据库故障'))
  const { s } = await setup();s.showHistory(row);await flushPromises()
  expect(document.body.textContent).toContain('版本数据库故障');expect(document.body.textContent).toContain('不良信息')
  expect(document.body.textContent).toContain('申报数量')
  await s.loadHistory();expect(s.historyError).toBe('');expect(s.history).toEqual([row])
})

it.each(['1.234567', '1.234500'])('preserves unchanged historical quantity %s when only metadata changes', async quantity => {
  quantityReads.unit.mockResolvedValue({ mustBeWholeNumber: 1, quantityPrecision: 0 })
  const historical = { ...row, defectQty: quantity }
  api.page.mockResolvedValueOnce({ items: [historical], total: 1 })
  const { s } = await setup()
  expect(wrapper.find('[aria-label="更多申报操作"]').exists()).toBe(true)
  s.begin('revise', historical)
  await flushPromises()
  s.reason = '核对原因';s.form.defectReason = '补充裂纹位置'
  s.form.defectQty = quantity === '1.234500' ? '1.2345' : quantity
  await flushPromises();await s.submit()
  expect(api.revise).toHaveBeenCalledWith(row.declarationId, expect.objectContaining({ facts: expect.objectContaining({ defectQty: quantity, defectReason: '补充裂纹位置' }) }))
})

it.each([
  { whole: 1, precision: 0, invalid: '1.5', valid: '2.000', expected: '2' },
  { whole: 0, precision: 2, invalid: '1.234', valid: '1.2300', expected: '1.23' },
  { whole: 0, precision: 6, invalid: '1.2345678', valid: '1.234567', expected: '1.234567' }
])('checks changed defect quantities with the current rule $whole/$precision', async({ whole, precision, invalid, valid, expected }) => {
  quantityReads.unit.mockResolvedValue({ mustBeWholeNumber: whole, quantityPrecision: precision })
  const { s } = await setup();s.begin('revise', row);await flushPromises()
  s.reason = '数量核对';s.form.defectQty = invalid
  await flushPromises();await s.submit()
  expect(api.revise).not.toHaveBeenCalled();expect(s.pendingEdit).toBeNull()
  s.form.defectQty = valid;await flushPromises();await s.submit()
  expect(api.revise).toHaveBeenCalledWith(row.declarationId, expect.objectContaining({ facts: expect.objectContaining({ defectQty: expected }) }))
})

it.each(['product', 'unit'])('keeps raw facts and unchanged metadata writable when %s rule reading fails', async area => {
  if (area === 'product')treatments.details.mockRejectedValueOnce(new Error('物料依据读取失败'))
  else quantityReads.unit.mockRejectedValueOnce(new Error('单位规则读取失败'))
  const { s } = await setup();const historical = { ...row, defectQty: '1.234567' }
  s.begin('revise', historical);await flushPromises()
  expect(document.body.textContent).toContain(area === 'product' ? '物料依据读取失败' : '单位规则读取失败')
  expect(s.form.defectQty).toBe('1.234567')
  s.reason = '核对备注';s.form.defectQty = '2';await flushPromises();await s.submit()
  expect(api.revise).not.toHaveBeenCalled()
  s.form.defectQty = '1.234567';s.form.responsibilityRemark = '补充责任说明'
  await flushPromises();await s.submit()
  expect(api.revise.mock.calls[0]![1].facts).toMatchObject({ defectQty: '1.234567', responsibilityRemark: '补充责任说明' })
})

it.each(['declaration', 'execution', 'revision', 'product'])('rejects mismatched trusted %s identity before accepting changed quantities', async field => {
  const details = { declarationId: row.declarationId, executionId: row.executionId, revision: 2, productId: '88' }
  const mismatched = { ...details, ...({ declaration: { declarationId: 'other' }, execution: { executionId: 'other' }, revision: { revision: 3 }, product: { productId: null }}[field]) }
  treatments.details.mockResolvedValueOnce(mismatched)
  const { s } = await setup();s.begin('revise', row);await flushPromises()
  s.reason = '数量核对';s.form.defectQty = '2';await flushPromises();await s.submit()
  expect(s.editProductId).toBeNull();expect(api.revise).not.toHaveBeenCalled()
  expect(s.editQuantityError).toContain('依据不一致')
})

it.each(['factory', 'revoke', 'close', 'execution'])('discards a late correction material lookup after %s changes', async mode => {
  let release!:(value:unknown) => void
  treatments.details.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
  const { s, auth } = await setup();s.begin('revise', row);await flushPromises()
  if (mode === 'factory')auth.factoryId = 'B'
  else if (mode === 'revoke')auth.factoryPermissions = []
  else if (mode === 'close') await s.closeDialog()
  else {
    const next = { ...row, declarationId: 'next', executionId: 'next-execution', revisionNo: 1 }
    treatments.details.mockResolvedValueOnce({ declarationId: 'next', executionId: 'next-execution', revision: 1, productId: '99' })
    s.begin('revise', next);await flushPromises()
    expect(s.editProductId).toBe('99')
  }
  release({ declarationId: row.declarationId, executionId: row.executionId, revision: 2, productId: '88' })
  await flushPromises()
  expect(s.editProductId).toBe(mode === 'execution' ? '99' : null)
  expect(quantityReads.material.mock.calls.some(call => call[0] === '88')).toBe(false)
})

it('replays the frozen correction unchanged after quantity rules tighten', async() => {
  const { s } = await setup();s.begin('revise', row);await flushPromises()
  s.reason = '数量核对';s.form.defectQty = '1.234500'
  api.revise.mockRejectedValueOnce(new Error('响应丢失'))
  await flushPromises();await s.submit()
  const frozen = JSON.parse(JSON.stringify(api.revise.mock.calls[0]![1]))
  quantityReads.unit.mockResolvedValue({ mustBeWholeNumber: 1, quantityPrecision: 0 })
  invalidateQuantityRules();s.form.defectQty = '9.9';await flushPromises();await s.submit()
  expect(api.revise.mock.calls[1]![1]).toEqual(frozen)
  expect(frozen.facts.defectQty).toBe('1.2345')
})

it('does not add material rule reads to VOID commands', async() => {
  const { s } = await setup();s.begin('void', row);s.reason = '核对作废'
  await s.submit()
  expect(api.void).toHaveBeenCalled();expect(treatments.details).not.toHaveBeenCalled()
  expect(quantityReads.material).not.toHaveBeenCalled()
})
