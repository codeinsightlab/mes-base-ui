import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import type { Component } from 'vue'
import { createPinia } from 'pinia'
import { useAuth } from '../src/stores/auth'
import { ApiError } from '../src/lib/request'
import Panel from '../src/components/business/quality/DefectDeclarationPanel.vue'
import Types from '../src/components/business/quality/OperationDefectTypePanel.vue'
import Statistics from '../src/components/business/quality/DefectStatisticsPanel.vue'
const api = vi.hoisted(() => ({ context: vi.fn(), nodes: vi.fn(), declare: vi.fn(), request: vi.fn(), types: vi.fn(), createType: vi.fn(), updateType: vi.fn(), deleteType: vi.fn(), statistics: vi.fn() }))
vi.mock('../src/api/quality/qualityV2', () => ({ qualityV2: api, wasteLabels: { PROCESS: '工废', MATERIAL: '料废', BOTH: '工废＋料废' }}))
const type = { id: '9007199254740999', operationId: '1', code: 'S', name: '划伤', defaultWasteCategory: 'BOTH', status: 'ENABLED', sort: 0, remark: null, revision: 4 }
const context = { executionId: '1', nodeId: '12', operationId: '1', operationName: '车削', productId: '7', productCode: 'P7', productName: '产品七', types: [type], typeTotal: 1, offset: 0, limit: 100, canOverrideWasteCategory: false }
let wrapper:ReturnType<typeof mount>
beforeEach(() => { vi.resetAllMocks();sessionStorage.clear();vi.stubGlobal('ResizeObserver', class {observe() {}unobserve() {}disconnect() {}});api.context.mockResolvedValue(context);api.nodes.mockResolvedValue([{ id: '12', name: '车削', sequenceNo: 2 }]);api.declare.mockResolvedValue({ record: { declarationId: 'd1' }});api.types.mockResolvedValue({ items: [type], total: 1 });api.statistics.mockResolvedValue({ items: [], total: 0 }) })
afterEach(() => { wrapper?.unmount();document.body.innerHTML = '';vi.unstubAllGlobals() })
async function setup(component: Component = Panel, permissions = ['business:quality:defect:create']) { const pinia = createPinia(), auth = useAuth(pinia);auth.username = 'tester';auth.factoryId = 'A';auth.factoryPermissions = permissions;wrapper = mount(component, { props: component === Types ? { operationId: '1' } : { executionId: '1', nodeId: '12' }, global: { plugins: [pinia, ElementPlus], stubs: { ExecutionSelect: true }}});await flushPromises();const s = (wrapper.vm.$ as unknown as { setupState: Record<string, any> }).setupState;return { s, auth } }
it('derives product and operation from context, freezes default waste category and exact string IDs', async() => { const { s } = await setup();s.type = type.id;s.changeType();s.quantity = '1.01';await s.submit();const body = api.declare.mock.calls[0]![0];expect(body.wasteCategory).toBe('BOTH');expect(body.defectTypeId).toBe('9007199254740999');expect(body.expectedTypeRevision).toBe(4);expect(body.quantity).toBe('1.01');expect(body).not.toHaveProperty('operationId');expect(body).not.toHaveProperty('productId');expect(body).not.toHaveProperty('assessment');expect(wrapper.text()).toContain('产品七');expect(wrapper.text()).toContain('车削') })
it('keeps the complete original intention after timeout, remount and rejected retry', async() => { const { s } = await setup();s.type = type.id;s.changeType();s.quantity = '2';api.declare.mockRejectedValueOnce(new Error('timeout'));await s.submit();const original = JSON.parse(JSON.stringify(api.declare.mock.calls[0]![0]));wrapper.unmount();const { s: again } = await setup();expect(again.pending).toEqual(original);api.declare.mockRejectedValueOnce(new ApiError('FORBIDDEN', '无权', '', 403));await again.submit();expect(again.pending).toEqual(original);expect(api.declare.mock.calls[1]![0]).toEqual(original);api.request.mockResolvedValueOnce({ declarationId: 'd1' });await again.recover();expect(again.pending).toBeNull();expect(sessionStorage.length).toBe(0) })
it('does not replace an unknown intention when the original is not visible yet', async() => { const { s } = await setup();s.type = type.id;s.changeType();s.quantity = '2';api.declare.mockRejectedValueOnce(new Error('lost'));await s.submit();const id = s.pending.requestId;api.request.mockRejectedValueOnce(new ApiError('NOT_FOUND', '未找到', '', 404));await s.recover();expect(s.pending.requestId).toBe(id);expect(wrapper.text()).toContain('使用原请求重试') })
it('clears state on factory change and rejects a late context response', async() => { let resolve!:(v:unknown) => void;api.context.mockImplementationOnce(() => new Promise(r => { resolve = r }));const { s, auth } = await setup();auth.factoryId = 'B';await flushPromises();resolve({ ...context, productName: '旧工厂名称' });await flushPromises();expect(wrapper.text()).not.toContain('旧工厂名称');expect(s.context?.productName).toBe('产品七') })
it('does not submit without create permission', async() => { const { s } = await setup(Panel, []);s.quantity = '1';await s.submit();expect(api.declare).not.toHaveBeenCalled() })
it('preserves parent identity and revision on type updates and offers explicit default selection', async() => { const { s } = await setup(Types, ['business:operation:defect:type:read', 'business:operation:defect:type:update']);s.begin(type);s.form.name = '划伤变更';await s.save();expect(api.updateType).toHaveBeenCalledWith('1', type.id, expect.objectContaining({ expectedRevision: 4, defaultWasteCategory: 'BOTH' }));expect(api.updateType.mock.calls[0]![2]).not.toHaveProperty('operationId') })
it('queries server statistics rather than summing visible declaration pages', async() => { const { s } = await setup(Statistics, ['business:quality:defect:read']);s.category = 'PROCESS';s.attribution = 'UNVERIFIED';await s.load();expect(api.statistics).toHaveBeenCalledWith(expect.objectContaining({ executionId: '1', wasteCategory: 'PROCESS', attribution: 'UNVERIFIED', limit: 20 }));expect(wrapper.text()).toContain('统计使用独立筛选条件') })

