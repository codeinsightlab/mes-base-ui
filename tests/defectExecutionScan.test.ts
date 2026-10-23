import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus, { ElMessageBox, type MessageBoxData } from 'element-plus'
import { useAuth } from '../src/stores/auth'
import Panel from '../src/components/business/quality/DefectDeclarationPanel.vue'
const api=vi.hoisted(()=>({scan:vi.fn(),nodes:vi.fn(),context:vi.fn(),declare:vi.fn()}))
vi.mock('../src/api/production/productionScan',()=>({scanExecution:api.scan}))
vi.mock('../src/api/quality/qualityV2',()=>({qualityV2:api,wasteLabels:{PROCESS:'工废',MATERIAL:'料废',BOTH:'工废＋料废'}}))
const identity={executionId:'9007199254740999',workorderCode:'WO-EXACT',productCode:'PRODUCT-EXACT',batchNo:'BATCH-EXACT'}
let wrapper:ReturnType<typeof mount>
beforeEach(()=>{
 sessionStorage.clear();vi.clearAllMocks();vi.stubGlobal('ResizeObserver',class{observe(){}unobserve(){}disconnect(){}})
 api.scan.mockResolvedValue(identity);api.nodes.mockResolvedValue([{id:'12',sequenceNo:1,name:'车削'}]);api.context.mockResolvedValue({types:[],typeTotal:0})
})
afterEach(()=>{wrapper?.unmount();document.body.innerHTML='';vi.restoreAllMocks();vi.unstubAllGlobals()})
async function setup(permissions=['business:quality:defect:create'],props={}){
 const pinia=createPinia(),auth=useAuth(pinia);auth.factoryId='A';auth.username='tester';auth.factoryPermissions=permissions
 wrapper=mount(Panel,{props,global:{plugins:[pinia,ElementPlus],stubs:{ExecutionSelect:true}}})
 await flushPromises();const state=(wrapper.vm.$ as unknown as {setupState:Record<string,any>}).setupState
 return{state,auth}
}
it('locates independent declarations through the shared scanner without submitting a defect or rescanning context refreshes',async()=>{
 const{state}=await setup()
 wrapper.findComponent({name:'CodeScanner'}).vm.$emit('confirm',' WO:PRODUCT#BATCH ','IMAGE');await flushPromises()
 expect(api.scan).toHaveBeenCalledExactlyOnceWith('DEFECT_DECLARATION',' WO:PRODUCT#BATCH ','IMAGE')
 expect(state.execution).toBe(identity.executionId);expect(api.nodes).toHaveBeenCalledWith(identity.executionId)
 expect(wrapper.text()).toContain('BATCH-EXACT');expect(api.declare).not.toHaveBeenCalled()
 state.node='12';await state.loadContext();await state.loadNodes()
 expect(api.scan).toHaveBeenCalledTimes(1);expect(api.context).toHaveBeenCalledWith(identity.executionId,'12',0)
})
it('preserves dirty fields when changing execution is cancelled before any scan request',async()=>{
 const{state}=await setup();state.quantity='3';state.remark='尚未提交'
 vi.spyOn(ElMessageBox,'confirm').mockRejectedValueOnce('cancel')
 await state.locateExecution('WO:PRODUCT#BATCH','TEXT')
 expect(api.scan).not.toHaveBeenCalled();expect(state.quantity).toBe('3');expect(state.remark).toBe('尚未提交')
})
it('clears confirmed discarded fields only after a successful scan',async()=>{
 const{state}=await setup();state.quantity='3';state.remark='尚未提交';state.type='old-type'
 vi.spyOn(ElMessageBox,'confirm').mockResolvedValueOnce('confirm' as MessageBoxData)
 await state.locateExecution('WO:PRODUCT#BATCH')
 expect(api.scan).toHaveBeenCalledWith('DEFECT_DECLARATION','WO:PRODUCT#BATCH','TEXT')
 expect(state.quantity).toBe('');expect(state.remark).toBe('');expect(state.type).toBe('');expect(state.execution).toBe(identity.executionId)
})
it('cannot replace an unknown declaration or corrupted recovery payload with a scan',async()=>{
 const{state}=await setup();state.pending={requestId:'original',executionId:'old-execution'}
 await state.locateExecution('WO:PRODUCT#BATCH');expect(api.scan).not.toHaveBeenCalled();expect(state.pending.requestId).toBe('original')
 state.pending=null;state.recoveryBlocked=true;await state.locateExecution('WO:PRODUCT#BATCH');expect(api.scan).not.toHaveBeenCalled()
})
it('does not scan without create permission or replace an execution fixed by the caller',async()=>{
 const{state}=await setup([]);await state.locateExecution('WO:PRODUCT#BATCH');expect(api.scan).not.toHaveBeenCalled()
 wrapper.unmount();const fixed=await setup(undefined,{executionId:'fixed'})
 await fixed.state.locateExecution('WO:PRODUCT#BATCH');expect(api.scan).not.toHaveBeenCalled();expect(fixed.state.execution).toBe('fixed')
})
it.each(['factory','permission'])('rejects a late scan on %s change without loading its nodes',async mode=>{
 const{state,auth}=await setup();let finish!:(v:unknown)=>void
 api.scan.mockImplementationOnce(()=>new Promise(resolve=>finish=resolve))
 const wait=state.locateExecution('WO:PRODUCT#BATCH','TEXT')
 if(mode==='factory')auth.factoryId='B';else auth.factoryPermissions=[]
 await flushPromises();finish(identity);await wait
 expect(state.execution).toBe('');expect(state.scanIdentity).toBeNull();expect(api.nodes).not.toHaveBeenCalled()
})

it.each(['factory','permission','switching','unmount'])('does not audit an old code when %s changes during dirty-form confirmation',async mode=>{
 const{state,auth}=await setup();state.quantity='3';state.remark='旧工厂未提交内容'
 let accept!:()=>void
 vi.spyOn(ElMessageBox,'confirm').mockImplementationOnce(()=>new Promise(resolve=>{accept=()=>resolve('confirm' as MessageBoxData)}))
 const wait=state.locateExecution('OLD:PRODUCT#BATCH','TEXT')
 expect(state.scanning).toBe(true);expect(api.scan).not.toHaveBeenCalled()
 if(mode==='factory')auth.factoryId='B'
 else if(mode==='permission')auth.factoryPermissions=[]
 else if(mode==='switching')auth.factorySwitching=true
 else wrapper.unmount()
 expect(state.scanning).toBe(false)
 accept();await wait
 expect(api.scan).not.toHaveBeenCalled();expect(state.execution).toBe('');expect(state.scanIdentity).toBeNull()
})
