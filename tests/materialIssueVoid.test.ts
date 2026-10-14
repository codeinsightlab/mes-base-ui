import { beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus, { ElMessageBox } from 'element-plus'
import { useAuth } from '../src/stores/auth'
import Action from '../src/components/business/MaterialIssueVoidAction.vue'
const cancel = vi.hoisted(() => vi.fn())
vi.mock('../src/api/issue/mesMaterialIssue', () => ({ voidMaterialIssue: cancel }))
beforeEach(() => { vi.clearAllMocks(); vi.spyOn(ElMessageBox,'confirm').mockResolvedValue(undefined as never); cancel.mockResolvedValue({status:'VOIDED',voidExecutionMode:'LOCAL_ONLY'}) })
function setup(status='RECORDED', permission=true) {
 const pinia = createPinia(), auth = useAuth(pinia); auth.factoryId='A'; auth.factoryPermissions=permission?['business:mes:material:issue:void']:[]
 const refresh=vi.fn().mockResolvedValue(undefined)
 const wrapper=mount(Action,{props:{row:{id:'9007199254740993',status,sourceExecutionMode:'LOCAL_ONLY',externalEffect:'NONE'},refresh,dirty:false},global:{plugins:[pinia,ElementPlus]}})
 return {wrapper,auth,refresh}
}
it('requires void permission independently of ordinary edit permission',async()=>{const {wrapper}=setup('RECORDED',false);expect(wrapper.find('button').exists()).toBe(false);wrapper.unmount()})
it('voids the saved identity and refreshes the document',async()=>{const {wrapper,refresh}=setup();await wrapper.find('button').trigger('click');await flushPromises();expect(cancel).toHaveBeenCalledWith('9007199254740993',false);expect(refresh).toHaveBeenCalledOnce();wrapper.unmount()})
it('queries an unknown operation without another cancel write',async()=>{const {wrapper}=setup('VOID_UNKNOWN');expect(wrapper.text()).toContain('核实作废结果');await wrapper.find('button').trigger('click');await flushPromises();expect(cancel).toHaveBeenCalledWith('9007199254740993',true);wrapper.unmount()})
it('rejects late results after factory changes',async()=>{let release!: (x:unknown)=>void;cancel.mockImplementationOnce(()=>new Promise(r=>release=r));const {wrapper,auth,refresh}=setup();await wrapper.find('button').trigger('click');await flushPromises();auth.factoryId='B';auth.revision++;release({status:'VOIDED'});await flushPromises();expect(refresh).not.toHaveBeenCalled();wrapper.unmount()})
it('prevents submitting a void on an unsaved draft or restoring a voided row',async()=>{const {wrapper}=setup();await wrapper.setProps({dirty:true});expect(wrapper.find('button').attributes('disabled')).toBeDefined();await wrapper.setProps({dirty:false,row:{id:'1',status:'VOIDED',voidExecutionMode:'LOCAL_ONLY'}});expect(wrapper.find('button').exists()).toBe(false);expect(wrapper.text()).toContain('LOCAL_ONLY');wrapper.unmount()})
