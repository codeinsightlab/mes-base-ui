import type { Menu } from '@/stores/auth'
import type { LocationQueryRaw } from 'vue-router'

export interface SourceRoute {
  name?: string;path: string;component?: string;hidden?: boolean;query?: string
  meta?: { title: string;icon?: string;noCache?: boolean;link?: string };children?: SourceRoute[]
}
export function safeMenuLink(value?:string):string | undefined {
  if (!value) return undefined
  try { const url = new URL(value);return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined } catch { return undefined }
}
/** Source query is JSON metadata, never executable code or a component import. */
export function menuQuery(value?:string):LocationQueryRaw {
  if (!value || value.length > 255) return {}
  try {
    const parsed:unknown = JSON.parse(value);if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const result:LocationQueryRaw = {}
    for (const [key, item] of Object.entries(parsed)) {
      if (!/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(key) || ['constructor', 'prototype', '__proto__'].includes(key)) continue
      if (item === null || typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean')result[key] = item === null ? null : String(item)
    } return result
  } catch { return {} }
}
export function routeMenus(routes:SourceRoute[], prefix = '', parentHidden = false):Menu[] {
  return routes.map(r => {
    const path = r.path.startsWith('/') ? r.path : (prefix + '/' + r.path).replace(/\/+/g, '/');const hidden = parentHidden || !!r.hidden
    return { id: path, name: r.meta?.title ?? r.name ?? path, path, component: r.component, permission: '', kind: r.children?.length ? 'DIRECTORY' : 'MENU', hidden, isCache: r.meta?.noCache === false, query: r.query, icon: r.meta?.icon, link: safeMenuLink(r.meta?.link ?? r.path), children: routeMenus(r.children ?? [], path, hidden) }
  })
}
