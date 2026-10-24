import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import Reporting from '../src/views/production/productionReporting/index.vue'
import { useAuth } from '../src/stores/auth'
import { ApiError, configureRequests } from '../src/lib/request'
const { context, submit, scan } = vi.hoisted(() => ({ context: vi.fn(), submit: vi.fn(), scan: vi.fn() }))
vi.mock('../src/api/production/productionScan', () => ({ scanExecution: scan }))
vi.mock('../src/api/production/productionReporting', () => ({ submitPermission: 'business:production:report:submit', productionReporting: { context, submit }}))
const data = (id = '1') => ({ identity: { executionId: id, workorderCode: 'TEST_WO', productCode: 'M', productName: '阶段物料', batchNo: 'BATCH-001', routingId: '7', routingCode: 'R', routingVersion: 2, status: 'READY', targetQty: '10.000001' }, quantities: { routingLabel: 'R / V2 · 工艺', executionId: id, pathStatus: 'LOCKED', nodes: [{ routingNodeId: '11', code: 'A', name: '钻孔', sequenceNo: 1, inputQty: '10.000001', reportedQty: '3.000001', defectQty: '1.000000', effectiveOutputQty: '2.000001', qualityIntegrated: true, availableQty: '7.000000' }, { routingNodeId: '12', code: 'B', name: '铣削', sequenceNo: 2, inputQty: '0', reportedQty: '0', defectQty: '0', effectiveOutputQty: '0', qualityIntegrated: true, availableQty: '0' }] }, candidates: [{ routingNodeId: '11', status: 'AVAILABLE', reason: null }, { routingNodeId: '12', status: 'NOT_ASSIGNED', reason: '不在派工名单中' }], path: { nodes: [], edges: [], selectedNodeIds: [] }})
type State = { code: string; locate: () => Promise<void>; submit: () => Promise<void>; retryPending: () => Promise<void>; selectedId: string; quantity: string; context: ReturnType<typeof data> | null; result: { id: string } | null; pending: { requestId: string } | null; error: string; showAll: boolean; loading: boolean }
let wrapper: ReturnType<typeof mount>
beforeEach(() => {
  sessionStorage.clear(); vi.resetAllMocks();scan.mockImplementation((_type:string, code:string) => Promise.resolve(data(code === 'WO2:P001#BATCH-002' ? '2' : '1').identity)); vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }); context.mockResolvedValue(data())
  submit.mockResolvedValue({ id: '81', executionId: '1', quantityDelta: '2.000001', reportTime: '2026-10-16T09:00:00' })
})
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = ''; vi.restoreAllMocks(); vi.unstubAllGlobals() })
async function setup() {
  const pinia = createPinia(), auth = useAuth(pinia); auth.userId = '7'; auth.token = 'TEST'; auth.sessionReady = true; auth.factoryId = 'A'; auth.factoryPermissions = ['business:production:report:submit']
  wrapper = mount(Reporting, { global: { plugins: [pinia, ElementPlus] }}); await flushPromises()
  const state = wrapper.vm as unknown as State; state.code = 'WO1:P001#BATCH-001'; await state.locate(); await flushPromises()
  return { state, auth, pinia }
}
it('locates by scanner input without writing, shows quantities, and explains unavailable nodes', async() => {
  const { state } = await setup(); expect(scan).toHaveBeenCalledWith('REPORTING', 'WO1:P001#BATCH-001', 'TEXT');expect(context).toHaveBeenCalledWith('1'); expect(submit).not.toHaveBeenCalled()
  expect(wrapper.text()).toContain('原始申报量'); expect(wrapper.text()).toContain('当前净不良'); expect(wrapper.text()).toContain('待核实'); expect(wrapper.text()).toContain('历史已返回'); expect(wrapper.text()).toContain('2'); expect(wrapper.text()).not.toContain('质量尚未接入'); expect(wrapper.text()).toContain('阶段物料'); expect(wrapper.text()).toContain('10')
  state.showAll = true; await flushPromises(); expect(wrapper.text()).toContain('不在派工名单中')
  const option = wrapper.findAllComponents({ name: 'ElOption' }).find(n => n.props('value') === '12')
  expect(option?.props('disabled')).toBe(true)
})
it('submits only the allowed command fields, blocks double clicks, refreshes and generates a new ID for a new action', async() => {
  const { state } = await setup(); let release!: (v: unknown) => void; submit.mockImplementationOnce(() => new Promise(r => { release = r }))
  state.selectedId = '11'; state.quantity = '2.01'; const pending = state.submit(); await state.submit()
  expect(submit).toHaveBeenCalledTimes(1)
  const first = { ...submit.mock.calls[0]![0] }; expect(Object.keys(first).sort()).toEqual(['executionId', 'reportQty', 'requestId', 'routingNodeId', 'workstationId'])
  release({ id: '81', quantityDelta: '2.000001', reportTime: '2026-10-16T09:00:00' }); await pending
  expect(state.result?.id).toBe('81'); expect(context).toHaveBeenCalledTimes(2);expect(scan).toHaveBeenCalledTimes(1)
  state.selectedId = '11'; state.quantity = '1'; await state.submit(); expect(submit.mock.calls[1]![0].requestId).not.toBe(first.requestId)
})
it('retries an unknown timeout using the same frozen request and quantity', async() => {
  const { state } = await setup(); submit.mockRejectedValueOnce(new Error('网络超时'))
  state.selectedId = '11'; state.quantity = '2'; await state.submit(); const first = { ...submit.mock.calls[0]![0] }
  expect(state.pending).not.toBeNull(); await flushPromises(); expect(wrapper.text()).toContain('按原请求确认／重试报工')
  await state.submit(); await wrapper.find('.report-form').trigger('submit'); expect(submit).toHaveBeenCalledTimes(1)
  await state.retryPending(); expect(submit.mock.calls[1]![0]).toEqual(first); expect(state.pending).toBeNull()
})
it('keeps a confirmed success when quantity refresh fails, without treating it as a retryable write', async() => {
  const { state } = await setup(); context.mockRejectedValueOnce(new Error('查询失败'))
  state.selectedId = '11'; state.quantity = '2'; await state.submit()
  expect(state.result?.id).toBe('81'); expect(state.pending).toBeNull(); expect(state.error).toContain('报工已成功')
})
it('allows correcting input after a definite rejection', async() => {
  const { state } = await setup(); submit.mockRejectedValueOnce(new ApiError('REPORT_QUANTITY_CONFLICT', '超报', '', 409))
  state.selectedId = '11'; state.quantity = '2'; await state.submit(); expect(state.pending).toBeNull()
})
it.each(['factory', 'permission', 'unmount'])('ignores late submit results after %s changes', async(change) => {
  const { state, auth } = await setup(); let release!: (v: unknown) => void; submit.mockImplementationOnce(() => new Promise(r => { release = r }))
  state.selectedId = '11'; state.quantity = '2'; const task = state.submit()
  if (change === 'factory') auth.factoryId = 'B'
  if (change === 'permission') auth.factoryPermissions = []
  if (change === 'unmount') { wrapper.unmount() }
  await flushPromises(); release({ id: 'OLD_RESULT' }); await task; expect(state.result).toBeNull(); expect(state.pending).toBeNull()
  if (change === 'permission') expect(wrapper.text()).toContain('没有正式生产报工权限')
})
it('ignores a late scan response without querying context for the old execution', async() => {
  const { state } = await setup();let release!:(v:unknown) => void;context.mockClear();context.mockResolvedValueOnce(data('2'))
  scan.mockImplementationOnce(() => new Promise(r => release = r))
  const old = state.locate();state.code = 'WO2:P001#BATCH-002';await state.locate();release(data('1').identity);await old
  expect(state.context?.identity.executionId).toBe('2');expect(context).toHaveBeenCalledExactlyOnceWith('2')
})
it.each(['0', '-1', '1.1234567'])('rejects invalid quantity %s before sending', async(qty) => {
  const { state } = await setup(); state.selectedId = '11'; state.quantity = qty; await state.submit(); expect(submit).not.toHaveBeenCalled()
})

