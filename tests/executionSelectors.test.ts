import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import ExecutionSelect from '../src/components/business/production/ExecutionSelect.vue'
import ProductionExecutionSelect from '../src/components/business/production/ProductionExecutionSelect.vue'
import { fields } from '../src/views/production/mesProductionExecution/fields'
import { useAuth } from '../src/stores/auth'
const list = vi.hoisted(() => vi.fn())
vi.mock('../src/api/production/mesProductionExecution', () => ({ api: { list }}))
let wrapper:ReturnType<typeof mount>
beforeEach(() => { list.mockReset().mockResolvedValue({ items: [{ id: '9007199254740999', executionCode: 'WO1:M1#LOT1', workorderId: '7', status: 'RUNNING' }], total: 1 }) })
afterEach(() => wrapper?.unmount())
it.each([ExecutionSelect, ProductionExecutionSelect])('queries exact string codes and renders one canonical execution identity', async component => {
  const pinia = createPinia(), auth = useAuth(pinia);auth.factoryId = 'A';auth.factoryPermissions = ['business:mes:production:execution:list']
  wrapper = mount(component, { global: { plugins: [pinia, ElementPlus] }})
  const state = (wrapper.vm.$ as unknown as { setupState: Record<string, any> }).setupState
  await state.search('WO1:M1#LOT1');await flushPromises()
  expect(list.mock.calls[0]![0].executionCode).toBe('WO1:M1#LOT1')
  expect(Object.keys(list.mock.calls[0]![0])).not.toContain('executionNo')
  expect(state.options[0].executionCode).toBe('WO1:M1#LOT1')
  const label = wrapper.findComponent({ name: 'ElOption' }).props('label')
  expect(label).toContain('WO1:M1#LOT1');expect(label.split('WO1:M1#LOT1')).toHaveLength(2)
  list.mockClear();await state.search('WO1:M1#LOT2');await flushPromises();expect(list.mock.calls[0]![0].executionCode).toBe('WO1:M1#LOT2')
})
it('keeps one searchable execution code field without a duplicate execution number', () => {
  expect(fields.filter(field => field.key === 'executionCode')).toHaveLength(1)
  expect(fields.find(field => field.key === 'executionCode')?.searchable).toBe(true)
  expect(fields.some(field => field.key === 'executionNo')).toBe(false)
})

it('offers only running executions for a new production receipt and clears stale choices after factory changes', async() => {
  const pinia = createPinia(), auth = useAuth(pinia);auth.factoryId = 'A';auth.factoryPermissions = ['business:mes:production:execution:list']
  list.mockResolvedValueOnce({ items: [{ id: '1', status: 'READY' }, { id: '2', status: 'RUNNING' }, { id: '3', status: 'FULLY_RECEIVED' }, { id: '4', status: 'CANCELLED' }, { id: '5', status: 'UNRECOGNIZED' }], total: 5 })
  wrapper = mount(ProductionExecutionSelect, { props: { statuses: ['RUNNING'] }, global: { plugins: [pinia, ElementPlus] }})
  const state = (wrapper.vm.$ as unknown as { setupState: Record<string, any> }).setupState
  await state.search();await flushPromises()
  expect(state.options.map((row:any) => row.id)).toEqual(['2'])
  auth.factoryId = 'B';auth.revision++;await flushPromises()
  expect(state.options).toEqual([])
})
