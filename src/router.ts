import { createRouter,createWebHistory } from 'vue-router'
import {watch} from 'vue'
import {synchronizeMenuRoutes} from '@/lib/dynamicRoutes'
import { useAuth } from '@/stores/auth';import { pages } from '@/lib/platform'
const router=createRouter({history:createWebHistory(),routes:[{path:'/login',component:()=>import('@/views/Login.vue')},{path:'/files',component:()=>import('@/views/Files.vue'),meta:{title:'个人文件'}},{path:'/',component:()=>import('@/views/Home.vue'),meta:{title:'概览'}},{path:'/platform/:resource',component:()=>import('@/views/PlatformPage.vue')},{path:'/:pathMatch(.*)*',component:()=>import('@/views/NotFound.vue')}]})
router.beforeEach(to=>{const auth=useAuth();if(to.path!=='/login'&&!auth.loggedIn)return '/login';if(to.path==='/login'&&auth.loggedIn)return '/';const resource=String(to.params.resource??'');if(resource&&pages[resource]){const p=pages[resource]!;to.meta.title=p.title;if(!auth.hasPermission(p.permission+':read','platform'))return '/'}return true})
export function installMenuRoutes(){const auth=useAuth(),installed=new Set<string>();const catalog=import.meta.glob('/src/views/*/*/index.vue');watch(()=>[auth.platformMenus,auth.factoryMenus,auth.loggedIn],()=>synchronizeMenuRoutes(router,auth.loggedIn?[...auth.platformMenus,...auth.factoryMenus]:[],catalog,installed),{deep:true,immediate:true})}
export default router