it('explains a known quality gate even with unavailable rows hidden and forbids its selection', async() => { const d = data();d.candidates[1] = { routingNodeId: '12', status: 'QUALITY_PENDING', reason: '工序 D · 热处理存在待核实不良，须先核实质量记录' };context.mockResolvedValue(d);const { state } = await setup();expect(wrapper.text()).toContain('工序 D · 热处理存在待核实不良');const option = wrapper.findAllComponents({ name: 'ElOption' }).find(n => n.props('value') === '12');expect(option?.props('disabled')).toBe(true);state.selectedId = '12';state.quantity = '1';await state.submit();expect(submit).not.toHaveBeenCalled() })

it('passes an image scanner source and exact code through the common audit entry', async() => {
  await setup();const scanner = wrapper.findComponent({ name: 'CodeScanner' })
  scanner.vm.$emit('confirm', ' WO:PRODUCT#BATCH ', 'IMAGE');await flushPromises()
  expect(scan).toHaveBeenLastCalledWith('REPORTING', ' WO:PRODUCT#BATCH ', 'IMAGE')
  expect(wrapper.text()).toContain('BATCH-001')
})

it('restores an in-flight request after refresh without posting until the user retries, independent of context', async() => {
  const { state, pinia } = await setup()
  let release!: (v: unknown) => void; submit.mockImplementationOnce(() => new Promise(r => { release = r }))
  state.selectedId = '11'; state.quantity = '2.00'; const task = state.submit()
  const original = { ...submit.mock.calls[0]![0] }
  wrapper.unmount()
  wrapper = mount(Reporting, { global: { plugins: [pinia, ElementPlus] }})
  await flushPromises()
  const restored = wrapper.vm as unknown as State
  expect(restored.context).toBeNull(); expect(restored.pending).toEqual(original)
  expect(submit).toHaveBeenCalledTimes(1)
  submit.mockRejectedValueOnce(new ApiError('REPORT_QUANTITY_CONFLICT', '超报', '', 409))
  await restored.retryPending()
  expect(submit.mock.calls[1]![0]).toEqual(original); expect(restored.pending).toEqual(original)
  release({ id: 'OLD' }); await task
  expect(restored.result).toBeNull()
})

