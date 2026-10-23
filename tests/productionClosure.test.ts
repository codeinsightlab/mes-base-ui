import { afterEach,beforeEach,expect,it,vi } from 'vitest'
import { mount,flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import { useAuth } from '../src/stores/auth'
import Panel from '../src/components/business/production/ProductionClosurePanel.vue'
import Acceptance from '../src/components/business/warehouse/WarehouseAcceptancePanel.vue'
import { ApiError } from '../src/lib/request'
const calls=vi.hoisted(()=>({summary:vi.fn(),recheckReceipt:vi.fn(),release:vi.fn(),history:vi.fn(),execute:vi.fn(),state:vi.fn(),acceptHistory:vi.fn(),acceptExecute:vi.fn(),stock:vi.fn()}))
vi.mock('../src/api/production/productionClosure',()=>({productionClosure:{summary:calls.summary,recheckReceipt:calls.recheckReceipt,release:calls.release,history:calls.history,execute:calls.execute}}))
vi.mock('../src/api/wm/warehouseAcceptance',()=>({warehouseAcceptance:{state:calls.state,history:calls.acceptHistory,execute:calls.acceptExecute}}))
vi.mock('../src/api/wm/wmInventory',()=>({api:{list:calls.stock}}))
let wrapper:ReturnType<typeof mount>
beforeEach(()=>{sessionStorage.clear();vi.clearAllMocks();vi.stubGlobal('ResizeObserver',class{observe(){}unobserve(){}disconnect(){}});calls.summary.mockResolvedValue({executionId:'9007199254740999',status:'RUNNING',targetQty:'100',effective:'94.000001',released:'94.000001',receivedQty:'80',defectQty:'6',receiptState:'PARTIAL',orderBlockedReason:'还有执行未完全入库',received:'80',accepted:'80',remainingHandover:'14.000001',pendingAcceptance:'0',basisHash:'basis',canComplete:false,blockedReason:'投入数量与报工及不良未闭合',completion:null});calls.release.mockResolvedValue({currentReleaseId:'prior',basisHash:'basis',released:'94.000001',basisValid:true});calls.history.mockResolvedValue({items:[],total:0});calls.execute.mockResolvedValue({id:'done'});calls.state.mockResolvedValue({receiptId:'receipt',executionId:'1',productId:'2',warehouseId:'3',pending:'20.000001',accepted:'60',netHandover:'80.000001'});calls.acceptHistory.mockResolvedValue({items:[],total:0});calls.acceptExecute.mockResolvedValue({id:'done'});calls.stock.mockResolvedValue({items:[],total:0})})
afterEach(()=>{wrapper?.unmount();document.body.innerHTML='';vi.unstubAllGlobals()})
async function setup(accept=false,write=true){const pinia=createPinia(),auth=useAuth(pinia);auth.factoryId='A';auth.factoryPermissions=['business:mes:production:execution:query','business:quality:release:read','business:wm:acceptance:read',...(write?['business:quality:release:create','business:quality:release:revoke','business:production:execution:complete','business:wm:acceptance:create','business:wm:acceptance:reverse']:[])];wrapper=mount(accept?Acceptance:Panel,{props:accept?{receiptId:'receipt'}:{id:'9007199254740999'},global:{plugins:[pinia,ElementPlus],stubs:{RouterLink:{props:['to'],template:'<a :href="to.path"><slot /></a>'}}}});const s=(wrapper.vm.$ as unknown as {setupState:Record<string,any>}).setupState;s.open();await flushPromises();return{s,auth}}
it('submits an absolute release total with original release version, preserving decimal strings',async()=>{const{s}=await setup();Object.assign(s.form,{quantity:'94.01',reason:'TEST 明确放行'});await s.submit();expect(calls.execute.mock.calls[0]).toEqual(['9007199254740999',{action:'release',body:{requestId:expect.any(String),quantity:'94.01',expectedReleaseId:'prior',reason:'TEST 明确放行'}}]);expect(calls.execute.mock.calls[0]![1].body).not.toHaveProperty('operatorUserId')})
it('restores unknown release intent and keeps it after later forbidden rejection',async()=>{const{s}=await setup();s.action='release';Object.assign(s.form,{quantity:'94',reason:'TEST 放行'});calls.execute.mockRejectedValueOnce(new Error('lost')).mockRejectedValueOnce(new ApiError('FORBIDDEN','拒绝','',403));await s.submit();const original=JSON.parse(JSON.stringify(calls.execute.mock.calls[0]![1]));wrapper.unmount();const{s:again}=await setup();expect(again.pending).toEqual(original);await again.submit();expect(calls.execute.mock.calls[1]![1]).toEqual(original);expect(again.pending).toEqual(original)})
it.each(['factory','permission'])('drops late closure summaries after %s changes',async mode=>{const{s,auth}=await setup();let finish!:(v:unknown)=>void;calls.summary.mockImplementationOnce(()=>new Promise(r=>finish=r));const task=s.load();if(mode==='factory')auth.factoryId='B';else auth.factoryPermissions=[];await flushPromises();finish({executionId:'stale'});await task;expect(s.data).toBeNull();expect(s.visible).toBe(false)})
it('read permission cannot submit release or completion',async()=>{const{s}=await setup(false,false);Object.assign(s.form,{quantity:'94',reason:'TEST'});await s.submit();expect(calls.execute).not.toHaveBeenCalled()})

it('does not submit a retired manual completion command',async()=>{const{s}=await setup();s.action='complete';s.form.reason='TEST 完工';await s.submit();expect(calls.execute).not.toHaveBeenCalled();expect(s.options.map((o:any)=>o.value)).toEqual(['release','revoke'])})

it('completed production retains its fact and still allows separately authorized output release',async()=>{calls.summary.mockResolvedValueOnce({executionId:'9007199254740999',status:'COMPLETED',targetQty:'100',effective:'94',released:'94',received:'94',accepted:'94',basisHash:'basis',blockedReason:'执行必须处于RUNNING状态',completion:{id:'complete-id',effectiveQty:'94',inboundQty:'94'}});const{s}=await setup();expect(s.options.map((o:any)=>o.value)).toEqual(['release','revoke']);expect(document.body.textContent+wrapper.text()).toContain('complete-id');s.action='complete';s.form.reason='TEST';await s.submit();expect(calls.execute).not.toHaveBeenCalled()})


it('keeps a retired unknown completion identity for reading without resubmitting it',async()=>{const original={action:'complete',body:{requestId:'old-complete',expectedBasisHash:'basis',reason:'原请求'}};sessionStorage.setItem('mes-closure::A:9007199254740999',JSON.stringify(original));const{s}=await setup();expect(s.pending).toEqual(original);expect(s.retiredIntent).toBe(true);await s.submit();expect(calls.execute).not.toHaveBeenCalled();expect(sessionStorage.getItem('mes-closure::A:9007199254740999')).toBe(JSON.stringify(original))})

it('uses the authorized menu path for the unified inbound document link',async()=>{const{s,auth}=await setup();auth.factoryMenus=[{id:'inbound',name:'入库单',path:'/custom/inbound',component:'wm/stockDocuments/index',kind:'MENU',permission:'read',children:[]}];await flushPromises();expect(s.inboundPath).toBe('/custom/inbound');expect(document.body.querySelector('a[href="/custom/inbound"]')?.textContent).toContain('办理入库单')})

it.each([['PENDING','待入库'],['PARTIAL','部分入库'],['FULLY_RECEIVED','完全入库']])('shows actual receipt state %s independently of order completion',async(receiptState,label)=>{calls.summary.mockResolvedValueOnce({executionId:'9007199254740999',status:receiptState==='FULLY_RECEIVED'?'FULLY_RECEIVED':'RUNNING',effective:'90',released:'90',receivedQty:'90',defectQty:'10',receiptState,orderBlockedReason:'计划数量尚未满足',completion:null});const{s}=await setup();expect(document.body.textContent+wrapper.text()).toContain(label);expect(document.body.textContent).toContain('工单未完结：计划数量尚未满足');expect(document.body.textContent).not.toContain('自动生产完工');if(receiptState==='FULLY_RECEIVED')expect(s.options).toEqual([])})

it('uses the explicit receipt recheck button and displays remaining blockers without declaring completion',async()=>{
 const{s}=await setup()
 calls.recheckReceipt.mockResolvedValueOnce({...s.data,receivedQty:'100',effective:'100',blockedReason:'存在未决领料草稿',orderBlockedReason:'工单尚有未完成执行'})
 const button=Array.from(document.body.querySelectorAll('button')).find(button=>button.textContent?.includes('复查入库收尾'))!
 expect(button).toBeTruthy();button.click();await flushPromises()
 expect(calls.recheckReceipt).toHaveBeenCalledWith('9007199254740999')
 expect(calls.execute).not.toHaveBeenCalled()
 expect(document.body.textContent).toContain('存在未决领料草稿')
 expect(document.body.textContent).toContain('工单未完结：工单尚有未完成执行')
 expect(document.body.textContent).toContain('尚未满足完全入库条件')
 expect(wrapper.emitted('changed')).toBeUndefined()
})

it.each(['factory','permission'])('rejects a late recheck result after %s changes',async mode=>{
 const{s,auth}=await setup();let finish!:(v:unknown)=>void
 calls.recheckReceipt.mockImplementationOnce(()=>new Promise(resolve=>finish=resolve))
 const task=s.recheck()
 if(mode==='factory')auth.factoryId='B';else auth.factoryPermissions=[]
 await flushPromises();finish({executionId:'stale',status:'FULLY_RECEIVED',receiptState:'FULLY_RECEIVED'});await task
 expect(s.data).toBeNull();expect(s.rechecking).toBe(false);expect(s.recheckMessage).toBe('');expect(wrapper.emitted('changed')).toBeUndefined()
})

it('does not offer recheck without its permission or for historical and fully received execution states',async()=>{
 const{s}=await setup(false,false);expect(s.canRecheck).toBe(false);await s.recheck();expect(calls.recheckReceipt).not.toHaveBeenCalled()
 wrapper.unmount();const{s:writer}=await setup();expect(writer.canRecheck).toBe(true)
 for(const status of ['COMPLETED','FULLY_RECEIVED','CANCELLED']){writer.data={...writer.data,status,orderBlockedReason:null};expect(writer.canRecheck).toBe(false)}
})

it('rechecks through the receipt rule and keeps an unfinished order distinct from full execution receipt',async()=>{
 const{s}=await setup();calls.recheckReceipt.mockResolvedValueOnce({...s.data,status:'FULLY_RECEIVED',receiptState:'FULLY_RECEIVED',orderBlockedReason:'计划数量尚未满足'})
 await s.recheck();await flushPromises()
 expect(s.data.status).toBe('FULLY_RECEIVED');expect(s.canRecheck).toBe(true)
 expect(document.body.textContent).toContain('工单未完结：计划数量尚未满足')
 expect(document.body.textContent).toContain('工单是否完结以当前工单状态和阻断原因为准')
 expect(wrapper.emitted('changed')).toHaveLength(1)
})

it('can recheck an unfinished order through its fully received execution after the order blocker is removed',async()=>{
 calls.summary.mockResolvedValueOnce({executionId:'9007199254740999',status:'FULLY_RECEIVED',receiptState:'FULLY_RECEIVED',effective:'100',receivedQty:'100',defectQty:'0',orderBlockedReason:'工单仍有未归属执行的领料草稿',completion:{id:'original-receipt',effectiveQty:'100',inboundQty:'100'}})
 const{s}=await setup();expect(s.canRecheck).toBe(true)
 calls.recheckReceipt.mockResolvedValueOnce({...s.data,orderBlockedReason:null})
 const button=Array.from(document.body.querySelectorAll('button')).find(button=>button.textContent?.includes('复查工单收尾'))!
 expect(button).toBeTruthy();button.click();await flushPromises()
 expect(calls.recheckReceipt).toHaveBeenCalledExactlyOnceWith('9007199254740999');expect(calls.execute).not.toHaveBeenCalled()
 expect(s.data.completion.id).toBe('original-receipt');expect(s.data.orderBlockedReason).toBeNull();expect(s.canRecheck).toBe(false)
 expect(document.body.textContent).not.toContain('工单未完结：')
})
