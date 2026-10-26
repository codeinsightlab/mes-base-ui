import { invalidateQuantityRules } from '../src/lib/production/quantityRuleInvalidation'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus, { ElMessageBox } from 'element-plus'
import { createPinia } from 'pinia'
import { useAuth } from '../src/stores/auth'
import { ApiError } from '../src/lib/request'
import Manager from '../src/components/business/production/ProductionReportManager.vue'
const rules = vi.hoisted(() => ({ material: vi.fn(), unit: vi.fn() }))
vi.mock('../src/api/basic/material', () => ({ api: { detail: rules.material } }))
vi.mock('../src/api/basic/unitMeasure', () => ({ api: { detail: rules.unit } }))
const api = vi.hoisted(() => ({ quantities: vi.fn(), page: vi.fn(), detail: vi.fn(), history: vi.fn(), supplement: vi.fn(), adjust: vi.fn(), void: vi.fn(), users: vi.fn() }))
vi.mock('../src/api/production/productionReport', async original => ({ ...await original<typeof import('../src/api/production/productionReport')>(), productionReport: api }))
const paths = vi.hoisted(() => ({ path: vi.fn() }))
vi.mock('../src/api/production/executionActions', () => ({ executionActions: paths }))
const id = '9007199254740993'
const node = { executionId: id, routingNodeId: '9007199254740994', operationId: '7', code: 'A', name: '首工序', sequenceNo: 1, inputQty: '99999999999999.123456', reportedQty: '4.000001', defectQty: '1.000000', effectiveOutputQty: '3.000001', availableQty: '99999999999995.123455', qualityIntegrated: true, directDefectQty: '1.000000', returnedQty: '0.000000', netDefectQty: '1.000000', propagatedLossQty: '0.000000', historicalOverrunQty: '0.000000', rawEffectiveOutputQty: '3.000001', rawAvailableQty: '99999999999995.123455', unverifiedDefectQty: '0.000000', historicalConflict: false }
const ledger = { id, executionId: id, routingNodeId: node.routingNodeId, recordType: 'REPORT', quantityDelta: '4.000001', referenceReportId: null, operatorUserId: '100', recordedBy: '200', operatorName: '历史操作人员', recordedByName: '验收提交人员', reportTime: '2026-01-01T10:00:00', createTime: '2026-10-15T10:00:00', reason: '历史补录', workstationId: null }
const wrappers: ReturnType<typeof mount>[] = []
beforeEach(() => {
  sessionStorage.clear(); vi.resetAllMocks();invalidateQuantityRules();rules.material.mockResolvedValue({unitId:'u'});rules.unit.mockResolvedValue({mustBeWholeNumber:0,quantityPrecision:6}); vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  api.quantities.mockResolvedValue({ productId:'2', executionId: id, workorderId: '1', routingId: '2', targetQty: node.inputQty, pathStatus: 'LOCKED', writable: true, boundary: null, nodes: [node] })
  api.page.mockResolvedValue({ items: [ledger], total: 1 }); api.users.mockResolvedValue({ items: [{ id: '100', name: '历史操作人员' }], total: 1 })
  api.detail.mockResolvedValue({ record: ledger, originalEffectiveQty: '3.000001' }); api.history.mockResolvedValue({ items: [{ ...ledger, id: '10', recordType: 'ADJUSTMENT', quantityDelta: '-1', reason: '核对订正' }], total: 1 })
  api.supplement.mockResolvedValue(ledger); api.adjust.mockResolvedValue(ledger); api.void.mockResolvedValue(ledger)
})
afterEach(() => { wrappers.forEach(w => w.unmount()); wrappers.length = 0; document.body.innerHTML = ''; vi.restoreAllMocks() })
async function click(text: string) { await flushPromises(); const button = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === text); expect(button).toBeTruthy(); button!.click(); await flushPromises() }
async function setup(actions = ['quantity', 'detail', 'supplement', 'adjust', 'void'], executionQuery = false) {
  const pinia = createPinia(), auth = useAuth(pinia); auth.factoryId = 'A'; auth.factoryPermissions = ['business:material:query','business:unit:measure:query',...actions.map(action => 'business:production:report:' + action)]
  if (executionQuery) auth.factoryPermissions.push('business:mes:production:execution:query')
  const wrapper = mount(Manager, { props: { executionId: id }, attachTo: document.body, global: { plugins: [pinia, ElementPlus] }}); wrappers.push(wrapper)
  await flushPromises()
  return { wrapper, auth, state: wrapper.vm as unknown as { form: { quantity: string; operatorUserId: string; reportTime: string; reason: string; workstationId: string }}}
}
describe('production report management', () => {
  it('keeps the real paged ledger readable when quality quantities cannot be calculated', async() => {
    api.quantities.mockRejectedValue(new ApiError('QUALITY_DATA_INVALID', '处置记录待确认', '', 409))
    paths.path.mockResolvedValue({ selectedNodeIds: [node.routingNodeId, '11'], nodes: [
      { id: node.routingNodeId, nodeCode: 'A', operationName: '首工序' },
      { id: '11', nodeCode: 'B', operationName: '末工序' }
    ] })
    const { wrapper } = await setup(undefined, true)
    expect(api.page).toHaveBeenCalledWith(id, node.routingNodeId, 0, 20)
    expect(document.body.textContent).toContain('派生数量待确认')
    expect(document.body.textContent).toContain('历史操作人员')
    expect(document.body.textContent).not.toContain('暂无已确定的执行路径')
    expect([...document.querySelectorAll('button')].find(b => b.textContent?.trim() === '数量订正')?.disabled).toBe(true)
    const state = (wrapper.vm.$ as unknown as { setupState: { chooseNode: (row: { routingNodeId: string }) => Promise<void> }}).setupState
    await state.chooseNode({ routingNodeId: '11' }); await flushPromises()
    expect(api.page).toHaveBeenLastCalledWith(id, '11', 0, 20)
  })
  it('loads the raw ledger without waiting for a stalled quantity request', async() => {
    api.quantities.mockImplementation(() => new Promise(() => {}))
    paths.path.mockResolvedValue({ selectedNodeIds: [node.routingNodeId], nodes: [{ id: node.routingNodeId, nodeCode: 'A', operationName: '首工序' }] })
    await setup(['quantity', 'detail'], true)
    expect(api.page).toHaveBeenCalledWith(id, node.routingNodeId, 0, 20)
    expect(document.body.textContent).toContain('历史操作人员')
  })
  it('rejects late raw-node reads after a factory switch', async() => {
    let resolvePath!: (value: unknown) => void
    api.quantities.mockRejectedValue(new Error('数量暂不可读'))
    paths.path.mockImplementationOnce(() => new Promise(resolve => { resolvePath = resolve }))
    const { auth } = await setup(['quantity', 'detail'], true)
    auth.factoryId = 'B'; auth.revision++; await flushPromises()
    resolvePath({ selectedNodeIds: ['old'], nodes: [{ id: 'old', nodeCode: '旧厂工序', operationName: '旧厂记录' }] })
    await flushPromises()
    expect(api.page).not.toHaveBeenCalled()
    expect(document.body.textContent).not.toContain('旧厂记录')
  })
  it('does not request the path without its independent permission', async() => {
    api.quantities.mockRejectedValue(new Error('数量读取失败'))
    await setup(['quantity', 'detail'])
    expect(paths.path).not.toHaveBeenCalled()
    expect(api.page).not.toHaveBeenCalled()
  })
  it('does not query execution paths without permission or mask path and ledger failures', async() => {
    api.quantities.mockRejectedValue(new Error('数量读取失败'))
    paths.path.mockRejectedValue(new Error('节点读取失败'))
    await setup(['quantity', 'detail'], true)
    expect(document.body.textContent).toContain('节点读取失败')
    expect(api.page).not.toHaveBeenCalled()
    paths.path.mockResolvedValue({ selectedNodeIds: [node.routingNodeId], nodes: [{ id: node.routingNodeId, nodeCode: 'A', operationName: '首工序' }] })
    api.page.mockRejectedValue(new Error('账本读取失败'))
    await click('刷新数量')
    expect(document.body.textContent).toContain('账本读取失败')
    expect(document.body.textContent).toContain('派生数量待确认')
  })

  it('shows exact quantities and explicit quality boundary without mutable CRUD', async() => {
    await setup(); expect(document.body.textContent).toContain('99999999999999.12'); expect(document.body.textContent).toContain('当前净产出按正式报工与有效不良计算。不良入仓不会增加产出，入库审核后核对完结条件。')
    expect(document.body.textContent).toContain('历史操作人员'); expect(document.body.textContent).toContain('验收提交人员'); expect(document.body.textContent).not.toContain('实际操作人ID'); expect(document.body.textContent).toContain('1'); expect(document.body.textContent).not.toContain('未接入'); expect(document.body.textContent).not.toContain('质检合格')
    expect([...document.querySelectorAll('button')].some(b => b.textContent?.trim() === '删除')).toBe(false)
    expect(api.page).toHaveBeenCalledWith(id, node.routingNodeId, 0, 20)
  })
  it('supplements with exact IDs and decimal strings while server owns the submitter', async() => {
    const { state } = await setup(); await click('管理员历史补录')
    Object.assign(state.form, { quantity: '99999999999999.12', operatorUserId: '100', reportTime: '2026-01-01T10:00:00', reason: '核对原始记录' })
    await click('追加数量流水')
    expect(api.supplement).toHaveBeenCalledWith({ requestId: expect.any(String), executionId: id, routingNodeId: node.routingNodeId, quantity: '99999999999999.12', operatorUserId: '100', reportTime: '2026-01-01T10:00:00', workstationId: null, reason: '核对原始记录' })
    expect(api.quantities).toHaveBeenCalledTimes(2)
  })
  it('adjusts and voids only the original report with a required reason', async() => {
    const { state } = await setup(); await click('数量订正'); Object.assign(state.form, { quantity: '-1.01', reason: '订正原因' }); await click('追加数量流水')
    expect(api.adjust).toHaveBeenCalledWith(id, '-1.01', '订正原因', expect.any(String))
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
    await setup(); await click('调整历史'); expect(document.body.textContent).toContain('3'); expect(document.body.textContent).toContain('核对订正')
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
    release({ executionId: 'stale', nodes: [{ ...node, name: '旧工厂执行' }] }); await flushPromises()
    expect(document.body.textContent).not.toContain('旧工厂执行'); expect(document.body.textContent).not.toContain('管理员历史补录'); expect(api.page).not.toHaveBeenCalled()
  })
  it('allows read-only ledger access while hiding every administrator write action', async() => {
    await setup(['quantity', 'detail'])
    expect(document.body.textContent).toContain('历史补录')
    const labels = [...document.querySelectorAll('button')].map(b => b.textContent?.trim())
    for (const label of ['管理员历史补录', '数量订正', '整笔冲销']) expect(labels).not.toContain(label)
  })
  it('rejects the previous execution response after selecting another execution', async() => {
    let release!: (value: unknown) => void
    api.quantities.mockImplementationOnce(() => new Promise(resolve => { release = resolve })).mockResolvedValue({ executionId: '2', targetQty: '8', nodes: [] })
    const { wrapper } = await setup(); await wrapper.setProps({ executionId: '2' }); await flushPromises()
    release({ executionId: id, nodes: [node] }); await flushPromises()
    expect((wrapper.vm.$ as unknown as { setupState: Record<string, any> }).setupState.quantity.executionId).toBe('2');expect(document.body.textContent).toContain('执行 2')
  })
  it('shows a read failure and allows retry without fabricating quantities', async() => {
    api.quantities.mockRejectedValueOnce(new Error('数量接口尚未就绪')); await setup()
    expect(document.body.textContent).toContain('数量接口尚未就绪'); expect(document.body.textContent).not.toContain('99999999999999.123456')
    await click('刷新数量'); expect(document.body.textContent).toContain('99999999999999.12')
  })
})

