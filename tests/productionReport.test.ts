import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus, { ElMessageBox } from 'element-plus'
import { createPinia } from 'pinia'
import { useAuth } from '../src/stores/auth'
import { ApiError } from '../src/lib/request'
import Manager from '../src/components/business/production/ProductionReportManager.vue'
const api = vi.hoisted(() => ({ quantities: vi.fn(), page: vi.fn(), detail: vi.fn(), history: vi.fn(), supplement: vi.fn(), adjust: vi.fn(), void: vi.fn(), users: vi.fn() }))
vi.mock('../src/api/production/productionReport', async original => ({ ...await original<typeof import('../src/api/production/productionReport')>(), productionReport: api }))
const id = '9007199254740993'
const node = { executionId: id, routingNodeId: '9007199254740994', operationId: '7', code: 'A', name: '首工序', sequenceNo: 1, inputQty: '99999999999999.123456', reportedQty: '4.000001', defectQty: '1.000000', effectiveOutputQty: '3.000001', availableQty: '99999999999995.123455', qualityIntegrated: true, directDefectQty:'1.000000', recoveredQty:'0.000000', netDefectQty:'1.000000', propagatedLossQty:'0.000000', historicalOverrunQty:'0.000000', rawEffectiveOutputQty:'3.000001', rawAvailableQty:'99999999999995.123455', unverifiedDefectQty:'0.000000', historicalConflict:false }
const ledger = { id, executionId: id, routingNodeId: node.routingNodeId, recordType: 'REPORT', quantityDelta: '4.000001', referenceReportId: null, operatorUserId: '100', recordedBy: '200', operatorName: '历史操作人员', recordedByName: '验收提交人员', reportTime: '2026-01-01T10:00:00', createTime: '2026-10-15T10:00:00', reason: '历史补录', workstationId: null }
const wrappers: ReturnType<typeof mount>[] = []
beforeEach(() => {
 sessionStorage.clear(); vi.resetAllMocks(); vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
 api.quantities.mockResolvedValue({ executionId: id, workorderId: '1', executionNo: 'EXE-TEST', routingId: '2', targetQty: node.inputQty, pathStatus: 'LOCKED', writable: true, boundary: null, nodes: [node] })
 api.page.mockResolvedValue({ items: [ledger], total: 1 }); api.users.mockResolvedValue({ items: [{ id: '100', name: '历史操作人员' }], total: 1 })
 api.detail.mockResolvedValue({ record: ledger, originalEffectiveQty: '3.000001' }); api.history.mockResolvedValue({ items: [{ ...ledger, id: '10', recordType: 'ADJUSTMENT', quantityDelta: '-1', reason: '核对订正' }], total: 1 })
 api.supplement.mockResolvedValue(ledger); api.adjust.mockResolvedValue(ledger); api.void.mockResolvedValue(ledger)
})
afterEach(() => { wrappers.forEach(w => w.unmount()); wrappers.length = 0; document.body.innerHTML = ''; vi.restoreAllMocks() })
async function click(text: string) { const button = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === text); expect(button).toBeTruthy(); button!.click(); await flushPromises() }
async function setup(actions = ['quantity', 'detail', 'supplement', 'adjust', 'void']) {
 const pinia = createPinia(), auth = useAuth(pinia); auth.factoryId = 'A'; auth.factoryPermissions = actions.map(action => 'business:production:report:' + action)
 const wrapper = mount(Manager, { props: { executionId: id }, attachTo: document.body, global: { plugins: [pinia, ElementPlus] } }); wrappers.push(wrapper)
 await flushPromises()
 return { wrapper, auth, state: wrapper.vm as unknown as { form: { quantity: string; operatorUserId: string; reportTime: string; reason: string; workstationId: string } } }
}
describe('production report management', () => {
 it('shows exact quantities and explicit quality boundary without mutable CRUD', async() => {
  await setup(); expect(document.body.textContent).toContain(node.inputQty); expect(document.body.textContent).toContain('历史加工完成数量保持不变；当前有效产出考虑直接不良、返工恢复及上游传播差额。返工加工量不增加正常报工。')
  expect(document.body.textContent).toContain('历史操作人员'); expect(document.body.textContent).toContain('验收提交人员'); expect(document.body.textContent).not.toContain('实际操作人ID'); expect(document.body.textContent).toContain('1.000000'); expect(document.body.textContent).not.toContain('未接入'); expect(document.body.textContent).not.toContain('质检合格')
  expect([...document.querySelectorAll('button')].some(b => b.textContent?.trim() === '删除')).toBe(false)
  expect(api.page).toHaveBeenCalledWith(id, node.routingNodeId, 0, 20)
 })
 it('supplements with exact IDs and decimal strings while server owns the submitter', async() => {
  const { state } = await setup(); await click('管理员历史补录')
  Object.assign(state.form, { quantity: '99999999999999.123456', operatorUserId: '100', reportTime: '2026-01-01T10:00:00', reason: '核对原始记录' })
  await click('追加数量流水')
  expect(api.supplement).toHaveBeenCalledWith({ requestId: expect.any(String), executionId: id, routingNodeId: node.routingNodeId, quantity: '99999999999999.123456', operatorUserId: '100', reportTime: '2026-01-01T10:00:00', workstationId: null, reason: '核对原始记录' })
  expect(api.quantities).toHaveBeenCalledTimes(2)
 })
 it('adjusts and voids only the original report with a required reason', async() => {
  const { state } = await setup(); await click('数量订正'); Object.assign(state.form, { quantity: '-1.000001', reason: '订正原因' }); await click('追加数量流水')
  expect(api.adjust).toHaveBeenCalledWith(id, '-1.000001', '订正原因', expect.any(String))
  await click('整笔冲销'); await click('确认整笔冲销'); expect(api.void).not.toHaveBeenCalled()
  state.form.reason = '整笔冲销原因'; await click('确认整笔冲销'); expect(api.void).toHaveBeenCalledWith(id, '整笔冲销原因', expect.any(String))
 })
 it('retries an unknown outcome with the exact frozen UUID and payload', async() => {
  api.adjust.mockRejectedValueOnce(new Error('response lost'))
  const { state } = await setup(); await click('数量订正'); Object.assign(state.form, { quantity: '-1', reason: '核对纠正' }); await click('追加数量流水')
  const first = api.adjust.mock.calls[0]
  await click('取消'); expect(document.body.textContent).toContain('原请求结果待确认')
  state.form.quantity = '-2'; await click('追加数量流水')
  expect(api.adjust.mock.calls[1]).toEqual(first)
 })
 it('shows original effective balance and adjustment history', async() => {
  await setup(); await click('调整历史'); expect(document.body.textContent).toContain('3.000001'); expect(document.body.textContent).toContain('核对订正')
  expect(api.history).toHaveBeenCalledWith(id, 0, 20)
 })
 it('keeps an unsubmitted command when closing is cancelled', async() => {
  const { state } = await setup(); await click('管理员历史补录'); state.form.reason = '尚未提交'
  vi.spyOn(ElMessageBox, 'confirm').mockRejectedValueOnce('cancel'); await click('取消')
  expect(state.form.reason).toBe('尚未提交'); expect(api.supplement).not.toHaveBeenCalled()
 })
 it('hides independent write permissions and rejects late results after switching factories', async() => {
  let release!: (value: unknown) => void
  api.quantities.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
  const { auth } = await setup(['quantity']); auth.factoryId = 'B'; auth.revision++; await flushPromises()
  release({ executionNo: '旧工厂执行', nodes: [node] }); await flushPromises()
  expect(document.body.textContent).not.toContain('旧工厂执行'); expect(document.body.textContent).not.toContain('管理员历史补录'); expect(api.page).not.toHaveBeenCalled()
 })
 it('allows read-only ledger access while hiding every administrator write action', async() => {
  await setup(['quantity', 'detail'])
  expect(document.body.textContent).toContain('历史补录')
  const labels = [...document.querySelectorAll('button')].map(b => b.textContent?.trim())
  for (const label of ['管理员历史补录','数量订正','整笔冲销']) expect(labels).not.toContain(label)
 })
 it('rejects the previous execution response after selecting another execution', async() => {
  let release!: (value: unknown) => void
  api.quantities.mockImplementationOnce(() => new Promise(resolve => { release = resolve })).mockResolvedValue({ executionId: '2', executionNo: 'NEW-EXE', targetQty: '8', nodes: [] })
  const { wrapper } = await setup(); await wrapper.setProps({ executionId: '2' }); await flushPromises()
  release({ executionId: id, executionNo: 'STALE-EXE', nodes: [node] }); await flushPromises()
  expect(document.body.textContent).toContain('NEW-EXE'); expect(document.body.textContent).not.toContain('STALE-EXE')
 })
 it('shows a read failure and allows retry without fabricating quantities', async() => {
  api.quantities.mockRejectedValueOnce(new Error('数量接口尚未就绪')); await setup()
  expect(document.body.textContent).toContain('数量接口尚未就绪'); expect(document.body.textContent).not.toContain('99999999999999.123456')
  await click('刷新数量'); expect(document.body.textContent).toContain(node.inputQty)
 })
})

