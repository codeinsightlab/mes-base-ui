import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ElementPlus, { ElMessageBox } from 'element-plus'
import { createPinia } from 'pinia'
import { useAuth } from '../src/stores/auth'
import { ApiError } from '../src/lib/request'
import Panel from '../src/components/business/quality/QualityTreatmentPanel.vue'
const api=vi.hoisted(()=>({details:vi.fn(),assess:vi.fn(),dispose:vi.fn()}))
vi.mock('../src/api/quality/qualityTreatment',()=>({qualityTreatment:api,treatmentActionLabel:(v:string)=>({ASSESS:'申报核实',RETURN_NODE:'退回返工',TRANSFER_WAREHOUSE:'转仓入库'}[v]??'未识别的操作')}))
const view={declarationId:'d1',revision:1,executionId:'9007199254740999',routingNodeId:'12',defectQty:'10',returnedQty:'0',transferredQty:'0',attribution:'INDEPENDENT',relatedDeclarationId:null,basis:'已确认独立申报',pendingDispositionQty:'10',state:'PENDING',receiptState:'PENDING',recordAction:'CREATE',events:[]}
let wrapper:ReturnType<typeof mount>
beforeEach(()=>{sessionStorage.clear();vi.resetAllMocks();vi.stubGlobal('ResizeObserver',class{observe(){}unobserve(){}disconnect(){}});api.details.mockResolvedValue(view);api.assess.mockResolvedValue({...view,attribution:'INDEPENDENT'});api.dispose.mockResolvedValue({...view,pendingDispositionQty:'0',transferredQty:'10',state:'TRANSFERRED',receiptState:'RECEIVED'})})
afterEach(()=>{wrapper?.unmount();document.body.innerHTML='';vi.unstubAllGlobals()})
async function setup(write=true){const pinia=createPinia(),auth=useAuth(pinia);auth.factoryId='A';auth.username='tester';auth.factoryPermissions=['business:quality:defect:read',...(write?['business:quality:defect:revise']:[])];wrapper=mount(Panel,{props:{declarationId:'d1',candidates:[],record:{declarationId:'d1',executionStatus:'RUNNING',workorderStatus:'RELEASED',source:'LOCAL'} as any},global:{plugins:[pinia,ElementPlus]}});await flushPromises();const s=(wrapper.vm.$ as unknown as {setupState:Record<string,any>}).setupState;return{s,auth}}
it('opens as a read-only document with explicit actions and no implementation concepts',async()=>{await setup();expect(wrapper.text()).toContain('不良信息');expect(wrapper.text()).toContain('处理记录');expect(wrapper.text()).toContain('办理入仓');expect(wrapper.text()).not.toContain('旧流程');expect(wrapper.text()).not.toContain('本次处理');expect(wrapper.text()).not.toContain('净损失');expect(wrapper.find('.el-dialog').exists()).toBe(false);expect(api.dispose).not.toHaveBeenCalled()})
it('hides processing once all declared quantity has been assigned',async()=>{api.details.mockResolvedValueOnce({...view,pendingDispositionQty:'0',returnedQty:'6',transferredQty:'4',state:'DISPOSED'});const{s}=await setup();expect(s.canTreat).toBe(false);expect(wrapper.findAll('button').some(b=>b.text()==='办理入仓')).toBe(false);expect(wrapper.text()).toContain('历史已返回');expect(wrapper.text()).toContain('已入仓数量')})
it('requires an explicit disposition action and preserves its UUID on uncertainty',async()=>{const{s}=await setup();s.openAction('dispose');s.form.quantity='4';s.form.reason='现场确认';s.form.warehouseId='3';api.dispose.mockRejectedValueOnce(new Error('响应丢失'));await s.submit();const first=JSON.parse(JSON.stringify(api.dispose.mock.calls[0]![1]));expect(first).toMatchObject({destination:'WAREHOUSE',quantity:'4',warehouseId:'3',expectedRevision:1});expect(first).not.toHaveProperty('occurredAt');s.form.quantity='5';await s.submit();expect(api.dispose.mock.calls[1]![1]).toEqual(first)})
it('submits the selected receiving warehouse with exact IDs',async()=>{const{s}=await setup();s.openAction('dispose');s.form.quantity='3';s.form.warehouseId='9007199254740999';s.form.reason='转入不良品库';await s.submit();expect(api.dispose.mock.calls[0]![1]).toMatchObject({destination:'WAREHOUSE',quantity:'3',warehouseId:'9007199254740999'});expect(api.dispose.mock.calls[0]![1]).not.toHaveProperty('productId')})
it('rejects quantity above the pending balance before sending',async()=>{const{s}=await setup();s.openAction('dispose');s.form.quantity='11';s.form.reason='数量核对';await s.submit();expect(api.dispose).not.toHaveBeenCalled();expect(s.formError).toContain('不能超过待处理数量')})
it('restores the current frozen request after reopening',async()=>{const{s}=await setup();s.openAction('dispose');s.form.quantity='4';s.form.reason='现场确认';s.form.warehouseId='3';api.dispose.mockRejectedValueOnce(new Error('响应丢失'));await s.submit();const first=JSON.parse(JSON.stringify(api.dispose.mock.calls[0]![1]));wrapper.unmount();const{s:again}=await setup();expect(again.actionOpen).toBe(true);await again.submit();expect(api.dispose.mock.calls[1]![1]).toEqual(first)})
it('keeps an unknown request when its retry is rejected',async()=>{const{s}=await setup();s.openAction('dispose');s.form.reason='现场确认';s.form.warehouseId='3';api.dispose.mockRejectedValueOnce(new Error('lost')).mockRejectedValueOnce(new ApiError('FORBIDDEN','撤权','',403));await s.submit();const first=JSON.parse(JSON.stringify(s.pending));await s.submit();expect(s.pending).toEqual(first)})
it('sends a separate assessment before any disposition',async()=>{api.details.mockResolvedValueOnce({...view,attribution:'UNVERIFIED',state:'UNVERIFIED'});const{s}=await setup();expect(s.canTreat).toBe(false);s.openAction('assess');s.basis='独立实物核对';s.form.reason='核实完成';await s.submit();expect(api.assess.mock.calls[0]![1]).toMatchObject({assessment:{type:'INDEPENDENT',relatedDeclarationId:null,basis:'独立实物核对'}});expect(api.dispose).not.toHaveBeenCalled()})
it.each(['factory','permission'])('rejects late details after %s changes',async kind=>{const{s,auth}=await setup();let release!:(v:unknown)=>void;api.details.mockImplementationOnce(()=>new Promise(r=>release=r));const wait=s.load();api.details.mockImplementation(()=>new Promise(()=>{}));if(kind==='factory')auth.factoryId='B';else auth.factoryPermissions=[];await flushPromises();release({...view,declarationId:'old-factory'});await wait;expect(s.view).toBeNull();expect(s.pending).toBeNull();expect(s.actionOpen).toBe(false)})
it('retains a changed form if discard is cancelled',async()=>{const{s}=await setup();s.openAction('dispose');s.form.reason='未提交';vi.spyOn(ElMessageBox,'confirm').mockRejectedValueOnce('cancel');await s.closeAction();expect(s.actionOpen).toBe(true);expect(s.form.reason).toBe('未提交')})
it('closes an untouched action without a discard prompt',async()=>{const{s}=await setup();const confirm=vi.spyOn(ElMessageBox,'confirm');s.openAction('dispose');await s.closeAction();expect(s.actionOpen).toBe(false);expect(confirm).not.toHaveBeenCalled()})
it('does not allow a readonly user to start processing',async()=>{const{s}=await setup(false);s.openAction('dispose');expect(s.actionOpen).toBe(false);expect(wrapper.findAll('button').some(b=>b.text()==='办理入仓')).toBe(false)})

