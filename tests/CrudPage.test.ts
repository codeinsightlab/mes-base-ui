import {describe,it,expect,vi,beforeEach} from 'vitest'
import {mount,flushPromises} from '@vue/test-utils'
import {createPinia,setActivePinia} from 'pinia'
import ElementPlus from 'element-plus';import {useAuth} from '../src/stores/auth'
import CrudPage from '../src/components/CrudPage.vue'
const fields=[{key:'id',label:'标识',kind:'text',readonly:true},{key:'code',label:'编码',kind:'text',required:true},{key:'name',label:'名称',kind:'text',required:true}] as const
function api(){return {list:vi.fn().mockResolvedValue({items:[{id:'9007199254740993',code:'TEST',name:'TEST ONLY'}],total:1,offset:0,limit:20}),create:vi.fn(),update:vi.fn(),remove:vi.fn()}}
beforeEach(()=>{setActivePinia(createPinia());vi.stubGlobal('ResizeObserver',class{observe(){}unobserve(){}disconnect(){}})})
describe('shared CRUD view',()=>{
 it('loads rows and hides write buttons without grants',async()=>{const auth=useAuth();auth.factoryPermissions=['test:read'];const target=api();const wrapper=mount(CrudPage,{props:{title:'合成配置',permission:'test',api:target,fields:[...fields]},global:{plugins:[createPinia(),ElementPlus]}});await flushPromises();expect(wrapper.text()).toContain('TEST ONLY');expect(wrapper.text()).not.toContain('新增记录');expect(target.list).toHaveBeenCalledWith({offset:0,limit:20});wrapper.unmount()})
 it('shows safe error and clears old records when reload fails',async()=>{const target=api();target.list.mockRejectedValue(new Error('当前范围没有此操作权限'));const wrapper=mount(CrudPage,{props:{title:'合成配置',permission:'test',api:target,fields:[...fields]},global:{plugins:[createPinia(),ElementPlus]}});await flushPromises();expect(wrapper.text()).toContain('当前范围没有此操作权限');expect(wrapper.text()).toContain('暂无记录');wrapper.unmount()})
})
