import { describe, expect, it } from 'vitest'
import { normalizedQuantityInput, positiveQuantity, quantityInputError, type QuantityRule } from '../src/lib/production/quantityRules'

const decimal2: QuantityRule = { mustBeWholeNumber: false, quantityPrecision: 2 }
const whole: QuantityRule = { mustBeWholeNumber: true, quantityPrecision: 6 }

describe('unit based quantity entry rules', () => {
  it('accepts values within precision and insignificant trailing zeroes', () => {
    expect(quantityInputError('1.23', decimal2)).toBeNull()
    expect(quantityInputError('1.230000', decimal2)).toBeNull()
    expect(quantityInputError('1.000', whole)).toBeNull()
    expect(quantityInputError('2.00000000000', whole)).toBeNull()
  })

  it('rejects significant excess decimals and fractions for whole number units', () => {
    expect(quantityInputError('1.2301', decimal2)).toContain('最多允许2位小数')
    expect(quantityInputError('1.5', whole)).toContain('只允许整数')
    expect(quantityInputError('1.1234567', decimal2)).toContain('六位')
  })

  it('compares positive quantities without converting through Number', () => {
    expect(positiveQuantity('0.00000000000000000001')).toBe(true)
    expect(positiveQuantity('0.000000')).toBe(false)
    expect(positiveQuantity('-1')).toBe(false)
  })
})

it.each([
  ['2.00', '2'], ['2.5000', '2.5'], ['1.2300', '1.23'], ['0.000100', '0.0001'],
  ['1.234500', '1.2345'], ['1.234567', '1.234567'], ['99999999999999.123456000', '99999999999999.123456'],
  ['-0.000100', '-0.0001'], ['', ''], ['0.000', '0']
])('normalizes %s without rounding', (input, expected) => expect(normalizedQuantityInput(input)).toBe(expected))
