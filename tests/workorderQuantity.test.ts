import { expect, it } from 'vitest'
import { displayQuantity } from '../src/views/production/workorder/quantity'

it.each([
  ['8340.000000', '8340'], ['0.000000', '0'], ['12.100000', '12.1'],
  ['12.345000', '12.345'], ['99.999999', '99.999999'],
  ['99999999999999.994999', '99999999999999.994999'],
  ['99999999999999.995000', '99999999999999.995'],
  ['0.000001', '0.000001'], ['-0.000001', '-0.000001'],
  ['-12.345000', '-12.345'], [null, '—'], ['', '—']
] as const)('displays %s as %s without converting decimals to floating point', (input, expected) => {
  expect(displayQuantity(input)).toBe(expected)
})
