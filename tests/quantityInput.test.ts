import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import QuantityInput from '../src/components/business/material/QuantityInput.vue'
import { useAuth } from '../src/stores/auth'
import { invalidateQuantityRules } from '../src/lib/production/quantityRuleInvalidation'
import { loadQuantityRule, QUANTITY_RULE_TTL_MS } from '../src/lib/production/quantityRules'

const calls = vi.hoisted(() => ({ material: vi.fn(), unit: vi.fn() }))
vi.mock('../src/api/basic/material', () => ({ api: { detail: calls.material } }))
vi.mock('../src/api/basic/unitMeasure', () => ({ api: { detail: calls.unit } }))
const wrappers: ReturnType<typeof mount>[] = []
beforeEach(() => {
  invalidateQuantityRules()
  calls.material.mockReset().mockImplementation(async id => ({ unitId: 'u-' + id }))
  calls.unit.mockReset().mockResolvedValue({ mustBeWholeNumber: 0, quantityPrecision: 2 })
})
afterEach(() => { for (const w of wrappers.splice(0)) w.unmount(); vi.useRealTimers(); document.body.innerHTML = '' })
function setup(props: Record<string, unknown> = {}) {
  const pinia = createPinia(), auth = useAuth(pinia)
  auth.factoryId = 'F1'
  auth.factoryPermissions = ['business:material:query', 'business:unit:measure:query']
  const w = mount(QuantityInput, { props: { modelValue: '1', materialId: 'A', ...props }, global: { plugins: [pinia, ElementPlus] } })
  wrappers.push(w)
  return { w, auth }
}
const valid = (w: ReturnType<typeof mount>) => w.emitted('validity')?.at(-1)?.[0]

it('deduplicates one context but isolates factory and session rule reads', async() => {
  await Promise.all([loadQuantityRule('A', 'F1', 1), loadQuantityRule('A', 'F1', 1)])
  expect(calls.material).toHaveBeenCalledTimes(1)
  await loadQuantityRule('A', 'F2', 1)
  await loadQuantityRule('A', 'F1', 2)
  expect(calls.material).toHaveBeenCalledTimes(3)
})

it('drops a late material response after switching to another material', async() => {
  let release!: (value: unknown) => void
  calls.material.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
  calls.unit.mockImplementation(async id => ({ mustBeWholeNumber: id === 'old' ? 1 : 0, quantityPrecision: 2 }))
  const { w } = setup({ modelValue: '1.2' })
  await w.setProps({ materialId: 'B' }); await flushPromises()
  expect(valid(w)).toBe(true)
  release({ unitId: 'old' }); await flushPromises()
  expect(valid(w)).toBe(true)
  expect(calls.unit).toHaveBeenCalledWith('old')
})

it('fails closed on rule failure and retries without keeping a rejected cache entry', async() => {
  calls.unit.mockRejectedValueOnce(new Error('规则服务不可用'))
  const { w } = setup(); await flushPromises()
  expect(valid(w)).toBe(false); expect(w.text()).toContain('规则服务不可用')
  await w.get('button').trigger('click'); await flushPromises()
  expect(valid(w)).toBe(true); expect(calls.unit).toHaveBeenCalledTimes(2)
})

it.each([
  { mustBeWholeNumber: 2, quantityPrecision: 2 },
  { mustBeWholeNumber: 0, quantityPrecision: null },
  { mustBeWholeNumber: 0, quantityPrecision: 7 }
])('rejects malformed rule payloads instead of guessing defaults: %j', async rule => {
  calls.unit.mockResolvedValue(rule)
  const { w } = setup(); await flushPromises()
  expect(valid(w)).toBe(false); expect(w.text()).toContain('配置无效')
})

it('refreshes an already mounted input when unit or material configuration changes', async() => {
  const { w } = setup({ modelValue: '1.5' }); await flushPromises(); expect(valid(w)).toBe(true)
  calls.unit.mockResolvedValue({ mustBeWholeNumber: 1, quantityPrecision: 6 })
  invalidateQuantityRules()
  expect(valid(w)).toBe(false)
  await flushPromises(); expect(w.text()).toContain('只允许整数'); expect(valid(w)).toBe(false)
  calls.material.mockResolvedValue({ unitId: 'new-unit' })
  calls.unit.mockResolvedValue({ mustBeWholeNumber: 0, quantityPrecision: 6 })
  invalidateQuantityRules(); await flushPromises()
  expect(calls.unit).toHaveBeenLastCalledWith('new-unit'); expect(valid(w)).toBe(true)
})

it('expires a live rule so another client cannot leave it cached indefinitely', async() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
  const { w } = setup({ modelValue: '1.5' }); await flushPromises()
  calls.unit.mockResolvedValue({ mustBeWholeNumber: 1, quantityPrecision: 6 })
  await vi.advanceTimersByTimeAsync(QUANTITY_RULE_TTL_MS + 1); await flushPromises()
  expect(calls.material).toHaveBeenCalledTimes(2); expect(valid(w)).toBe(false)
})

it.each(['factory', 'permission', 'material'])('clears validity synchronously on %s removal and ignores late results', async mode => {
  let release!: (value: unknown) => void
  calls.unit.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
  const { w, auth } = setup(); await flushPromises()
  if (mode === 'factory') auth.factoryId = ''
  else if (mode === 'permission') auth.factoryPermissions = []
  else await w.setProps({ materialId: null })
  release({ mustBeWholeNumber: 0, quantityPrecision: 6 }); await flushPromises()
  expect(valid(w)).toBe(false); expect(w.get('input').attributes('disabled')).toBeDefined()
})

it('preserves continuous input and only strips insignificant zeroes on blur', async() => {
  const { w } = setup({ modelValue: '2.' }); await flushPromises()
  expect(w.get('input').element.value).toBe('2.')
  expect(w.emitted('update:modelValue')).toBeUndefined()
  await w.setProps({ modelValue: '99999999999999.1234560000' })
  await w.get('input').trigger('blur')
  expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['99999999999999.123456'])
})

it('distinguishes optional, required, positive, and signed quantities', async() => {
  const { w } = setup({ modelValue: '' }); await flushPromises(); expect(valid(w)).toBe(true)
  await w.setProps({ required: true }); expect(valid(w)).toBe(false)
  await w.setProps({ modelValue: '-1.5' }); expect(valid(w)).toBe(true)
  await w.setProps({ positive: true }); expect(valid(w)).toBe(false)
  await w.setProps({ modelValue: '0' }); expect(valid(w)).toBe(false)
})

it('allows an unchanged precise stored value but applies current rules to edits', async() => {
  const { w } = setup({ modelValue: '1.234500', unchangedValue: '1.2345', positive: true })
  await flushPromises(); expect(valid(w)).toBe(true)
  await w.setProps({ modelValue: '1.2346' }); expect(valid(w)).toBe(false)
  await w.setProps({ modelValue: '1.2345', unchangedValue: null }); expect(valid(w)).toBe(false)
})