it('keeps negative correction accessible while affected-node positive supplements are blocked',async()=>{api.quantities.mockResolvedValue({executionId:id,workorderId:'1',executionNo:'E',routingId:'2',targetQty:'10',pathStatus:'LOCKED',writable:true,boundary:'存在待核实不良',nodes:[{...node,positiveReportBlockReason:'工序 D 存在待核实不良，请先核实'}]});await setup();const buttons=[...document.querySelectorAll('button')];expect(buttons.find(b=>b.textContent?.trim()==='管理员历史补录')?.disabled).toBe(true);expect(buttons.find(b=>b.textContent?.trim()==='数量订正')?.disabled).toBe(false);expect(document.body.textContent).toContain('工序 D 存在待核实不良')})

it('does not discard a previously unknown intent when a retry is forbidden',async()=>{api.adjust.mockRejectedValueOnce(new Error('response lost')).mockRejectedValueOnce(new ApiError('FORBIDDEN','权限撤销','',403));const{state}=await setup();await click('数量订正');Object.assign(state.form,{quantity:'-1',reason:'核对'});await click('追加数量流水');const first=[...api.adjust.mock.calls[0]];await click('追加数量流水');expect(api.adjust.mock.calls[1]).toEqual(first);expect(document.body.textContent).toContain('结果待确认');expect(sessionStorage.length).toBeGreaterThan(0)})

it('explains closed normal reporting while preserving independently authorized historical correction',async()=>{
 api.quantities.mockResolvedValue({executionId:id,workorderId:'1',executionNo:'E',routingId:'2',targetQty:'10',pathStatus:'LOCKED',writable:false,boundary:'工单未下达或已作废，禁止继续正常报工',nodes:[node]})
 const {state}=await setup();expect(document.body.textContent).toContain('当前不可继续正常报工')
 await click('数量订正');Object.assign(state.form,{quantity:'-1',reason:'TEST ONLY历史订正'});await click('追加数量流水')
 expect(api.adjust).toHaveBeenCalledWith(id,'-1','TEST ONLY历史订正',expect.any(String))
})
