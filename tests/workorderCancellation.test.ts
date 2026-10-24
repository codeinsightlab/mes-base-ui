import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus, { ElMessageBox } from 'element-plus'
import Panel from '../src/components/business/production/WorkOrderCancellation.vue'
import { useAuth } from '../src/stores/auth'
import type { Order } from '../src/api/production/workorder'
const calls = vi.hoisted(() => ({ cancel: vi.fn(), cancellation: vi.fn() }))
vi.mock('../src/api/production/workorder', () => ({ api: calls }))
let wrapper:any
const order = { id: '9007199254740999', source: null, status: 'RELEASED', revision: 7 } as Order
beforeEach(() => { sessionStorage.clear();vi.clearAllMocks();vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue(undefined as never);calls.cancel.mockResolvedValue({ cancellationId: 'saved' });calls.cancellation.mockResolvedValue({ cancelledBy: '100', cancelledAt: '2026-10-17', reason: 'TEST', previousStatus: 'RELEASED' }) })
afterEach(() => { wrapper?.unmount();document.body.innerHTML = '';vi.restoreAllMocks() })
async function setup(allowed = true, row = order) { const pinia = createPinia(), auth = useAuth(pinia);auth.factoryId = 'SIMPLE_B';auth.runtimeMode = 'LOCAL';auth.username = 'admin';auth.factoryPermissions = ['workorder:query', ...(allowed ? ['production:workorder:cancel'] : [])];wrapper = mount(Panel, { props: { order: row, history: true }, global: { plugins: [pinia, ElementPlus] }});await flushPromises();return { auth, s: (wrapper.vm.$ as any).setupState } }
it('allows unknown-source cancellation only with dedicated permission and server-owned fields omitted', async() => { const { s } = await setup();s.reason = 'TEST stop future';await s.execute();expect(calls.cancel).toHaveBeenCalledWith(order.id, { requestId: expect.any(String), reason: 'TEST stop future', expectedRevision: 7 });expect(ElMessageBox.confirm).toHaveBeenCalledOnce();expect(wrapper.emitted('changed')).toHaveLength(1) })
it('does not let ordinary edit permission cancel', async() => { const { s } = await setup(false);s.reason = 'TEST';await s.execute();expect(calls.cancel).not.toHaveBeenCalled() })
it('requires a reason and does not cancel EXTERNAL data', async() => { const { s } = await setup();await s.execute();expect(calls.cancel).not.toHaveBeenCalled();await wrapper.setProps({ order: { ...order, source: 'EXTERNAL' }});s.reason = 'TEST';await s.execute();expect(calls.cancel).not.toHaveBeenCalled() })
it('restores UNKNOWN across close/remount with the same UUID and frozen reason', async() => { calls.cancel.mockRejectedValueOnce(new Error('lost'));let { s } = await setup();s.reason = 'TEST original';await s.execute();const frozen = structuredClone(calls.cancel.mock.calls[0]![1]);s.visible = false;wrapper.unmount();({ s } = await setup());s.reason = 'changed';await s.execute();expect(calls.cancel.mock.calls[1]).toEqual([order.id, frozen]);expect(ElMessageBox.confirm).toHaveBeenCalledOnce() })
it.each(['factory', 'permission'])('drops late results on %s change without a new intent', async mode => { const { s, auth } = await setup();let done!:(x:unknown) => void;calls.cancel.mockImplementationOnce(() => new Promise(r => done = r));s.reason = 'TEST';const task = s.execute();await flushPromises();if (mode === 'factory')auth.factoryId = 'B';else auth.factoryPermissions = [];done({});await task;expect(wrapper.emitted('changed')).toBeUndefined();expect(s.visible).toBe(false);expect(calls.cancel).toHaveBeenCalledOnce() })
it('shows cancellation fact and original status without new cancel action', async() => { await setup(true, { ...order, status: 'CANCELLED' });expect(wrapper.text()).toContain('所属工单已作废');expect(wrapper.text()).toContain('RELEASED');expect(wrapper.text()).not.toContain('作废工单') })
