import { h } from 'vue'

/** Production display only. Keep the original decimal string for editing and business calculations. */
export function displayQuantity(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—'
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(String(value))
  if (!match) return '—'
  const [, sign, integer, fraction = ''] = match
  let cents = BigInt(integer!) * 100n + BigInt(fraction.padEnd(2, '0').slice(0, 2))
  if (fraction.length > 2 && fraction[2]! >= '5') cents++
  // A small remaining/excess quantity must not appear to be exactly zero.
  if (cents === 0n && /[1-9]/.test(integer! + fraction)) return sign ? '> -0.01' : '< 0.01'
  const decimals = (cents % 100n).toString().padStart(2, '0').replace(/0+$/, '')
  return (cents === 0n ? '' : sign) + (cents / 100n).toString() + (decimals ? '.' + decimals : '')
}

/** Element Plus table formatter; all business calculations retain the original values. */
export function quantityColumn(_row: unknown, _column: unknown, value: unknown) {
  const raw = typeof value === 'string' || typeof value === 'number' ? value : null
  return h('span', { class: 'tabular', title: raw == null ? undefined : String(raw) }, displayQuantity(raw))
}

/** Remove insignificant zeroes without rounding or converting through Number. */
export function quantityInput(value: string): string {
  return value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value
}