it('keeps negative correction accessible while affected-node positive supplements are blocked', async() => { api.quantities.mockResolvedValue({ productId:'2', executionId: id, workorderId: '1', routingId: '2', targetQty: '10', pathStatus: 'LOCKED', writable: true, boundary: '存在待核实不良', nodes: [{ ...node, positiveReportBlockReason: '工序 D 存在待核实不良，请先核实' }] });await setup();const buttons = [...document.querySelectorAll('button')];expect(buttons.find(b => b.textContent?.trim() === '管理员历史补录')?.disabled).toBe(true);expect(buttons.find(b => b.textContent?.trim() === '数量订正')?.disabled).toBe(false);expect(document.body.textContent).toContain('工序 D 存在待核实不良') })

it('does not discard a previously unknown intent when a retry is forbidden', async() => { api.adjust.mockRejectedValueOnce(new Error('response lost')).mockRejectedValueOnce(new ApiError('FORBIDDEN', '权限撤销', '', 403));const { state } = await setup();await click('数量订正');Object.assign(state.form, { quantity: '-1', reason: '核对' });await click('追加数量流水');const first = [...api.adjust.mock.calls[0]];await click('追加数量流水');expect(api.adjust.mock.calls[1]).toEqual(first);expect(document.body.textContent).toContain('结果待确认');expect(sessionStorage.length).toBeGreaterThan(0) })

