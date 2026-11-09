import { expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import QuantityText from '../src/components/business/production/QuantityText.vue'
import { formatQuantity, quantityColumn } from '../src/lib/quantity'

it.each([
  ['2.0000', '2'],
  ['2.0030', '2.003'],
  ['0.0500', '0.05'],
  ['12.3400', '12.34'],
  ['0.0000', '0'],
  ['123.456700', '123.4567'],
  ['2.00001', '2.00001'],
  ['-12.3400', '-12.34'],
  ['-0.0500', '-0.05'],
])('formats display quantity %s as %s without rounding', (input, expected) => {
  expect(formatQuantity(input)).toBe(expected)
})

it('keeps existing empty quantity display semantics', () => {
  expect(formatQuantity(null)).toBe('—')
  expect(formatQuantity(undefined)).toBe('—')
  expect(formatQuantity('')).toBe('—')
})

it('preserves high precision decimal strings without converting through Number', () => {
  const raw = '99999999999999.12345678901234567890'

  expect(formatQuantity(raw)).toBe('99999999999999.1234567890123456789')
  expect(raw).toBe('99999999999999.12345678901234567890')
})

it('uses the same display formatter in table columns', () => {
  const vnode = quantityColumn({}, {}, '2.0030')

  expect(vnode.children).toBe('2.003')
})

it('renders display text without emitting model updates', async() => {
  const wrapper = mount(QuantityText, { props: { value: '2.0030' }})

  expect(wrapper.text()).toBe('2.003')
  expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  expect(wrapper.attributes('title')).toBe('2.0030')
})
