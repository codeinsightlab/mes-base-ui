import { h } from 'vue'

/** Production display only. Keep the original decimal string for editing and business calculations. */
export function displayQuantity(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—'
  return quantityInput(String(value))
}

/** Element Plus table formatter; all business calculations retain the original values. */
export function quantityColumn(_row: unknown, _column: unknown, value: unknown) {
  const raw = typeof value === 'string' || typeof value === 'number' ? value : null
  return h('span', { class: 'tabular', title: raw == null ? undefined : String(raw) }, displayQuantity(raw))
}

/** Remove insignificant zeroes without rounding or converting through Number. */
export function quantityInput(value: string): string {
  if (!/^-?\d+(?:\.\d*)?$/.test(value)) return value
  return value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value
}
