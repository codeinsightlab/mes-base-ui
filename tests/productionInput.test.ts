import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import Input from '../src/views/production/productionInput/index.vue'
import { useAuth } from '../src/stores/auth'
const { query, preview, calculate, submit } = vi.hoisted(() => ({query: vi.fn(), preview: vi.fn(), calculate: vi.fn(), submit: vi.fn()}))
vi.mock('../src/api/production/productionInput', () => ({inputPermission: 'business:mes:material:issue:update', productionInput: {query, preview, calculate, submit}}))
vi.mock('vue-router', () => ({useRouter: () => ({push: vi.fn()})}))
const stock = {reference:'1', materialId:'1', materialCode:'M1', lotCode:'000L', warehouseId:'1', warehouseCode:'W1', binCode:'B1', unitId:'1', unitCode:'KG', availableQty:'1000.000001', observedAt:'2026-10-16T10:00:00'}
const order = {workorderId:'1', workorderCode:'WO1', productCode:'P1', productName:'控制臂', workCenter:'CENTER', plannedQty:'1000', outputUnitCode:'PCS', status:'RELEASED', allowedWarehouses:['1']}
const definition = {routing:{id:'7',code:'R1',name:'加工',version:2}, products:[], nodes:[{id:'11',nodeCode:'A',operationId:'1',operationName:'钻孔',displayOrder:99,isKey:false,description:null}],edges:[]}
type State = {code:string; orderId:string; stockId:string; outputQty:string; selected:string[]; query:()=>Promise<void>; calculate:()=>Promise<void>; submit:()=>Promise<void>; supply:unknown; preview:unknown; pending:{requestId:string}|null; result:{executionNo:string}|null}
let wrapper:ReturnType<typeof mount>
beforeEach(() => {sessionStorage.clear(); vi.resetAllMocks(); vi.stubGlobal('ResizeObserver',class {observe(){} unobserve(){} disconnect(){}}); query.mockResolvedValue({sourceMode:'LOCAL_ONLY',stocks:[stock],orders:[order]}); preview.mockResolvedValue({definition,actual:null}); calculate.mockResolvedValue({sourceMode:'LOCAL_ONLY',order,stock,outputQty:'100',issueQty:'200.000000',calculationKey:'freeze-1'}); submit.mockResolvedValue({requestId:'r',issueId:'2',executionId:'3',executionNo:'EXE-3',code:'MES1.UDE.TTE.MDAwTA',status:'CONFIRMED',productionInputQty:'100',availableQty:'100'})})
afterEach(()=>{wrapper?.unmount();document.body.innerHTML=''})
async function setup(){const pinia=createPinia(),auth=useAuth(pinia);auth.factoryId='A';auth.factoryPermissions=['business:mes:material:issue:update'];wrapper=mount(Input,{global:{plugins:[pinia,ElementPlus],stubs:{RoutingGraphPreview:true}}});const s=wrapper.vm as unknown as State;s.code='M1#000L';await s.query();await flushPromises();return {s,auth}}
it('queries without writes, auto-selects only one order, and keeps separate material and output quantities',async()=>{const {s}=await setup();expect(s.orderId).toBe('1');expect(submit).not.toHaveBeenCalled();expect(wrapper.text()).toContain('独立 MES');s.stockId='1';s.outputQty='100';await s.calculate();expect(wrapper.text()).toContain('200.000000');s.selected=['11'];await s.submit();expect(submit.mock.calls[0]![0]).toMatchObject({code:'M1#000L',outputQty:'100',calculationKey:'freeze-1',inputKind:'PRODUCTION_INPUT'});expect(submit.mock.calls[0]![0]).not.toHaveProperty('issueQty');expect(wrapper.text()).toContain('EXE-3')})
it('leaves multiple eligible orders for user choice',async()=>{query.mockResolvedValue({sourceMode:'LOCAL_ONLY',stocks:[stock],orders:[order,{...order,workorderId:'2',workorderCode:'WO2'}]});const {s}=await setup();expect(s.orderId).toBe('');expect(preview).not.toHaveBeenCalled()})
it('keeps the same request after a lost response and prevents double submission',async()=>{const {s}=await setup();s.stockId='1';s.outputQty='100';await s.calculate();s.selected=['11'];submit.mockRejectedValueOnce(new Error('网络断开'));await s.submit();const first={...submit.mock.calls[0]![0]};await s.submit();expect(submit.mock.calls[1]![0]).toEqual(first)})
it.each(['factory','permission'])('clears state and rejects late responses on %s change',async(kind)=>{const {s,auth}=await setup();let release!:(v:unknown)=>void;query.mockImplementationOnce(()=>new Promise(r=>{release=r}));const task=s.query();if(kind==='factory')auth.factoryId='B';else auth.factoryPermissions=[];await flushPromises();release({sourceMode:'LOCAL_ONLY',stocks:[stock],orders:[order]});await task;expect(s.supply).toBeNull();expect(s.pending).toBeNull();expect(s.code).toBe('')})
it('loads every candidate page without selecting a sole row from a larger result', async()=>{
 query.mockResolvedValueOnce({sourceMode:'LOCAL_ONLY',stocks:[stock],orders:[order],total:2,offset:0,limit:1})
 const {s}=await setup();expect(s.orderId).toBe('');expect(wrapper.text()).toContain('加载更多匹配工单')
 query.mockResolvedValueOnce({sourceMode:'LOCAL_ONLY',stocks:[stock],orders:[{...order,workorderId:'2'}],total:2,offset:1,limit:1})
 await (wrapper.vm as unknown as {moreOrders:()=>Promise<void>}).moreOrders()
 expect(query).toHaveBeenLastCalledWith('M1#000L',1)
 expect(wrapper.text()).toContain('2 / 2')
})

it('keeps UNKNOWN query enabled and retains the original request across reopening',async()=>{const{s}=await setup();s.stockId='1';s.outputQty='100';await s.calculate();s.selected=['11'];submit.mockResolvedValueOnce({requestId:'r',issueId:'2',executionId:'3',executionNo:'EXE-3',status:'SUBMIT_UNKNOWN'});await s.submit();const first=JSON.parse(JSON.stringify(submit.mock.calls[0]![0]));expect(wrapper.text()).toContain('打开本次领料单并核实');const retry=wrapper.findAll('button').find(b=>b.text()==='使用原请求重查');expect(retry?.attributes('disabled')).toBeUndefined();wrapper.unmount();const {s:reopened}=await setup();await reopened.submit();expect(submit.mock.calls[1]![0]).toEqual(first)})