it('explains closed normal reporting while preserving independently authorized historical correction', async() => {
  api.quantities.mockResolvedValue({ productId:'2', executionId: id, workorderId: '1', routingId: '2', targetQty: '10', pathStatus: 'LOCKED', writable: false, boundary: '工单未下达或已作废，禁止继续正常报工', nodes: [node] })
  const { state } = await setup();expect(document.body.textContent).toContain('当前不可继续正常报工')
  await click('数量订正');Object.assign(state.form, { quantity: '-1', reason: 'TEST ONLY历史订正' });await click('追加数量流水')
  expect(api.adjust).toHaveBeenCalledWith(id, '-1', 'TEST ONLY历史订正', expect.any(String))
})

it('lets the node table grow with expanded quality details and keeps technical differences out of routine columns', async() => {
  const { wrapper } = await setup()
  const tables = wrapper.findAllComponents({ name: 'ElTable' }), summary = tables[0]!
  expect(summary.props('maxHeight')).toBeUndefined();expect(summary.props('height')).toBeUndefined()
  const labels = summary.findAll('thead th').map(cell => cell.text()).filter(Boolean)
  expect(labels).toEqual(['顺序', '工序', '有效输入', '累计报工', '有效不良', '剩余可报', '净产出'])
  await summary.get('.el-table__expand-icon').trigger('click');await flushPromises()
  expect(wrapper.text()).toContain('不良申报数量（含待核实和重复申报）')
  expect(wrapper.text()).toContain('待核实不良数量')
  for (const label of ['历史已返回', '当前净不良', '已核实独立不良', '上游传播差额', '原始输入减报工差额', '未钳制产出差额', '历史超报/传播差额'])expect(wrapper.text()).not.toContain(label)
  expect(wrapper.text()).toContain('历史操作人员')
  expect(api.page).toHaveBeenCalledWith(id, node.routingNodeId, 0, 20)
})

