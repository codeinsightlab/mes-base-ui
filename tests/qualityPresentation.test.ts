import { describe, expect, it } from 'vitest'
import { exceedsQuantity, positiveQuantity } from '../src/lib/quality/presentation'
describe('quality quantity checks', () => {
  it('compares decimal quantities without losing precision', () => {
    expect(exceedsQuantity('9007199254740993.0001', '9007199254740993')).toBe(true)
    expect(exceedsQuantity('10.00', '10')).toBe(false)
    expect(exceedsQuantity('0.001', '0.01')).toBe(false)
  })
  it('requires a positive decimal value', () => {
    for (const value of ['0', '0.000', '-1', 'NaN', '1e3', '']) expect(positiveQuantity(value)).toBe(false)
    expect(positiveQuantity('0.001')).toBe(true)
  })
})
