// TEST ONLY: mounted panel with real QuantityInput and mocked transport.
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { defineComponent } from 'vue'
import ElementPlus from 'element-plus'
import Panel from '../src/components/business/material/MaterialBomPanel.vue'
import QuantityInput from '../src/components/business/material/QuantityInput.vue'
import { useAuth } from '../src/stores/auth'
import { invalidateQuantityRules } from '../src/lib/production/quantityRuleInvalidation'
const calls = vi.hoisted(() => ({ unit: vi.fn(), structure: vi.fn() }))
vi.mock('../src/api/basic/material', () => ({ api: { detail: async() => ({ unitId: 'U' }) }}))
vi.mock('../src/api/basic/unitMeasure', () => ({ api: { detail: calls.unit }}))
vi.mock('../src/api/basic/materialBom', () => ({ bomApi: {}, bomItemApi: {}, structure: calls.structure, setDefaultBom: vi.fn(), transition: vi.fn() }))
const Document = defineComponent({ template: `<div><slot name="header-actions" :row="{id:'B',status:'DRAFT'}" :refresh="async()=>{}" :dirty="false"/><slot name="field-baseQty" :draft="{baseQty:'0.5'}" :disabled="false"/><slot name="field-quantity" :draft="{materialId:'M',quantity:'0.5'}" :disabled="false"/></div>` })
let w: ReturnType<typeof mount>
beforeEach(() => {
  invalidateQuantityRules();calls.unit.mockReset().mockResolvedValue({ name: '件', mustBeWholeNumber: 1, quantityPrecision: 0 })
  calls.structure.mockReset().mockResolvedValue({ items: [], totals: [] })
})
afterEach(() => w?.unmount())
function setup() {
  const pinia = createPinia(), auth = useAuth(pinia)
  auth.factoryId = 'F';auth.factoryPermissions = ['business:material:query', 'business:unit:measure:query']
  w = mount(Panel, { props: { material: { id: 'M' }, unitNames: {}}, global: { plugins: [pinia, ElementPlus], stubs: { MasterDetailDocument: Document, MaterialPicker: defineComponent({ setup(_, { expose }) { expose({ cancel: () => {} });return () => null } }), BomVersionSelect: true }}})
  return w
}
const button = (name:string) => w.findAll('button').find(b => b.text() === name)!
it.each([{ whole: 1, precision: 0, bad: '0.5', good: '2' }, { whole: 0, precision: 2, bad: '0.123', good: '0.12' }])('guards physical calculation while keeping ratios fractional: %j', async rule => {
  calls.unit.mockResolvedValue({ name: '单位', mustBeWholeNumber: rule.whole, quantityPrecision: rule.precision })
  setup();await flushPromises()
  const ratios = w.findAllComponents(QuantityInput)
  expect(ratios).toHaveLength(2)
  for (const ratio of ratios) expect(ratio.emitted('validity')?.at(-1)).toEqual([true])
  await button('多阶结构与需求').trigger('click');await flushPromises()
  expect(calls.structure).toHaveBeenCalledWith('B', '1')
  const input = w.get('input[aria-label="预计产出数量"]')
  await input.setValue(rule.bad);await flushPromises();calls.structure.mockClear()
  expect(button('计算').attributes('disabled')).toBeDefined()
  await button('计算').trigger('click');expect(calls.structure).not.toHaveBeenCalled()
  await input.setValue(rule.good);await flushPromises()
  await button('计算').trigger('click');await flushPromises()
  expect(calls.structure).toHaveBeenCalledWith('B', rule.good)
})
it('waits for the initial unit read and allows retry after failure before requesting structure', async() => {
  calls.unit.mockRejectedValue(Error('读取失败'))
  setup();await flushPromises()
  await button('多阶结构与需求').trigger('click');await flushPromises()
  expect(calls.structure).not.toHaveBeenCalled();expect(button('计算').attributes('disabled')).toBeDefined()
  calls.unit.mockResolvedValue({ name: '件', mustBeWholeNumber: 1, quantityPrecision: 0 })
  const graph = w.get('section[aria-label="多阶BOM结构与需求"]')
  await graph.findAll('button').find(b => b.text() === '重试')!.trigger('click');await flushPromises()
  expect(calls.structure).toHaveBeenCalledWith('B', '1')
})
