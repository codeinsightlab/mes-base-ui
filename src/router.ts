import { createRouter, createWebHistory } from 'vue-router'
import { watch } from 'vue'
import { synchronizeMenuRoutes } from '@/lib/dynamicRoutes'
import { useAuth } from '@/stores/auth'
const router = createRouter({ history: createWebHistory(), routes: [{ path: '/register', component: () => import('@/views/Register.vue') }, { path: '/system/autocode/parts/:ruleId', component: () => import('@/views/system/autocode/part.vue'), meta: { title: '编码规则组成' }}, { path: '/inbox', component: () => import('@/views/Inbox.vue'), meta: { title: '我的消息' }}, { path: '/login', component: () => import('@/views/Login.vue') }, { path: '/files', component: () => import('@/views/Files.vue'), meta: { title: '个人文件' }}, { path: '/user/profile', component: () => import('@/views/system/user/profile/index.vue'), meta: { title: '个人资料' }}, { path: '/system/user-auth/role/:userId', component: () => import('@/views/system/user/authRole.vue'), meta: { title: '授权角色' }}, { path: '/system/role-auth/user/:roleId', component: () => import('@/views/system/role/authUser.vue'), meta: { title: '授权用户' }}, { path: '/system/dict-data/index/:dictId', component: () => import('@/views/system/dict/data.vue'), meta: { title: '字典数据' }}, { path: '/monitor/job-log/index', component: () => import('@/views/monitor/job/log.vue'), meta: { title: '任务日志' }}, { path: '/', component: () => import('@/views/Home.vue'), meta: { title: '概览' }}, { path: '/:pathMatch(.*)*', component: () => import('@/views/NotFound.vue') }] })
router.beforeEach(async to => {
  const auth = useAuth()
  try { await auth.restoreSession() } catch(error) {
    if (auth.loggedIn) throw error // A network failure must not discard a still-valid credential.
  }
  if (!['/login', '/register'].includes(to.path) && !auth.loggedIn) return { path: '/login', query: { redirect: to.fullPath } }
  if (['/login', '/register'].includes(to.path) && auth.loggedIn) return '/'
  if (to.matched.some(record => record.path === '/:pathMatch(.*)*') && !router.resolve(to.fullPath).matched.some(record => record.path === '/:pathMatch(.*)*')) return { path: to.fullPath, replace: true }
  return true
})
export function installMenuRoutes() { const auth = useAuth(), installed = new Set<string>(); const catalog = import.meta.glob('/src/views/**/index.vue'); watch(() => [auth.platformMenus, auth.factoryMenus, auth.loggedIn], () => synchronizeMenuRoutes(router, auth.loggedIn ? [...auth.platformMenus, ...auth.factoryMenus] : [], catalog, installed), { deep: true, immediate: true, flush: 'sync' }) }
export default router