it('blocks new submission when the saved intention is corrupted instead of silently replacing it', async() => {
  sessionStorage.setItem('mes-quality-v2-pending:tester:A', '{broken')
  const { s } = await setup()
  s.type = type.id;s.changeType();s.quantity = '1'
  await s.submit()
  expect(api.declare).not.toHaveBeenCalled()
  expect(wrapper.text()).toContain('原请求无法读取')
})

it('clears an unknown intention from the visible page when permission is revoked while preserving recovery storage', async() => {
  const { s, auth } = await setup()
  s.type = type.id;s.changeType();s.quantity = '2'
  api.declare.mockRejectedValueOnce(new Error('timeout'))
  await s.submit()
  expect(s.pending).not.toBeNull()
  auth.factoryPermissions = []
  await flushPromises()
  expect(s.pending).toBeNull()
  expect(sessionStorage.length).toBe(1)
  await s.recover()
  expect(api.request).not.toHaveBeenCalled()
})

it('blocks pending payloads from the withdrawn cost model without converting categories', async() => { sessionStorage.setItem('mes-quality-v2-pending:tester:A', JSON.stringify({ requestId: crypto.randomUUID(), executionId: '1', nodeId: '12', defectTypeId: type.id, expectedTypeRevision: 4, quantity: '1', costCategory: 'LABOR', occurredAt: '2026-01-01T10:00:00' }));const { s } = await setup();expect(s.recoveryBlocked).toBe(true);await s.submit();expect(api.declare).not.toHaveBeenCalled();expect(sessionStorage.getItem('mes-quality-v2-pending:tester:A')).toContain('costCategory') })
