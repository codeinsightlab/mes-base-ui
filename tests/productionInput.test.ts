import { invalidateQuantityRules } from '../src/lib/production/quantityRuleInvalidation'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import Input from '../src/views/production/productionInput/index.vue'
import PageDialog from '../src/components/page/PageDialog.vue'
import { useAuth } from '../src/stores/auth'
import { ApiError } from '../src/lib/request'
const rules = vi.hoisted(() => ({ material: vi.fn(), unit: vi.fn() }))
vi.mock('../src/api/basic/material', () => ({ api: { detail: rules.material }}))
vi.mock('../src/api/basic/unitMeasure', () => ({ api: { detail: rules.unit }}))
const { calculate, preview, submit, resolve } = vi.hoisted(() => ({ calculate: vi.fn(), preview: vi.fn(), submit: vi.fn(), resolve: vi.fn() }))
vi.mock('../src/api/production/productionInput', () => ({ inputPermission: 'business:mes:material:issue:update', productionInput: { preview, submit }}))
vi.mock('../src/api/production/productionCombination', () => ({ productionCombination: { calculate, resolve }}))
const definition = { routing: { id: '7', code: 'R1', name: '加工', version: 2 }, products: [], nodes: [{ id: '11', nodeCode: 'A', operationId: '1', operationName: '钻孔', isKey: false }], edges: [] }
const combination = { code: 'WO1:B#B01$C#C01', workorderId: '1', workorderCode: 'WO1', productId: '2', closed: false, executionCode: null, items: [{ demandLineId: '1', lineNo: 1, materialCode: 'B', batches: ['B01'] }, { demandLineId: '2', lineNo: 2, materialCode: 'C', batches: ['C01'] }] }
const calculation = { combination, maximumQty: '100', outputQty: '100.000000', allocations: [{ demandLineId: '1', materialId: 'B', batchNo: 'B01', warehouseId: '1', quantity: '200' }], calculationKey: 'freeze-1' }
type State = { code: string; quantity: string; selected: string[]; calculation: unknown; pending: { requestId: string } | null; query: (defaultMaximum?: boolean) => Promise<void>; submit: () => Promise<void> }
let wrapper: ReturnType<typeof mount>
beforeEach(() => {
  sessionStorage.clear()
  vi.resetAllMocks()
  invalidateQuantityRules()
  rules.material.mockResolvedValue({ unitId: 'u' })
  rules.unit.mockResolvedValue({ mustBeWholeNumber: 0, quantityPrecision: 6, name: '件' })
  vi.stubGlobal('ResizeObserver', class {
    observe() {} unobserve() {} disconnect() {}
  })
  resolve.mockResolvedValue(combination)
  calculate.mockResolvedValue(calculation)
  preview.mockResolvedValue({ definition, actual: null })
  submit.mockResolvedValue({ requestId: 'r', documentId: '902', executionCode: combination.code, code: combination.code, status: 'POSTED', confirmedInputQty: '100', stockApplied: true })
})
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
})

async function setup() {
  const pinia = createPinia(), auth = useAuth(pinia)
  auth.factoryId = 'A'
  auth.runtimeMode = 'LOCAL'
  auth.factoryPermissions = ['business:material:query', 'business:unit:measure:query', 'business:mes:material:issue:update']
  wrapper = mount(Input, { global: { plugins: [pinia, ElementPlus], stubs: { RoutingGraphPreview: true }}})
  const s = wrapper.vm as unknown as State
  s.code = combination.code
  await s.query()
  await flushPromises()
  return { s, auth }
}

it('defaults to current maximum, displays fixed multi-material batches and performs no write while reading', async() => {
  const { s } = await setup()
  expect(s.quantity).toBe('100')
  expect(calculate).toHaveBeenCalledWith(combination.code, undefined)
  expect(wrapper.text()).toContain('B01')
  expect(wrapper.text()).toContain('C01')
  expect(submit).not.toHaveBeenCalled()
})
it('requires recalculation after a quantity edit and posts the chosen sets without material edits', async() => {
  const { s } = await setup()
  s.quantity = '50'
  await flushPromises()
  await s.submit()
  expect(submit).not.toHaveBeenCalled()
  calculate.mockResolvedValueOnce({ ...calculation, outputQty: '50', allocations: [{ ...calculation.allocations[0], quantity: '100' }] })
  await s.query(false)
  s.selected = ['11']
  await flushPromises()
  await s.submit()
  expect(submit.mock.calls[0]![0]).toMatchObject({ code: combination.code, outputQty: '50', routingNodeIds: ['11'], calculationKey: 'freeze-1' })
  expect(submit.mock.calls[0]![0]).not.toHaveProperty('stockReference')
  expect(wrapper.text()).toContain('领料成功')
})
it('retries an uncertain result with exactly the same request and clears it only after POSTED', async() => {
  const { s } = await setup()
  submit.mockRejectedValueOnce(new Error('网络断开'))
  await s.submit()
  const original = JSON.parse(JSON.stringify(submit.mock.calls[0]![0]))
  expect(s.pending?.requestId).toBe(original.requestId)
  await s.submit()
  expect(submit.mock.calls[1]![0]).toEqual(original)
  expect(s.pending).toBeNull()
})
it('shows the latest stock limit and requires a fresh confirmation after a definite rejection', async() => {
  const { s } = await setup()
  submit.mockRejectedValueOnce(new ApiError('PRODUCTION_COMBINATION_STOCK_CHANGED', '库存变化', '', 409, '40'))
  await s.submit()
  expect(s.pending).toBeNull()
  expect(s.calculation).toBeNull()
  expect(wrapper.text()).toContain('40 套')
})
it.each(['factory', 'permission', 'mode'])('clears state and rejects late reads after %s changes', async(kind) => {
  const { s, auth } = await setup()
  let release!: (value: unknown) => void
  calculate.mockImplementationOnce(() => new Promise(resolve => {
    release = resolve
  }))
  const read = s.query()
  await flushPromises()
  if (kind === 'factory') auth.factoryId = 'B'
  else if (kind === 'mode') auth.runtimeMode = 'ERP'
  else auth.factoryPermissions = []
  await flushPromises()
  release(calculation)
  await read
  expect(s.calculation).toBeNull()
  expect(s.code).toBe('')
  expect(submit).not.toHaveBeenCalled()
})
it('keeps fixed material facts visible when the independent path read fails', async() => {
  preview.mockRejectedValueOnce(new Error('工艺读取失败'))
  await setup()
  expect(wrapper.text()).toContain('B01')
  expect(wrapper.text()).toContain('工艺读取失败')
  expect(submit).not.toHaveBeenCalled()
})

