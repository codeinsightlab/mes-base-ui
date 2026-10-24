import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ElementPlus from 'element-plus'
import { useAuth } from '@/stores/auth'
import ExecutionActions from '@/components/business/production/ExecutionActions.vue'
const mocks = vi.hoisted(() => ({ path: vi.fn(), select: vi.fn(), start: vi.fn() }))
vi.mock('@/api/production/executionActions', () => ({ executionActions: { path: mocks.path, select: mocks.select, start: mocks.start } }))
function setup(permissions: string[]) {
 const pinia = createPinia(); setActivePinia(pinia)
 const auth = useAuth(); auth.factoryId = 'SIMPLE_B'; auth.factoryPermissions = permissions
 return { auth, global: { plugins: [pinia, ElementPlus] } }
}
const prefix = 'business:mes:production:execution:'
const path = { executionId: '9007199254740993', executionStatus: 'READY', routingId: '1', pathStatus: 'SELECTED', revision: 2, selectedAt: null, lockedAt: null, selectedNodeIds: ['11','12','13'], nodes: [{ id:'11', nodeCode:'A', operationName:'同工序', required:false },{ id:'12', nodeCode:'B', operationName:'同工序', required:true },{ id:'13', nodeCode:'C', operationName:'终点', required:false }], edges:[{ fromNodeId:'11',toNodeId:'12' },{ fromNodeId:'12',toNodeId:'13' }] }
beforeEach(() => { vi.resetAllMocks(); document.body.innerHTML = ''; mocks.path.mockResolvedValue(structuredClone(path)); mocks.select.mockResolvedValue(structuredClone(path)) })
describe('Production Core V1 commands', () => {
 it('shows node order and distinct repeated-operation identities, with start disabled before confirmation', async() => {
  const context = setup([prefix+'query',prefix+'update']); const w = mount(ExecutionActions,{ props:{ id:path.executionId },global:context.global })
  await w.find('button').trigger('click'); await flushPromises()
  expect(document.body.textContent).toContain('1. A · 同工序'); expect(document.body.textContent).toContain('2. B · 同工序')
  const start = [...document.body.querySelectorAll('button')].find(b=>b.textContent?.trim()==='开工'); expect(start?.disabled).toBe(true)
  const save = [...document.body.querySelectorAll('button')].find(b=>b.textContent?.trim()==='保存路径'); save?.click(); await flushPromises()
  expect(mocks.select).toHaveBeenCalledWith(path.executionId,2,['11','12','13']); expect(mocks.start).not.toHaveBeenCalled(); w.unmount()
 })
 it('keeps locked path read only and starts through a dedicated action', async() => {
  mocks.path.mockResolvedValue({ ...path,pathStatus:'LOCKED',lockedAt:'2026-10-14T10:00:00' }); mocks.start.mockResolvedValue({ status:'RUNNING' })
  const context=setup([prefix+'query',prefix+'update']); const w=mount(ExecutionActions,{ props:{id:'1'},global:context.global }); await w.find('button').trigger('click'); await flushPromises()
  expect(document.body.textContent).not.toContain('保存路径'); [...document.body.querySelectorAll('button')].find(b=>b.textContent?.trim()==='开工')?.click(); await flushPromises()
  expect(mocks.start).toHaveBeenCalledWith('1'); expect(document.body.textContent).toContain('执行已开工 · RUNNING'); w.unmount()
 })
 it('does not expose write commands to a read-only user', async() => {
  const context=setup([prefix+'query']);const w=mount(ExecutionActions,{props:{id:'1'},global:context.global});await w.find('button').trigger('click');await flushPromises()
  expect(document.body.textContent).not.toContain('保存路径');expect([...document.body.querySelectorAll('button')].some(b=>b.textContent?.trim()==='开工')).toBe(false);w.unmount()
 })
 it('rejects late path results after switching factory and clears the dialog', async() => {
  let release!: (value: unknown)=>void;mocks.path.mockImplementation(()=>new Promise(r=>{release=r}))
  const context=setup([prefix+'query']);const w=mount(ExecutionActions,{props:{id:'1'},global:context.global});await w.find('button').trigger('click');context.auth.factoryId='OTHER';context.auth.revision++;await flushPromises();release(path);await flushPromises()
  expect(document.body.textContent).not.toContain('同工序');w.unmount()
 })
})
