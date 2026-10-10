import type { Menu } from '@/stores/auth'

const platformPrefixes = ['/system', '/tool', '/monitor']

export function isPlatformMenu(path: string): boolean {
  return platformPrefixes.some(prefix => path === prefix || path.startsWith(prefix + '/'))
}

/** Group authorized navigation by URL without changing its permission source. */
export function menuWorkspaces(...sources: Menu[][]): { platform: Menu[]; factory: Menu[] } {
  const merge = (menus: Menu[]): Menu[] => {
    const merged = new Map<string, Menu>()
    for (const menu of menus) {
      const previous = merged.get(menu.path)
      merged.set(menu.path, {
        ...(previous ?? menu),
        children: merge([...(previous?.children ?? []), ...menu.children])
      })
    }
    return [...merged.values()]
  }
  const split = (menus: Menu[]): { platform: Menu[]; factory: Menu[] } => {
    const result = { platform: [] as Menu[], factory: [] as Menu[] }
    for (const menu of menus) {
      const scope = isPlatformMenu(menu.path) ? 'platform' : 'factory'
      const other = scope === 'platform' ? 'factory' : 'platform'
      const children = split(menu.children)
      if (menu.kind !== 'DIRECTORY' || !menu.children.length || children[scope].length) {
        result[scope].push({ ...menu, children: children[scope] })
      }
      result[other].push(...children[other])
    }
    return result
  }
  return split(merge(sources.flat()))
}
