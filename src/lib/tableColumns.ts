import type { RouteLocationNormalizedLoaded } from 'vue-router'
import type { ColumnPreference } from '@/api/tablePreferences'
export interface ColumnDefinition {
  key: string; label: string; columnVisible?: boolean; columnHideable?: boolean;
  columnMovable?: boolean; columnFixed?: 'left' | 'right'
}
export type EffectiveColumn<T extends ColumnDefinition> = T & { visible: boolean }
export function normalizeTableUrl(input: string): string {
  // Hash routing's actual page belongs after #/. Ordinary anchors do not affect identity.
  const hash = input.indexOf('#/')
  if (hash >= 0) input = input.slice(hash + 1)
  else if (/^https?:\/\//i.test(input)) input = new URL(input).pathname
  const path = input.split(/[?#]/, 1)[0] || '/'
  return ('/' + path.replace(/^\/+/, '')).replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/'
}
export function tableRouteUrl(route?: RouteLocationNormalizedLoaded, override?: string): string {
  if (override) return normalizeTableUrl(override)
  const matched = route?.matched?.filter(record => !record.path.includes(':pathMatch'))
  const template = matched?.at(-1)?.path
  return normalizeTableUrl(template || route?.path || window.location.href)
}
export function mergeColumns<T extends ColumnDefinition>(defaults: T[], stored: unknown): EffectiveColumn<T>[] {
  const byKey = new Map(defaults.map(column => [column.key, column]))
  const seen = new Set<string>(), ordered: EffectiveColumn<T>[] = []
  const append = (column: T, visible: boolean) => {
    seen.add(column.key)
    ordered.push({ ...column, visible: column.columnHideable === false || column.columnFixed ? true : visible })
  }
  if (Array.isArray(stored)) for (const item of stored) {
    if (!item || typeof item.key !== 'string' || typeof item.visible !== 'boolean' || seen.has(item.key)) continue
    const column = byKey.get(item.key)
    if (column) append(column, item.visible)
  }
  for (const column of defaults) if (!seen.has(column.key)) append(column, column.columnVisible !== false)
  const byOrder = new Map(ordered.map(column => [column.key, column]))
  const middleDefaults = defaults.filter(column => !column.columnFixed)
  const movable = ordered.filter(column => !column.columnFixed && column.columnMovable !== false)
  let index = 0
  const result = [
    ...defaults.filter(column => column.columnFixed === 'left').map(column => byOrder.get(column.key)!),
    ...middleDefaults.map(column => column.columnMovable === false ? byOrder.get(column.key)! : movable[index++]!),
    ...defaults.filter(column => column.columnFixed === 'right').map(column => byOrder.get(column.key)!)
  ]
  // An obsolete/malicious saved configuration cannot turn a usable table into an empty one.
  if (result.length && !result.some(column => column.visible)) result[0]!.visible = true
  return result
}
export function preferencesOf(columns: Array<ColumnDefinition & { visible: boolean }>): ColumnPreference[] {
  return columns.map(({ key, visible }) => ({ key, visible }))
}
