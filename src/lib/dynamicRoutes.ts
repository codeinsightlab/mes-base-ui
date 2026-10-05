import type {Router,RouteComponent} from 'vue-router'
import type {Menu} from '@/stores/auth'
/** Only compiled, reviewed modules may become routes; server input never selects arbitrary imports. */
export function synchronizeMenuRoutes(router:Router,menus:Menu[],catalog:Record<string,()=>Promise<unknown>>,installed:Set<string>){
 for(const name of installed)router.removeRoute(name);installed.clear()
 const walk=(items:Menu[])=>{for(const menu of items){if(menu.kind==='MENU'&&/^\/[a-z][a-z0-9-]*\/[a-zA-Z][a-zA-Z0-9]*$/.test(menu.path)&&!menu.path.startsWith('/platform/')){
  const loader=catalog['/src/views'+menu.path+'/index.vue'];const name='generated:'+menu.path
  if(loader&&!installed.has(name)){router.addRoute({path:menu.path,name,component:loader as ()=>Promise<RouteComponent>,meta:{title:menu.name}});installed.add(name)}
 }walk(menu.children??[])}};walk(menus)
}
