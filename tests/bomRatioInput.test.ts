import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import QuantityInput from '../src/components/business/material/QuantityInput.vue'
import { invalidateQuantityRules } from '../src/lib/production/quantityRuleInvalidation'
import { bomRatio } from '../src/lib/bomRatio'
import { useAuth } from '../src/stores/auth'
const calls = vi.hoisted(() => ({ material: vi.fn(), unit: vi.fn() }))
vi.mock('../src/api/basic/material', () => ({ api: { detail: calls.material }}))
vi.mock('../src/api/basic/unitMeasure', () => ({ api: { detail: calls.unit }}))
const wrappers: ReturnType<typeof mount>[] = []
beforeEach(() => {
  invalidateQuantityRules()
  calls.material.mockReset().mockImplementation(async id => ({ unitId: id }))
  calls.unit.mockReset().mockImplementation(async id => ({ name: id, mustBeWholeNumber: 1, quantityPrecision: 0 }))
})
afterEach(() => wrappers.splice(0).forEach(w => w.unmount()))
function setup() {
  const pinia = createPinia(), auth = useAuth(pinia)
  auth.factoryId = 'F1'; auth.factoryPermissions = ['business:material:query', 'business:unit:measure:query']
  const w = mount(QuantityInput, { props: { semantic: 'bom-ratio', showUnit: true, modelValue: '0.5', materialId: 'A' }, global: { plugins: [pinia, ElementPlus] }})
  wrappers.push(w); return w
}
it('allows fractional BOM ratios for whole-number units without rewriting stored values', async() => {
  const w = setup(); await flushPromises()
  expect(w.text()).toContain('A'); expect(w.emitted('validity')?.at(-1)).toEqual([true])
  await w.setProps({ modelValue: '99999999999999.123456' })
  expect(w.get('input').element.value).toBe('99999999999999.123456')
  expect(w.emitted('update:modelValue')).toBeUndefined()
})
it('clears the old unit and rejects late responses when changing material', async() => {
  let release!: (value: unknown) => void
  calls.unit.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
  const w = setup(); await flushPromises()
  await w.setProps({ materialId: 'B' }); await flushPromises()
  expect(w.text()).toContain('B')
  release({ name: 'OLD' }); await flushPromises()
  expect(w.text()).not.toContain('OLD')
})
it('shows a failed unit read and permits retry', async() => {
  calls.unit.mockRejectedValueOnce(Error('单位失败'))
  const w = setup(); await flushPromises()
  expect(w.get('input').attributes('disabled')).toBeDefined()
  expect(w.text()).toContain('单位失败')
  await w.get('button').trigger('click'); await flushPromises()
  expect(w.text()).toContain('A'); expect(w.get('input').attributes('disabled')).toBeUndefined()
})
it.each(['0', '-1', '1e2', '100000000000000', '0.0000001'])('rejects invalid ratio %s', value => expect(() => bomRatio(value)).toThrow())
it('preserves decimal precision without Number conversion', () => expect(bomRatio('99999999999999.123456')).toBe('99999999999999.123456'))
it('does not apply physical quantity exemptions to BOM ratios', async() => {
  const w = setup(); await flushPromises()
  await w.setProps({ modelValue: '0.1234567', unchangedValue: '0.1234567', remainderValue: '0.1234567', historicalReduction: true })
  expect(w.emitted('validity')?.at(-1)).toEqual([false])
  await w.setProps({ modelValue: '-0.5' })
  expect(w.emitted('validity')?.at(-1)).toEqual([false])
})