it('keeps an unknown request when locating another execution and replays only the original', async() => {
  const { state } = await setup(); submit.mockRejectedValueOnce(new ApiError('NETWORK_ERROR', '超时'))
  state.selectedId = '11'; state.quantity = '2'; await state.submit()
  const original = { ...submit.mock.calls[0]![0] }
  context.mockResolvedValueOnce(data('2'))
  const scanner = wrapper.findComponent({ name: 'CodeScanner' }); expect(scanner.props('disabled')).toBe(false)
  scanner.vm.$emit('confirm', 'WO2:P001#BATCH-002', 'TEXT'); await flushPromises()
  expect(state.context?.identity.executionId).toBe('2'); expect(state.pending).toEqual(original)
  await state.submit(); expect(submit).toHaveBeenCalledTimes(1)
  await state.retryPending(); expect(submit.mock.calls[1]![0]).toEqual(original)
  expect(context).toHaveBeenCalledTimes(2)
})

it.each([
  ['UNAUTHENTICATED', 401], ['FORBIDDEN', 403], ['EXECUTION_NOT_FOUND', 404],
  ['RESOURCE_CONFLICT', 409], ['CONTEXT_CHANGED', 0], ['HTTP_ERROR', 500], ['INVALID_RESPONSE', 200]
])('retains %s without treating the original write as rejected', async(code, status) => {
  const { state } = await setup(); submit.mockRejectedValueOnce(new ApiError(String(code), '待核实', '', Number(status)))
  state.selectedId = '11'; state.quantity = '2'; await state.submit()
  const original = { ...submit.mock.calls[0]![0] }
  expect(state.pending).toEqual(original); expect(sessionStorage.length).toBe(1)
})

it('isolates user/factory records across logout and requires fresh trusted identity and permission', async() => {
  const { state, auth } = await setup(); submit.mockRejectedValueOnce(new Error('超时'))
  state.selectedId = '11'; state.quantity = '2'; await state.submit(); const original = { ...state.pending }
  auth.clear(); await flushPromises(); expect(state.pending).toBeNull(); expect(wrapper.text()).not.toContain(original.requestId)
  auth.token = 'NEW'; auth.userId = '8'; auth.factoryId = 'A'; auth.factoryPermissions = ['business:production:report:submit']
  await flushPromises(); expect(state.pending).toBeNull()
  auth.userId = '7'; auth.factoryId = 'B'; await flushPromises(); expect(state.pending).toBeNull()
  auth.factoryId = 'A'; auth.factoryPermissions = []; await flushPromises(); expect(state.pending).toBeNull()
  auth.factoryPermissions = ['business:production:report:submit']; await flushPromises(); expect(state.pending).toEqual(original)
  expect(submit).toHaveBeenCalledTimes(1)
})

it('fails closed before POST when saving recovery fails', async() => {
  const { state } = await setup(); const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full') })
  state.selectedId = '11'; state.quantity = '2'; await state.submit()
  expect(submit).not.toHaveBeenCalled(); expect(wrapper.text()).toContain('尚未发送'); set.mockRestore()
})

it('does not overwrite corrupt recovery data and blocks all writes', async() => {
  const { state } = await setup(); submit.mockRejectedValueOnce(new Error('offline'))
  state.selectedId = '11'; state.quantity = '2'; await state.submit()
  const key = sessionStorage.key(0)!; sessionStorage.setItem(key, '{broken')
  await state.locate(); await state.submit()
  expect(submit).toHaveBeenCalledTimes(1); expect(sessionStorage.getItem(key)).toBe('{broken')
  expect(wrapper.text()).toContain('记录损坏')
})

it('keeps successful recovery evidence and blocks a new command when deletion fails', async() => {
  const { state } = await setup(); const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('denied') })
  state.selectedId = '11'; state.quantity = '2'; await state.submit()
  expect(sessionStorage.length).toBe(1); expect(wrapper.text()).toContain('结果已确定'); expect(state.pending).not.toBeNull()
  expect(state.result?.id).toBe('81'); expect(wrapper.text()).toContain('报工成功：流水 81'); expect(wrapper.text()).toContain('报工已成功，恢复记录待清理')
  await state.submit(); expect(submit).toHaveBeenCalledTimes(1)
  await state.locate(); expect(state.result?.id).toBe('81'); remove.mockRestore()
})