it('keeps raw combination facts readable when stock calculation fails', async() => {
  calculate.mockRejectedValueOnce(new ApiError('RESOURCE_CONFLICT', '库存待核对', '', 409))
  await setup()
  expect(wrapper.text()).toContain('B01')
  expect(wrapper.text()).toContain('待重新计算')
  expect(submit).not.toHaveBeenCalled()
})

it('confirms a no-routing workorder without inventing a path and explains direct finished-goods receipt', async() => {
  preview.mockResolvedValueOnce({ definition: null, actual: null })
  const { s } = await setup()
  s.selected = []
  await flushPromises()
  expect(wrapper.text()).toContain('此工单无工艺')
  await s.submit()
  expect(submit).toHaveBeenCalledOnce()
  expect(submit.mock.calls[0]![0]).toMatchObject({ routingId: null, routingNodeIds: [], outputQty: '100' })
  expect(wrapper.text()).toContain('领料成功')
})

it('automatically supplies the full straight path and uses the shared quantity input with its unit', async() => {
  const { s } = await setup()
  expect(s.selected).toEqual(['11'])
  expect(wrapper.text()).toContain('件')
  expect(wrapper.findComponent({ name: 'QuantityInput' }).props('showUnit')).toBe(true)
  expect(wrapper.text()).not.toContain('加入路径')
  await s.submit()
  expect(submit.mock.calls[0]![0]).toMatchObject({ routingId: '7', routingNodeIds: ['11'] })
})
it('opens the full routing graph in a dialog without expanding the input panel', async() => {
  await setup()
  expect(wrapper.text()).toContain('查看完整工艺图')
  expect(wrapper.find('.el-collapse').exists()).toBe(false)
  await wrapper.find('.graph-open').trigger('click')
  await flushPromises()
  expect((wrapper.vm as unknown as State & { graphVisible: boolean }).graphVisible).toBe(true)
  expect(wrapper.findComponent(PageDialog).exists()).toBe(true)
})
it('waits only at a fork and automatically continues after the chosen branch', async() => {
  const node = (id: string) => ({ ...definition.nodes[0]!, id, nodeCode: id, operationName: id })
  preview.mockResolvedValue({ definition: { ...definition, nodes: ['A', 'B', 'C', 'D'].map(node), edges: [
    { fromNodeCode: 'A', toNodeCode: 'B' }, { fromNodeCode: 'A', toNodeCode: 'C' },
    { fromNodeCode: 'B', toNodeCode: 'D' }, { fromNodeCode: 'C', toNodeCode: 'D' }
  ] }, actual: null })
  const { s } = await setup()
  expect(s.selected).toEqual(['A'])
  await s.submit()
  expect(submit).not.toHaveBeenCalled()
  await wrapper.findAll('button').find(button => button.text() === 'B · B')!.trigger('click')
  expect(s.selected).toEqual(['A', 'B', 'D'])
  await s.query(false)
  await flushPromises()
  expect(s.selected).toEqual(['A', 'B', 'D'])
  await s.submit()
  expect(submit.mock.calls[0]![0].routingNodeIds).toEqual(['A', 'B', 'D'])
})
it('preserves the existing execution path instead of selecting a new branch', async() => {
  preview.mockResolvedValue({ definition, actual: { selectedNodeIds: ['11'] }})
  const { s } = await setup()
  expect(s.selected).toEqual(['11'])
  expect(wrapper.text()).toContain('沿用已有路径')
  expect(wrapper.find('[aria-label="选择工艺分支"]').exists()).toBe(false)
})
it('prevents submission for a closed execution even when a complete path and calculation were read', async() => {
  resolve.mockResolvedValue({ ...combination, closed: true })
  const { s } = await setup()
  await s.submit()
  expect(submit).not.toHaveBeenCalled()
})
