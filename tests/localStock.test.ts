import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { createPinia } from 'pinia'
import { useAuth } from '../src/stores/auth'
import { ApiError } from '../src/lib/request'
import Panel from '../src/components/business/warehouse/LocalStockPanel.vue'
const calls = vi.hoisted(() => ({ detail:vi.fn(), actions:vi.fn(), execute:vi.fn() }))
vi.mock('../src/api/wm/wmInventory', () => ({api:{detail:calls.detail}}))
vi.mock('../src/api/wm/localStock', async importOriginal => ({...(await importOriginal<object>()),localStock:{actions:calls.actions,execute:calls.execute}}))
let wrapper: ReturnType<typeof mount>
beforeEach(() => { sessionStorage.clear();vi.clearAllMocks();vi.stubGlobal('ResizeObserver',class{observe(){}unobserve(){}disconnect(){}});calls.detail.mockResolvedValue({id:'9007199254740999',quantity:'800.000001',availableQuantity:'700.000001',materialId:'1',warehouseId:'2',warehouseSource:'LOCAL',batchNo:'LOT',binCode:'BIN'});calls.actions.mockResolvedValue({items:[],total:0});calls.execute.mockResolvedValue({id:'done'}) })
afterEach(() => {wrapper?.unmount();document.body.innerHTML='';vi.unstubAllGlobals()})
async function setup(write=true) { const pinia=createPinia(),auth=useAuth(pinia);auth.factoryId='A';auth.runtimeMode='LOCAL';auth.factoryPermissions=['business:wm:inventory:query','business:wm:stock:action:list',...(write?['business:wm:stock:receipt']:[])];wrapper=mount(Panel,{global:{plugins:[pinia,ElementPlus],stubs:{RouterLink:true}}});const s=(wrapper.vm.$ as unknown as {setupState:Record<string,any>}).setupState;s.open('9007199254740999');await flushPromises();return{s,auth} }
it('sends exact decimal strings and server balance preconditions without client actor or fabricated facts',async()=>{const{s}=await setup();Object.assign(s.form,{quantity:'0.000001',reason:'原料到货凭据TEST'});await s.submit();const command=calls.execute.mock.calls[0]![1];expect(command).toMatchObject({stockId:'9007199254740999',quantity:'0.000001',expectedQuantity:'800.000001',expectedAvailable:'700.000001'});expect(command).not.toHaveProperty('operatorUserId');expect(command).not.toHaveProperty('quantityAfter');expect(s.pending).toBeNull()})
it('freezes the request after uncertainty and restores it on reopen',async()=>{const{s}=await setup();Object.assign(s.form,{quantity:'3',reason:'TEST arrival'});calls.execute.mockRejectedValueOnce(new Error('lost response'));await s.submit();const first=JSON.parse(JSON.stringify(calls.execute.mock.calls[0]![1]));wrapper.unmount();const{s:again}=await setup();Object.assign(again.form,{quantity:'999',reason:'changed'});await again.submit();expect(calls.execute.mock.calls[1]![1]).toEqual(first)})
it.each(['factory','permission'])('rejects late balance and action results after %s changes',async type=>{const{s,auth}=await setup();let release!:(v:unknown)=>void;calls.detail.mockImplementationOnce(()=>new Promise(r=>release=r));const waiting=s.load();if(type==='factory')auth.factoryId='B';else auth.factoryPermissions=[];await flushPromises();release({id:'old',quantity:'999'});await waiting;expect(s.stock).toBeNull();expect(s.rows).toEqual([]);expect(s.visible).toBe(false)})
it('read permission does not authorize a stock command',async()=>{const{s}=await setup(false);Object.assign(s.form,{quantity:'3',reason:'TEST'});await s.submit();expect(calls.execute).not.toHaveBeenCalled()})
it('retains a previously unknown request after a later rejection',async()=>{const{s}=await setup();Object.assign(s.form,{quantity:'3',reason:'TEST'});calls.execute.mockRejectedValueOnce(new Error('lost')).mockRejectedValueOnce(new ApiError('FORBIDDEN','撤权','',403));await s.submit();const first=JSON.parse(JSON.stringify(calls.execute.mock.calls[0]![1]));await s.submit();expect(s.pending.command).toEqual(first);expect(sessionStorage.length).toBeGreaterThan(0)})

it('does not execute local actions for external mirror inventory but keeps original uncertain UUID recovery',async()=>{
 const{s,auth}=await setup();calls.detail.mockResolvedValueOnce({id:'9007199254740999',quantity:'0',availableQuantity:'0',warehouseSource:'EXTERNAL'});await s.load();Object.assign(s.form,{quantity:'1',reason:'TEST'});await s.submit();expect(calls.execute).not.toHaveBeenCalled();
 calls.detail.mockResolvedValueOnce({id:'9007199254740999',quantity:'800',availableQuantity:'700',warehouseSource:'LOCAL'});await s.load();calls.execute.mockRejectedValueOnce(new Error('lost'));await s.submit();const first=JSON.parse(JSON.stringify(s.pending.command));auth.runtimeMode='ERP';calls.execute.mockRejectedValueOnce(new ApiError('BUSINESS_SOURCE_CONFLICT','按原请求核实','',409));await s.submit();expect(calls.execute.mock.calls[1]![1]).toEqual(first);expect(s.pending.command).toEqual(first)
})

it('selects the first permitted local operation after loading source metadata',async()=>{
 const{s,auth}=await setup(false);auth.factoryPermissions=['business:wm:inventory:query','business:wm:stock:action:list','business:wm:stock:gain'];s.open('9007199254740999');await flushPromises();expect(s.operation).toBe('gain');Object.assign(s.form,{quantity:'1',reason:'TEST gain'});await s.submit();expect(calls.execute.mock.calls[0]![0]).toBe('gain')
})
