import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import ElementPlus from 'element-plus'
import { useAuth } from '../src/stores/auth'
import Graph from '../src/components/business/production/ExecutionRoutePreview.vue'
import Reports from '../src/views/production/productionReport/index.vue'
const { path, summaries } = vi.hoisted(() => ({ path: vi.fn(), summaries: vi.fn() }))
vi.mock('../src/api/production/executionActions', () => ({ executionActions: { path } }))
vi.mock('../src/api/production/productionReport', async original => ({ ...await original<typeof import('../src/api/production/productionReport')>(), productionReport: { workorderQuantities: summaries } }))
const wrappers: ReturnType<typeof mount>[] = []
beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }) })
afterEach(() => { wrappers.forEach(w => w.unmount()); wrappers.length = 0; document.body.innerHTML = '' })
function graphData(state = 'LOCKED', selected = ['11','13']) { return { executionId: '1', executionNo: 'EXE-V2', routingId: '7', routingCode: 'R', routingVersion: 2, pathStatus: state, selectedNodeIds: selected, nodes: ['11','12','13'].map((id, i) => ({ id, nodeCode: ['A','B','C'][i], operationId: '5', operationCode: 'OP', operationName: '工序' + id, required: false })), edges: [{ fromNodeId: '11', toNodeId: '12' }, { fromNodeId: '11', toNodeId: '13' }] } }
async function graphSetup() {
 const pinia = createPinia(), auth = useAuth(pinia); auth.factoryId = 'A'; auth.factoryPermissions = ['business:mes:production:execution:query']
 const wrapper = mount(Graph, { props: { executionId: '1' }, attachTo: document.body, global: { plugins: [pinia, ElementPlus] } }); wrappers.push(wrapper)
 await wrapper.find('button').trigger('click'); await flushPromises(); return { wrapper, auth }
}
it('renders exact version branch edges and highlights only the selected branch without write actions', async() => {
 path.mockResolvedValue(graphData()); await graphSetup()
 expect(document.body.textContent).toContain('EXE-V2'); expect(document.body.textContent).toContain('R / V2')
 expect(document.querySelectorAll('.graph-edge')).toHaveLength(2); expect(document.querySelectorAll('.selected-edge')).toHaveLength(1); expect(document.querySelectorAll('.selected-node')).toHaveLength(2)
 expect(document.body.textContent).not.toContain('保存路径')
})
it('shows an explicit unselected state with no highlighted or invented selected edges', async() => {
 path.mockResolvedValue(graphData('UNSELECTED', [])); await graphSetup()
 expect(document.body.textContent).toContain('尚未选择实际执行路径'); expect(document.querySelectorAll('.selected-node')).toHaveLength(0)
 expect(document.querySelectorAll('.graph-edge')).toHaveLength(2)
})
it('rejects selected nodes outside the exact execution version', async() => {
 path.mockResolvedValue(graphData('SELECTED', ['another-version'])); await graphSetup()
 expect(document.body.textContent).toContain('执行路径与工艺版本数据不完整'); expect(document.querySelector('.graph-preview')).toBeNull()
})
it('clears a route dialog and rejects a late response after a factory switch', async() => {
 let release!: (v: unknown) => void; path.mockImplementationOnce(() => new Promise(r => { release = r }))
 const { auth } = await graphSetup(); auth.factoryId = 'B'; await flushPromises(); release(graphData()); await flushPromises()
 expect(document.body.textContent).not.toContain('EXE-V2')
})
async function pageSetup(query = '') {
 const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/production/productionReport', component: Reports }, { path: '/production/workorder', component: { template: '<p>工单</p>' } }] }); await router.push('/production/productionReport' + query); await router.isReady()
 const pinia = createPinia(), auth = useAuth(pinia); auth.factoryId = 'A'; auth.factoryPermissions = ['business:production:report:quantity']
 const wrapper = mount(Reports, { global: { plugins: [pinia, ElementPlus, router], stubs: { WorkOrderSelect: true, ExecutionSelect: true, ProductionReportManager: { props: ['executionId'], template: '<p>MANAGER {{ executionId }}</p>' } } } }); wrappers.push(wrapper); await flushPromises()
 return { wrapper, auth, state: wrapper.vm as unknown as { workorderId: string | null; executionId: string; selectedId: string; load: () => Promise<void>; select: (id: string) => void } }
}
it('opens a bookmarked execution directly in the independent report page', async() => {
 const { wrapper, state } = await pageSetup('?workorderId=7&executionId=9007199254740993')
 expect(state.selectedId).toBe('9007199254740993'); expect(wrapper.text()).toContain('MANAGER 9007199254740993')
})
it('rejects late workorder summaries and clears the active execution on context change', async() => {
 let release!: (v: unknown) => void; summaries.mockImplementationOnce(() => new Promise(r => { release = r })).mockResolvedValue({ items: [{ executionId:'22', executionNo:'NEW', targetQty:'10' }], total:1 })
 const { wrapper, state, auth } = await pageSetup(); state.workorderId = '7'; const pending = state.load(); state.workorderId = '8'; await state.load()
 release({ items: [{ executionId:'11', executionNo:'OLD' }], total:1 }); await pending; await flushPromises()
 expect(wrapper.text()).toContain('NEW'); expect(wrapper.text()).not.toContain('OLD'); state.select('22'); await flushPromises(); expect(wrapper.text()).toContain('MANAGER 22')
 auth.factoryId = 'B'; await flushPromises(); expect(wrapper.text()).not.toContain('MANAGER'); expect(wrapper.text()).not.toContain('NEW')
})
it('removes the entire quantity view when quantity permission is revoked', async() => {
 const { wrapper, auth } = await pageSetup('?executionId=1'); auth.factoryPermissions = []; await flushPromises()
 expect(wrapper.text()).not.toContain('MANAGER'); expect(wrapper.text()).toContain('没有生产数量查询权限')
})
