import { createRouter, createWebHistory } from 'vue-router'
import { watch } from 'vue'
import { synchronizeMenuRoutes } from '@/lib/dynamicRoutes'
import { menuPathForComponent } from '@/lib/menuWorkspaces'
import { boards, type Board } from '@/api/production/analytics'
import { useAuth } from '@/stores/auth'
const router = createRouter({ history: createWebHistory(), routes: [{ path: '/production/analytics', component: () => import('@/views/production/analytics/index.vue'), beforeEnter: to => {
  const { topic, ...query } = to.query
  const keys = (Object.keys(boards) as Board[]).filter(key => !topic || key === topic)
  for (const key of keys) {
    const permission = boards[key].permission
    const target = menuPathForComponent(useAuth().factoryMenus, 'analytics/' + key + '/index')
    if (target && useAuth().hasPermission(permission, 'factory')) return { path: target, query, replace: true }
  }
} }, { path: '/basic/bom-explosion', component: () => import('@/views/basic/bomExplosion/index.vue'), meta: { title: '物料BOM展开' }}, { path: '/select-factory', component: () => import('@/views/SelectFactory.vue'), meta: { title: '重新选择工厂' }}, { path: '/register', component: () => import('@/views/Register.vue') }, { path: '/system/autocode/parts/:ruleId', component: () => import('@/views/system/autocode/part.vue'), meta: { title: '编码规则组成' }}, { path: '/inbox', component: () => import('@/views/Inbox.vue'), meta: { title: '我的消息' }}, { path: '/login', component: () => import('@/views/Login.vue') }, { path: '/files', component: () => import('@/views/Files.vue'), meta: { title: '个人文件' }}, { path: '/user/profile', component: () => import('@/views/system/user/profile/index.vue'), meta: { title: '个人资料' }}, { path: '/system/user-auth/role/:userId', component: () => import('@/views/system/user/authRole.vue'), meta: { title: '授权角色' }}, { path: '/system/role-auth/user/:roleId', component: () => import('@/views/system/role/authUser.vue'), meta: { title: '授权用户' }}, { path: '/system/dict-data/index/:dictId', component: () => import('@/views/system/dict/data.vue'), meta: { title: '字典数据' }}, { path: '/monitor/job-log/index', component: () => import('@/views/monitor/job/log.vue'), meta: { title: '任务日志' }}, { path: '/', component: () => import('@/views/Home.vue'), meta: { title: '概览' }}, { path: '/:pathMatch(.*)*', component: () => import('@/views/NotFound.vue') }] })
router.beforeEach(async to => {
  const auth = useAuth()
  try {
    await auth.restoreSession()
  } catch (error) {
    if (auth.loggedIn) throw error // A network failure must not discard a still-valid credential.
  }
  if (!['/login', '/register'].includes(to.path) && !auth.loggedIn) return { path: '/login', query: { redirect: to.fullPath }}
  if (auth.loggedIn && auth.factorySelectionRequired && to.path !== '/select-factory') return '/select-factory'
  if (['/login', '/register'].includes(to.path) && auth.loggedIn) return '/'
  if (to.matched.some(record => record.path === '/:pathMatch(.*)*') && !router.resolve(to.fullPath).matched.some(record => record.path === '/:pathMatch(.*)*')) return { path: to.path, query: to.query, hash: to.hash, replace: true }
  return true
})
export function installMenuRoutes() {
  const auth = useAuth(), installed = new Set<string>()
  const catalog = import.meta.glob('/src/views/**/index.vue')
  watch(() => [auth.platformMenus, auth.factoryMenus, auth.loggedIn], () => synchronizeMenuRoutes(router, auth.loggedIn ? [...auth.platformMenus, ...auth.factoryMenus] : [], catalog, installed), { deep: true, immediate: true, flush: 'sync' })
}
export default router
