import type { Router, RouteComponent } from 'vue-router'
import type { Menu } from '@/stores/auth'
/** Only compiled, reviewed modules may become routes; server input never selects arbitrary imports. */
export function synchronizeMenuRoutes(router:Router, menus:Menu[], catalog:Record<string, () => Promise<unknown>>, installed:Set<string>) {
  for (const name of installed)router.removeRoute(name);installed.clear()
  const walk = (items:Menu[]) => {
    for (const menu of items) {
      if (menu.kind === 'MENU' && /^\/[a-zA-Z][a-zA-Z0-9/_-]*$/.test(menu.path) && !menu.path.startsWith('/platform/')) {
        const component = menu.component ?? menu.path.slice(1) + '/index';const loader = /^[A-Za-z][A-Za-z0-9/_-]*$/.test(component) ? catalog['/src/views/' + component + '.vue'] : undefined;const name = 'generated:' + menu.path
        if (loader && !installed.has(name)) { router.addRoute({ path: menu.path, name, component: loader as () => Promise<RouteComponent>, meta: { title: menu.name, keepAlive: menu.isCache === true, hidden: menu.hidden === true, icon: menu.icon }});installed.add(name) }
      }walk(menu.children ?? [])
    }
  };walk(menus)
}
