<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { dictionaryState, refreshDictionaries } from '@/utils/dictionaries'
import { useAuth, type Menu } from '@/stores/auth'
import SidebarNode from '@/components/SidebarNode.vue'
import { menuWorkspaces } from '@/lib/menuWorkspaces'
import { workspaceTabs, visitTab, resetTabs, closeTabs } from '@/lib/workspaceTabs'
const auth = useAuth(), route = useRoute(), router = useRouter(), collapsed = ref(false), mobile = ref(false), pageVisible = ref(true)
const environment = import.meta.env.DEV ? 'DEV' : 'PROD BUILD'
const tagList = ref<HTMLElement>()
watch(() => route.fullPath, async() => { await nextTick();tagList.value?.querySelector('.workspace-tag.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }) })
const publicPage = computed(() => ['/login', '/register'].includes(route.path))
function findTrail(menus:Menu[], path:string):Menu[] { for (const menu of menus) { if (menu.path === path) return [menu];const children = findTrail(menu.children, path);if (children.length) return [menu, ...children] } return [] }
const navigation = computed(() => menuWorkspaces(auth.platformMenus, auth.factoryMenus))
const trail = computed(() => findTrail([...navigation.value.platform, ...navigation.value.factory], route.path))
const expandedRoot = ref('')
function activeRoot() {
  for (const [scope, menus] of [['platform', navigation.value.platform], ['factory', navigation.value.factory]] as const) {
    const root = menus.find(menu => findTrail([menu], route.path).length)
    if (root) return scope + ':' + root.id
  }
  return ''
}
watch(() => [route.path, auth.revision, auth.platformMenus, auth.factoryMenus], () => { expandedRoot.value = activeRoot() }, { immediate: true })
function toggleRoot(key:string) { expandedRoot.value = expandedRoot.value === key ? '' : key }

const title = computed(() => String(route.meta.title ?? trail.value.at(-1)?.name ?? '工作页面'))
watch(() => route.fullPath, () => { if (route.matched.length && !publicPage.value)visitTab(route.fullPath, title.value);mobile.value = false }, { immediate: true })
watch(() => auth.loggedIn, logged => { if (!logged) { resetTabs();router.replace('/login') } })
watch(() => auth.revision, () => { resetTabs();if (auth.loggedIn && route.matched.length && !publicPage.value)visitTab(route.fullPath, title.value) })
function toggleSidebar() { if (window.matchMedia('(max-width:800px)').matches)mobile.value = !mobile.value;else collapsed.value = !collapsed.value }
async function select(value:string) { try { await auth.selectFactory(value);await router.replace('/') } catch(e) { ElMessage.error(e instanceof Error ? e.message : '工厂切换失败') } }
async function refreshNavigation() { try { await auth.refreshNavigation();await router.replace('/');ElMessage.success('权限与菜单已刷新') } catch(e) { ElMessage.error(e instanceof Error ? e.message : '权限刷新失败') } }
async function logout() { try { await auth.logout() } catch(e) { ElMessage.error(e instanceof Error ? e.message : '服务端注销未确认') } finally { router.replace('/login') } }
async function retrySession() { try { await auth.restoreSession();await router.replace(window.location.pathname + window.location.search + window.location.hash) } catch(e) { ElMessage.error(e instanceof Error ? e.message : '登录状态恢复失败，请重试') } }
function close(target:string, mode:'one' | 'others' | 'all' = 'one') { router.push(closeTabs(target, mode, route.fullPath)) }
async function refreshPage() { pageVisible.value = false;workspaceTabs.refresh++;await nextTick();pageVisible.value = true }
function tagCommand(command:string, path:string) { if (command === 'refresh') { if (path === route.fullPath)refreshPage();else router.push(path).then(refreshPage) } else close(path, command as 'one' | 'others' | 'all') }
function userCommand(command:string) { if (command === 'profile')router.push('/user/profile');else if (command === 'permissions')refreshNavigation();else if (command === 'logout')logout() }
</script>
<template>
  <el-result v-if="auth.loggedIn&&!auth.sessionReady" :icon="auth.sessionError?'error':'info'" :title="auth.sessionError?'暂时无法恢复登录状态':'正在恢复登录状态'" :sub-title="auth.sessionError||'正在读取当前用户、菜单和权限'"><template v-if="auth.sessionError" #extra><el-button type="primary" @click="retrySession">重试</el-button></template></el-result>
  <RouterView v-else-if="publicPage" />
  <div v-else class="app-shell" :class="{'is-collapsed':collapsed}">
    <button v-if="mobile" class="sidebar-backdrop" aria-label="关闭导航" @click="mobile=false" />
    <aside class="sidebar" :class="{open:mobile}" aria-label="主导航">
      <RouterLink to="/" class="brand" title="MES Base 概览"><el-icon class="brand-symbol"><Operation /></el-icon><span class="brand-name">MES <b>Base</b><small>MANUFACTURING / MES</small></span></RouterLink>
      <nav class="sidebar-navigation">
        <div class="nav-node"><RouterLink to="/" title="概览" class="nav-link" exact-active-class="is-active"><el-icon><Grid /></el-icon><span class="nav-text">工作台概览</span></RouterLink></div>
        <p v-if="navigation.platform.length" class="nav-label">平台管理</p>
        <SidebarNode v-for="menu in navigation.platform" :key="'platform:'+menu.id" :menu="menu" :collapsed="collapsed" root :expanded="expandedRoot==='platform:'+menu.id" @toggle="toggleRoot('platform:'+menu.id)" />
        <p v-if="navigation.factory.length || auth.factoryId" class="nav-label">工厂工作区</p>
        <SidebarNode v-for="menu in navigation.factory" :key="'factory:'+menu.id" :menu="menu" :collapsed="collapsed" root :expanded="expandedRoot==='factory:'+menu.id" @toggle="toggleRoot('factory:'+menu.id)" />
        <p class="nav-label">个人工作区</p>
        <div class="nav-node"><RouterLink to="/files" title="个人文件" class="nav-link"><el-icon><Folder /></el-icon><span class="nav-text">个人文件</span></RouterLink><RouterLink to="/inbox" title="我的消息" class="nav-link"><el-icon><Message /></el-icon><span class="nav-text">我的消息</span></RouterLink></div>
        <p v-if="!navigation.platform.length&&!navigation.factory.length" class="nav-empty">当前范围暂无授权菜单</p>
      </nav>
      <div class="sidebar-footer"><el-icon><Operation /></el-icon><span class="nav-text">制造执行系统<small>CONTROL WORKSPACE</small></span></div>
    </aside>
    <div class="workspace">
      <header class="navbar">
        <div class="navbar-leading"><el-button text class="collapse-button" :aria-label="collapsed?'展开侧栏':'折叠侧栏'" :aria-expanded="!collapsed" @click="toggleSidebar"><el-icon><Expand v-if="collapsed" /><Fold v-else /></el-icon></el-button>
          <div class="workspace-location"><el-breadcrumb separator="/"><el-breadcrumb-item :to="{path:'/'}">工作台</el-breadcrumb-item><el-breadcrumb-item v-for="item in trail.slice(0,-1)" :key="item.id">{{ item.name }}</el-breadcrumb-item></el-breadcrumb></div>
        </div>
        <div class="navbar-actions">
          <div class="navbar-environment"><span class="context-label">前端环境</span><CodeText :value="environment" /></div>
          <div class="factory-context" :class="{'has-factory':auth.factoryId}"><el-icon class="context-icon"><OfficeBuilding v-if="auth.factoryId" /><Grid v-else /></el-icon><div class="factory-context-body"><span class="context-label">{{ auth.factoryId ? '工厂工作空间' : '平台工作空间' }}</span><CodeText v-if="auth.factoryId" class="context-factory-id" :value="'ID '+auth.factoryId" /><el-select :model-value="auth.factoryId" clearable placeholder="未选择工厂" aria-label="当前工厂" @change="select"><el-option v-for="f in auth.factories" :key="f.factoryId" :label="f.name" :value="f.factoryId" /></el-select></div></div>
          <el-dropdown trigger="click" @command="userCommand"><button class="user-menu" type="button"><span class="user-avatar">{{ auth.username.slice(0,1).toUpperCase() }}</span><span>{{ auth.username }}</span><el-icon><ArrowDown /></el-icon></button><template #dropdown><el-dropdown-menu><el-dropdown-item command="profile" icon="User">个人资料</el-dropdown-item><el-dropdown-item command="permissions" icon="Refresh">刷新权限与菜单</el-dropdown-item><el-dropdown-item command="logout" divided icon="SwitchButton">退出登录</el-dropdown-item></el-dropdown-menu></template></el-dropdown>
        </div>
      </header>
      <nav class="tags" aria-label="已打开页面"><div ref="tagList" class="tag-list"><el-dropdown v-for="tag in workspaceTabs.items" :key="tag.path" trigger="contextmenu" @command="(command:string)=>tagCommand(command,tag.path)"><div class="workspace-tag" :class="{active:route.fullPath===tag.path}"><RouterLink :to="tag.path" :aria-current="route.fullPath===tag.path?'page':undefined">{{ tag.title }}</RouterLink><button v-if="tag.path!=='/'" type="button" :aria-label="'关闭'+tag.title" @click="close(tag.path)"><el-icon><Close /></el-icon></button></div><template #dropdown><el-dropdown-menu><el-dropdown-item command="refresh" icon="Refresh">刷新页面</el-dropdown-item><el-dropdown-item command="one" :disabled="tag.path==='/'">关闭页面</el-dropdown-item><el-dropdown-item command="others">关闭其他</el-dropdown-item><el-dropdown-item command="all">关闭全部</el-dropdown-item></el-dropdown-menu></template></el-dropdown></div><el-dropdown trigger="click" @command="(command:string)=>tagCommand(command,route.fullPath)"><el-button text aria-label="页面标签操作" icon="MoreFilled" /><template #dropdown><el-dropdown-menu><el-dropdown-item command="refresh" icon="Refresh">刷新当前页面</el-dropdown-item><el-dropdown-item command="others">关闭其他</el-dropdown-item><el-dropdown-item command="all">关闭全部</el-dropdown-item></el-dropdown-menu></template></el-dropdown>
      </nav>
      <main class="workspace-main"><el-alert v-if="Object.keys(dictionaryState.errors).length" type="error" :closable="false" title="部分选项加载失败，请重试"><el-button text @click="refreshDictionaries">重新加载选项</el-button></el-alert><RouterView v-if="pageVisible" v-slot="{Component,route:pageRoute}"><KeepAlive :key="auth.revision+':'+workspaceTabs.refresh" :max="10"><component :is="Component" v-if="pageRoute.meta.keepAlive" :key="pageRoute.fullPath" /></KeepAlive><component :is="Component" v-if="!pageRoute.meta.keepAlive" :key="auth.revision+':'+workspaceTabs.refresh+':'+pageRoute.fullPath" /></RouterView></main>
    </div>
  </div>
</template>
