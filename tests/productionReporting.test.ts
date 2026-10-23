import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import Reporting from '../src/views/production/productionReporting/index.vue'
import { useAuth } from '../src/stores/auth'
import { ApiError } from '../src/lib/request'
const { context, submit, scan } = vi.hoisted(() => ({ context: vi.fn(), submit: vi.fn(), scan:vi.fn() }))
vi.mock('../src/api/production/productionScan',()=>({scanExecution:scan}))
vi.mock('../src/api/production/productionReporting', () => ({ submitPermission: 'business:production:report:submit', productionReporting: { context, submit } }))
const data = (id = '1') => ({ identity: { executionId: id,  workorderCode: 'TEST_WO', productCode: 'M', productName: '阶段物料', batchNo:'BATCH-001', routingId: '7', routingCode: 'R', routingVersion: 2, status: 'READY', targetQty: '10.000001' }, quantities: { routingLabel: 'R / V2 · 工艺', executionId: id, pathStatus: 'LOCKED', nodes: [{ routingNodeId: '11', code: 'A', name: '钻孔', sequenceNo: 1, inputQty: '10.000001', reportedQty: '3.000001', defectQty: '1.000000', effectiveOutputQty: '2.000001', qualityIntegrated: true, availableQty: '7.000000' }, { routingNodeId: '12', code: 'B', name: '铣削', sequenceNo: 2, inputQty: '0', reportedQty: '0', defectQty: '0', effectiveOutputQty: '0', qualityIntegrated: true, availableQty: '0' }] }, candidates: [{ routingNodeId: '11', status: 'AVAILABLE', reason: null }, { routingNodeId: '12', status: 'NOT_ASSIGNED', reason: '不在派工名单中' }], path: { nodes: [], edges: [], selectedNodeIds: [] } })
type State = { code: string; locate: () => Promise<void>; submit: () => Promise<void>; selectedId: string; quantity: string; context: ReturnType<typeof data> | null; result: { id: string } | null; pending: { requestId: string } | null; error: string; showAll: boolean }
let wrapper: ReturnType<typeof mount>
beforeEach(() => {
 vi.resetAllMocks();scan.mockImplementation((_type:string,code:string)=>Promise.resolve(data(code==='WO2:P001#BATCH-002'?'2':'1').identity)); vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }); context.mockResolvedValue(data())
 submit.mockResolvedValue({ id: '81', executionId: '1', quantityDelta: '2.000001', reportTime: '2026-10-16T09:00:00' })
})
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = '' })
async function setup() {
 const pinia = createPinia(), auth = useAuth(pinia); auth.factoryId = 'A'; auth.factoryPermissions = ['business:production:report:submit']
 wrapper = mount(Reporting, { global: { plugins: [pinia, ElementPlus] } }); await flushPromises()
 const state = wrapper.vm as unknown as State; state.code = 'WO1:P001#BATCH-001'; await state.locate(); await flushPromises()
 return { state, auth }
}
it('locates by scanner input without writing, shows quantities, and explains unavailable nodes', async() => {
 const { state } = await setup(); expect(scan).toHaveBeenCalledWith('REPORTING','WO1:P001#BATCH-001','TEXT');expect(context).toHaveBeenCalledWith('1'); expect(submit).not.toHaveBeenCalled()
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
 expect(state.pending).not.toBeNull(); await flushPromises(); expect(wrapper.text()).toContain('安全重试原报工')
 await state.submit(); expect(submit.mock.calls[1]![0]).toEqual(first); expect(state.pending).toBeNull()
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
it.each(['factory', 'permission', 'execution'])('ignores late submit results after %s changes', async(change) => {
 const { state, auth } = await setup(); let release!: (v: unknown) => void; submit.mockImplementationOnce(() => new Promise(r => { release = r }))
 state.selectedId = '11'; state.quantity = '2'; const task = state.submit()
 if (change === 'factory') auth.factoryId = 'B'
 if (change === 'permission') auth.factoryPermissions = []
 if (change === 'execution') { context.mockResolvedValueOnce(data('2')); state.code = 'WO2:P001#BATCH-002'; await state.locate() }
 await flushPromises(); release({ id: 'OLD_RESULT' }); await task; expect(state.result).toBeNull(); expect(state.pending).toBeNull()
 if (change === 'permission') expect(wrapper.text()).toContain('没有正式生产报工权限')
})
it('ignores a late scan response without querying context for the old execution', async() => {
 const { state } = await setup();let release!:(v:unknown)=>void;context.mockClear();context.mockResolvedValueOnce(data('2'))
 scan.mockImplementationOnce(()=>new Promise(r=>release=r))
 const old=state.locate();state.code='WO2:P001#BATCH-002';await state.locate();release(data('1').identity);await old
 expect(state.context?.identity.executionId).toBe('2');expect(context).toHaveBeenCalledExactlyOnceWith('2')
})
it.each(['0', '-1', '1.1234567'])('rejects invalid quantity %s before sending', async(qty) => {
 const { state } = await setup(); state.selectedId = '11'; state.quantity = qty; await state.submit(); expect(submit).not.toHaveBeenCalled()
})

it('explains a known quality gate even with unavailable rows hidden and forbids its selection',async()=>{const d=data();d.candidates[1]={routingNodeId:'12',status:'QUALITY_PENDING',reason:'工序 D · 热处理存在待核实不良，须先核实质量记录'};context.mockResolvedValue(d);const{state}=await setup();expect(wrapper.text()).toContain('工序 D · 热处理存在待核实不良');const option=wrapper.findAllComponents({name:'ElOption'}).find(n=>n.props('value')==='12');expect(option?.props('disabled')).toBe(true);state.selectedId='12';state.quantity='1';await state.submit();expect(submit).not.toHaveBeenCalled()})

it('passes an image scanner source and exact code through the common audit entry',async()=>{
 await setup();const scanner=wrapper.findComponent({name:'CodeScanner'})
 scanner.vm.$emit('confirm',' WO:PRODUCT#BATCH ','IMAGE');await flushPromises()
 expect(scan).toHaveBeenLastCalledWith('REPORTING',' WO:PRODUCT#BATCH ','IMAGE')
 expect(wrapper.text()).toContain('BATCH-001')
})