it('retains old scope storage when a submit succeeds after factory switching', async() => {
  const { state, auth } = await setup(); let release!: (v: unknown) => void
  submit.mockImplementationOnce(() => new Promise(r => { release = r })); state.selectedId = '11'; state.quantity = '2'
  const task = state.submit(); const original = { ...state.pending }; auth.factoryId = 'B'
  release({ id: 'late' }); await task
  expect(sessionStorage.length).toBe(1); expect(state.result).toBeNull()
  auth.factoryId = 'A'; await flushPromises(); expect(state.pending).toEqual(original)
})

it('persists the conservative unresolved command before the first POST and retains later domain refusal after a timeout', async() => {
  const { state } = await setup()
  submit.mockImplementationOnce(async(command) => {
    expect(sessionStorage.length).toBe(1)
    expect(JSON.parse(sessionStorage.getItem(sessionStorage.key(0)!)!).command).toEqual(command)
    throw new ApiError('NETWORK_ERROR', '超时')
  })
  state.selectedId = '11'; state.quantity = '2'; await state.submit()
  const original = { ...state.pending }
  submit.mockRejectedValueOnce(new ApiError('REPORT_QUANTITY_CONFLICT', '超报', '', 409))
  await state.retryPending(); expect(state.pending).toEqual(original); expect(sessionStorage.length).toBe(1)
})

it('hides the old pending request and forbids its submission while a new login is still in flight', async() => {
  const { state, auth } = await setup(); submit.mockRejectedValueOnce(new Error('timeout'))
  state.selectedId = '11'; state.quantity = '2'; await state.submit()
  const requestId = state.pending!.requestId
  configureRequests(() => ({ token: auth.token, factoryId: auth.factoryId, revision: auth.revision }), () => auth.clear())
  let reject!: (error: Error) => void
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((_resolve, rejecter) => { reject = rejecter })))
  const login = auth.login('new-user', 'TEST ONLY password')
  await flushPromises()
  expect(auth.userId).toBe(''); expect(state.pending).toBeNull(); expect(wrapper.text()).not.toContain(requestId)
  await state.submit(); expect(submit).toHaveBeenCalledTimes(1); expect(sessionStorage.length).toBe(1)
  reject(new Error('TEST ONLY login interrupted')); await expect(login).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
})

it('invalidates an earlier context read when recovering before that read completes', async() => {
  const { state } = await setup(); submit.mockRejectedValueOnce(new Error('timeout'))
  state.selectedId = '11'; state.quantity = '2'; await state.submit()
  let release!: (value: ReturnType<typeof data>) => void
  context.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
  const locating = state.locate(); await flushPromises(); expect(state.loading).toBe(true)
  await state.retryPending()
  expect(state.loading).toBe(false); expect(state.result?.id).toBe('81')
  release(data()); await locating
  expect(state.context).toBeNull(); expect(state.result?.id).toBe('81')
})

it.each(['button', 'form'])('sends a first report through the normal %s DOM entry without leaking the event into the recovery flag', async(entry) => {
  const { state } = await setup(); state.selectedId = '11'; state.quantity = '2'; await flushPromises()
  if (entry === 'button') await wrapper.findAll('button').find(button => button.text() === '确认报工')!.trigger('click')
  else await wrapper.find('form.report-form').trigger('submit')
  await flushPromises()
  expect(submit).toHaveBeenCalledTimes(1)
  expect(submit.mock.calls[0]![0]).toMatchObject({ executionId: '1', routingNodeId: '11', reportQty: '2' })
  expect(state.result?.id).toBe('81')
})

it('blocks both ordinary DOM entries while pending and replays only from the explicit recovery button', async() => {
  const { state } = await setup(); state.selectedId = '11'; state.quantity = '2'
  submit.mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 'timeout'))
  await wrapper.find('form.report-form').trigger('submit'); await flushPromises()
  const original = { ...submit.mock.calls[0]![0] }
  await wrapper.findAll('button').find(button => button.text() === '确认报工')!.trigger('click')
  await wrapper.find('form.report-form').trigger('submit'); await flushPromises()
  expect(submit).toHaveBeenCalledTimes(1)
  await wrapper.findAll('button').find(button => button.text() === '按原请求确认／重试报工')!.trigger('click')
  await flushPromises()
  expect(submit).toHaveBeenCalledTimes(2); expect(submit.mock.calls[1]![0]).toEqual(original)
  expect(state.result?.id).toBe('81')
})
