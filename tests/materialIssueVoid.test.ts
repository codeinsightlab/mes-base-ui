import { beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus, { ElMessageBox } from 'element-plus'
import { useAuth } from '../src/stores/auth'
import Action from '../src/components/business/MaterialIssueVoidAction.vue'
const cancel = vi.hoisted(() => vi.fn())
vi.mock('../src/api/wm/stockDocuments', () => ({ stockDocuments: { voidMaterialIssue: cancel } }))
beforeEach(() => { vi.clearAllMocks();vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue(undefined as never);cancel.mockResolvedValue({ documentId: '9007199254740993', documentStatus: 'POSTED', productionInputStatus: 'VOIDED', voidOperationId: 'op-1', voidResultStatus: 'SUCCEEDED', voidRequestedAt: null, voidFinishedAt: null, message: '已撤销' }) })
function setup(status = 'POSTED', permission = true) {
  const pinia = createPinia(), auth = useAuth(pinia);auth.factoryId = 'A';auth.runtimeMode = 'LOCAL';auth.factoryPermissions = permission ? ['business:mes:material:issue:void'] : []
  const refresh = vi.fn().mockResolvedValue(undefined)
  const wrapper = mount(Action, { props: { row: { id: '9007199254740993', status }, refresh, dirty: false }, global: { plugins: [pinia, ElementPlus] }})
  return { wrapper, auth, refresh }
}
it('requires the separate void permission and a posted document', () => { const first = setup('POSTED', false);expect(first.wrapper.find('button').exists()).toBe(false);first.wrapper.unmount();const second = setup('DRAFT');expect(second.wrapper.find('button').exists()).toBe(false);second.wrapper.unmount() })
it('voids by document identity and refreshes', async() => { const { wrapper, refresh } = setup();await wrapper.findAll('button')[0]!.trigger('click');await flushPromises();expect(cancel).toHaveBeenCalledWith('9007199254740993', false);expect(refresh).toHaveBeenCalledOnce();wrapper.unmount() })
it('uses the same document for recovery of the original void', async() => { const { wrapper } = setup();await wrapper.findAll('button')[1]!.trigger('click');await flushPromises();expect(cancel).toHaveBeenCalledWith('9007199254740993', true);wrapper.unmount() })
it('rejects a late result after factory or document changes', async() => { let release!: (x:unknown) => void;cancel.mockImplementationOnce(() => new Promise(r => release = r));const { wrapper, auth, refresh } = setup();await wrapper.find('button').trigger('click');await flushPromises();auth.factoryId = 'B';auth.revision++;release({ documentId: '9007199254740993', documentStatus: 'POSTED', productionInputStatus: 'VOIDED' });await flushPromises();expect(refresh).not.toHaveBeenCalled();wrapper.unmount() })
it('does not send an action while the document has unsaved changes', async() => { const { wrapper } = setup();await wrapper.setProps({ dirty: true });expect(wrapper.find('button').attributes('disabled')).toBeDefined();expect(cancel).not.toHaveBeenCalled();wrapper.unmount() })

it('shows explicit production and void results without inferring them from document status', async() => { const { wrapper } = setup();cancel.mockResolvedValueOnce({ documentId: '9007199254740993', documentStatus: 'POSTED', productionInputStatus: 'VOID_PENDING', voidOperationId: 'op-2', voidResultStatus: null, voidRequestedAt: null, voidFinishedAt: null, message: '待核实' });await wrapper.find('button').trigger('click');await flushPromises();expect(wrapper.text()).toContain('VOID_PENDING');expect(wrapper.text()).toContain('待确认');expect(wrapper.text()).toContain('op-2');wrapper.unmount() })