it('requires production context before offering an operation',async()=>{const{s}=await setup();await wrapper.setProps({record:undefined});expect(s.canTreat).toBe(false);expect(s.canAssess).toBe(false)})

it('keeps the document and raw records readable when its balance is unresolved', async()=>{
 api.details.mockResolvedValueOnce({...view,state:'UNRESOLVED',pendingDispositionQty:null,returnedQty:null,transferredQty:null,events:[{id:'raw',actionType:'UNSUPPORTED',recordedAt:'2026-01-01T10:00:00',operatorName:'测试人员',reason:'原始记录'}]})
 const{s}=await setup()
 expect(wrapper.text()).toContain('处置待确认')
 expect(wrapper.text()).toContain('原始记录')
 expect(wrapper.find('.el-timeline-item__timestamp').text()).toContain('2026-01-01 10:00:00')
 expect(wrapper.text()).toContain('申报数量')
 expect(s.canTreat).toBe(false)
 expect(s.canAssess).toBe(false)
 expect(wrapper.find('.el-alert--error').exists()).toBe(false)
 const summary=wrapper.find('[aria-label="不良数量去向"]').text()
 expect(summary).toContain('—')
 expect(api.dispose).not.toHaveBeenCalled()
})

it.each([['PENDING','待入仓'],['PARTIAL','部分入仓'],['RECEIVED','已入仓']])('shows authoritative quality receipt state %s',async(receiptState,label)=>{api.details.mockResolvedValueOnce({...view,receiptState});await setup();expect(wrapper.text()).toContain('入仓状态：'+label)})

it('keeps historical returns readable and never resends a retired return request',async()=>{const original={kind:'dispose',command:{requestId:'old-return',expectedRevision:1,destination:'RETURN_NODE',quantity:'4',warehouseId:null,reason:'原请求'}};sessionStorage.setItem('mes-quality-action:tester:A:d1',JSON.stringify(original));api.details.mockResolvedValueOnce({...view,returnedQty:'4',pendingDispositionQty:'6',state:'RETURNED',events:[{id:'historic',actionType:'RETURN_NODE',returnedQty:'4',recordedAt:'2026-01-01T10:00:00',operatorName:'原操作人',reason:'原返回事实'}]});const{s}=await setup();expect(wrapper.text()).toContain('原返回事实');expect(wrapper.text()).toContain('历史已返回');expect(s.pending.kind).toBe('retired-return');await s.submit();expect(api.dispose).not.toHaveBeenCalled();expect(sessionStorage.getItem('mes-quality-action:tester:A:d1')).toBe(JSON.stringify(original))})

it('requires a receiving warehouse and offers no new rework destination',async()=>{const{s}=await setup();s.openAction('dispose');s.form.reason='实物交接';await s.submit();expect(api.dispose).not.toHaveBeenCalled();expect(s.formError).toContain('接收仓库');expect(document.body.textContent).not.toContain('确认退回返工')})
