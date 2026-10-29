import { normalizedQuantityInput, positiveQuantity, quantityInputError } from './production/quantityRules'

/** BOM base and component coefficients are ratios, independent of physical unit precision. */
export function bomRatio(raw: unknown): string {
  const value = normalizedQuantityInput(String(raw ?? ''))
  const error = quantityInputError(value, { mustBeWholeNumber: false, quantityPrecision: 6 })
  if (error || !positiveQuantity(value)) throw Error(error || 'BOM数量必须大于零')
  return value
}
