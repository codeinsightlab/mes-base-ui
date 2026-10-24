import { beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import { useAuth } from '../src/stores/auth'
import Action from '../src/components/business/MaterialIssueErpAction.vue'
const calls = vi.hoisted(() => ({ query: vi.fn(), reconcile: vi.fn() }))
vi.mock('../src/api/issue/mesMaterialIssue', () => ({ queryIssueErp: calls.query, reconcileIssueErp: calls.reconcile }))
const result = { result: { outcome: 'UNKNOWN', executionMode: 'CONNECTED', documentStatus: 'UNKNOWN', externalCode: 'ERP-1', message: 'ERP结果不确定' }, lastOutcome: 'UNKNOWN', lastMessage: '请人工核实' }
beforeEach(() => { vi.clearAllMocks(); calls.query.mockResolvedValue(result); calls.reconcile.mockResolvedValue(result) })
function setup(permissions = ['query', 'reconcile']) {
  const pinia = createPinia(), auth = useAuth(pinia)
  auth.factoryId = 'A'; auth.factoryPermissions = permissions.map(p => 'business:mes:material:issue:erp:' + p)
  const refresh = vi.fn().mockResolvedValue(undefined)
  const wrapper = mount(Action, { props: { row: { id: '9007199254740993', status: 'RECORDED' }, refresh, dirty: false }, global: { plugins: [pinia, ElementPlus] }})
  return { wrapper, auth, refresh }
}
it('uses independent query and reconcile permissions', () => { const { wrapper } = setup(['query']); expect(wrapper.findAll('button')).toHaveLength(1); expect(wrapper.text()).toContain('查询 ERP 状态'); wrapper.unmount() })
it('queries read-only, displays source and uncertainty without refresh or editable status', async() => { const { wrapper, refresh } = setup(); await wrapper.findAll('button')[0]!.trigger('click'); await flushPromises(); expect(calls.query).toHaveBeenCalledWith('9007199254740993'); expect(refresh).not.toHaveBeenCalled(); expect(wrapper.text()).toContain('CONNECTED'); expect(wrapper.text()).toContain('ERP-1'); expect(wrapper.text()).toContain('UNKNOWN'); expect(wrapper.find('input').exists()).toBe(false); wrapper.unmount() })
it('reconciles and refreshes once, never creates an external document', async() => { const { wrapper, refresh } = setup(); await wrapper.findAll('button')[1]!.trigger('click'); await flushPromises(); expect(calls.reconcile).toHaveBeenCalledOnce(); expect(refresh).toHaveBeenCalledOnce(); wrapper.unmount() })
it('clears and rejects late responses after factory change or permission revocation', async() => { let release!: (value: unknown) => void; calls.query.mockImplementationOnce(() => new Promise(resolve => { release = resolve })); const { wrapper, auth, refresh } = setup(); await wrapper.findAll('button')[0]!.trigger('click'); await flushPromises(); auth.factoryId = 'B'; auth.revision++; await flushPromises(); release(result); await flushPromises(); expect(wrapper.find('[role="status"]').exists()).toBe(false); expect(refresh).not.toHaveBeenCalled(); auth.factoryPermissions = []; await flushPromises(); expect(wrapper.find('button').exists()).toBe(false); wrapper.unmount() })
it('clears a previous document result and blocks actions for dirty forms', async() => { const { wrapper } = setup(); await wrapper.findAll('button')[0]!.trigger('click'); await flushPromises(); await wrapper.setProps({ row: { id: '2' }, dirty: true }); expect(wrapper.find('[role="status"]').exists()).toBe(false); expect(wrapper.find('button').attributes('disabled')).toBeDefined(); wrapper.unmount() })