it('keeps quantity conflicts and raw reporting facts visible with the concise node layout', async() => {
  api.quantities.mockResolvedValueOnce({ executionId: id, pathStatus: 'LOCKED', nodes: [{ ...node, historicalConflict: true, positiveReportBlockReason: '存在待核实不良，请先核实' }] })
  const { wrapper } = await setup()
  expect(wrapper.text()).toContain('部分工序的已报数量超过当前有效输入')
  expect(wrapper.text()).toContain('存在待核实不良，请先核实')
  expect(wrapper.text()).toContain('历史操作人员')
  expect(wrapper.text()).toContain('净产出')
})

it('replays an uncertain historical adjustment unchanged after UOM rules tighten', async() => {
  const {state}=await setup()
  await click('数量订正')
  state.form.quantity='-0.234567';state.form.reason='核对旧报工余量'
  api.adjust.mockRejectedValueOnce(new Error('lost'))
  await click('追加数量流水')
  const frozen=[...api.adjust.mock.calls[0]!]
  rules.unit.mockResolvedValue({mustBeWholeNumber:1,quantityPrecision:0});invalidateQuantityRules()
  await flushPromises();state.form.quantity='0'
  await click('追加数量流水')
  expect(api.adjust.mock.calls[1]).toEqual(frozen)
})
