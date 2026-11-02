import { h } from 'vue'

/** Unit quantity display only. Preserve all significant decimal places; never round or apply new unit rules to stored facts. */
export function formatQuantity(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') return '—'
  if (value === '') return '—'
  return normalizeQuantity(String(value))
}

/** Element Plus table formatter; all display paths use formatQuantity. */
export function quantityColumn(_row: unknown, _column: unknown, value: unknown) {
  const raw = typeof value === 'string' || typeof value === 'number' ? value : null
  return h('span', { class: 'tabular', title: raw == null ? undefined : String(raw) }, formatQuantity(raw))
}

/** Remove insignificant zeroes without rounding or converting through Number. */
export function normalizeQuantity(value: string): string {
  if (!/^-?\d+(?:\.\d*)?$/.test(value)) return value
  return value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value
}
