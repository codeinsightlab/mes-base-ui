<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { dictionaryState, refreshDictionaries } from '@/utils/dictionaries'
import { useAuth, type Menu } from '@/stores/auth'
import SidebarNode from '@/components/SidebarNode.vue'
import { workspaceTabs, visitTab, resetTabs, closeTabs } from '@/lib/workspaceTabs'
const auth = useAuth(), route = useRoute(), router = useRouter(), collapsed = ref(false), mobile = ref(false), pageVisible = ref(true)
const publicPage = computed(() => ['/login', '/register'].includes(route.path))
const factoryName = computed(() => auth.factories.find(f => f.factoryId === auth.factoryId)?.name)
function findTrail(menus:Menu[], path:string):Menu[] { for (const menu of menus) { if (menu.path === path) return [menu];const children = findTrail(menu.children, path);if (children.length) return [menu, ...children] } return [] }
const trail = computed(() => findTrail([...auth.platformMenus, ...auth.factoryMenus], route.path))
const title = computed(() => String(route.meta.title ?? trail.value.at(-1)?.name ?? '工作页面'))
watch(() => route.fullPath, () => { if (!publicPage.value)visitTab(route.fullPath, title.value);mobile.value = false }, { immediate: true })
watch(() => auth.loggedIn, logged => { if (!logged) { resetTabs();router.replace('/login') } })
watch(() => auth.revision, () => { resetTabs();if (auth.loggedIn && !publicPage.value)visitTab(route.fullPath, title.value) })
function toggleSidebar() { if (window.matchMedia('(max-width:800px)').matches)mobile.value = !mobile.value;else collapsed.value = !collapsed.value }
async function select(value:string) { try { await auth.selectFactory(value);await router.replace('/') } catch(e) { ElMessage.error(e instanceof Error ? e.message : '工厂切换失败') } }
async function refreshNavigation() { try { await auth.refreshNavigation();await router.replace('/');ElMessage.success('权限与菜单已刷新') } catch(e) { ElMessage.error(e instanceof Error ? e.message : '权限刷新失败') } }
async function logout() { try { await auth.logout() } catch(e) { ElMessage.error(e instanceof Error ? e.message : '服务端注销未确认') } finally { router.replace('/login') } }
function close(target:string, mode:'one' | 'others' | 'all' = 'one') { router.push(closeTabs(target, mode, route.fullPath)) }
async function refreshPage() { pageVisible.value = false;workspaceTabs.refresh++;await nextTick();pageVisible.value = true }
function tagCommand(command:string, path:string) { if (command === 'refresh') { if (path === route.fullPath)refreshPage();else router.push(path).then(refreshPage) } else close(path, command as 'one' | 'others' | 'all') }
function userCommand(command:string) { if (command === 'profile')router.push('/user/profile');else if (command === 'permissions')refreshNavigation();else if (command === 'logout')logout() }
</script>
<template>
  <RouterView v-if="publicPage" />
  <div v-else class="app-shell" :class="{'is-collapsed':collapsed}">
    <button v-if="mobile" class="sidebar-backdrop" aria-label="关闭导航" @click="mobile=false" />
    <aside class="sidebar" :class="{open:mobile}" aria-label="主导航">
      <RouterLink to="/" class="brand" title="MES Base 概览"><el-icon class="brand-symbol"><Operation /></el-icon><span class="brand-name">MES <b>Base</b><small>制造执行系统</small></span></RouterLink>
      <nav class="sidebar-navigation">
        <div class="nav-node"><RouterLink to="/" title="概览" class="nav-link" exact-active-class="is-active"><el-icon><Grid /></el-icon><span class="nav-text">工作台概览</span></RouterLink></div>
        <p class="nav-label">平台管理</p>
        <SidebarNode v-for="menu in auth.platformMenus" :key="menu.id" :menu="menu" :collapsed="collapsed" />
        <p v-if="auth.factoryId" class="nav-label">工厂工作区</p>
        <SidebarNode v-for="menu in auth.factoryMenus" :key="menu.id" :menu="menu" :collapsed="collapsed" />
        <p class="nav-label">个人工作区</p>
        <div class="nav-node"><RouterLink to="/files" title="个人文件" class="nav-link"><el-icon><Folder /></el-icon><span class="nav-text">个人文件</span></RouterLink><RouterLink to="/inbox" title="我的消息" class="nav-link"><el-icon><Message /></el-icon><span class="nav-text">我的消息</span></RouterLink></div>
        <p v-if="!auth.platformMenus.length&&!auth.factoryMenus.length" class="nav-empty">当前范围暂无授权菜单</p>
      </nav>
      <div class="sidebar-footer"><span class="status-dot" /><span class="nav-text">MES Base · 基础管理</span></div>
    </aside>
    <div class="workspace">
      <header class="navbar">
        <div class="navbar-leading"><el-button text class="collapse-button" :aria-label="collapsed?'展开侧栏':'折叠侧栏'" :aria-expanded="!collapsed" @click="toggleSidebar"><el-icon><Expand v-if="collapsed" /><Fold v-else /></el-icon></el-button>
          <el-breadcrumb separator="/"><el-breadcrumb-item :to="{path:'/'}">工作台</el-breadcrumb-item><el-breadcrumb-item v-for="item in trail.slice(0,-1)" :key="item.id">{{ item.name }}</el-breadcrumb-item><el-breadcrumb-item v-if="route.path!=='/'">{{ title }}</el-breadcrumb-item></el-breadcrumb>
        </div>
        <div class="navbar-actions">
          <div class="factory-context"><el-icon><OfficeBuilding /></el-icon><span class="context-label">当前工厂</span><el-select :model-value="auth.factoryId" clearable placeholder="未选择工厂" aria-label="当前工厂" @change="select"><el-option v-for="f in auth.factories" :key="f.factoryId" :label="f.name" :value="f.factoryId" /></el-select></div>
          <el-dropdown trigger="click" @command="userCommand"><button class="user-menu" type="button"><span class="user-avatar">{{ auth.username.slice(0,1).toUpperCase() }}</span><span>{{ auth.username }}</span><el-icon><ArrowDown /></el-icon></button><template #dropdown><el-dropdown-menu><el-dropdown-item command="profile" icon="User">个人资料</el-dropdown-item><el-dropdown-item command="permissions" icon="Refresh">刷新权限与菜单</el-dropdown-item><el-dropdown-item command="logout" divided icon="SwitchButton">退出登录</el-dropdown-item></el-dropdown-menu></template></el-dropdown>
        </div>
      </header>
      <nav class="tags" aria-label="已打开页面"><div class="tag-list"><el-dropdown v-for="tag in workspaceTabs.items" :key="tag.path" trigger="contextmenu" @command="(command:string)=>tagCommand(command,tag.path)"><div class="workspace-tag" :class="{active:route.fullPath===tag.path}"><RouterLink :to="tag.path" :aria-current="route.fullPath===tag.path?'page':undefined">{{ tag.title }}</RouterLink><button v-if="tag.path!=='/'" type="button" :aria-label="'关闭'+tag.title" @click="close(tag.path)"><el-icon><Close /></el-icon></button></div><template #dropdown><el-dropdown-menu><el-dropdown-item command="refresh" icon="Refresh">刷新页面</el-dropdown-item><el-dropdown-item command="one" :disabled="tag.path==='/'">关闭页面</el-dropdown-item><el-dropdown-item command="others">关闭其他</el-dropdown-item><el-dropdown-item command="all">关闭全部</el-dropdown-item></el-dropdown-menu></template></el-dropdown></div><el-dropdown trigger="click" @command="(command:string)=>tagCommand(command,route.fullPath)"><el-button text aria-label="页面标签操作" icon="MoreFilled" /><template #dropdown><el-dropdown-menu><el-dropdown-item command="refresh" icon="Refresh">刷新当前页面</el-dropdown-item><el-dropdown-item command="others">关闭其他</el-dropdown-item><el-dropdown-item command="all">关闭全部</el-dropdown-item></el-dropdown-menu></template></el-dropdown>
      </nav>
      <main class="workspace-main"><el-alert v-if="Object.keys(dictionaryState.errors).length" type="error" :closable="false" title="部分选项加载失败，请重试"><el-button text @click="refreshDictionaries">重新加载选项</el-button></el-alert><RouterView v-if="pageVisible" v-slot="{Component,route:pageRoute}"><KeepAlive :key="auth.revision+':'+workspaceTabs.refresh" :max="10"><component :is="Component" v-if="pageRoute.meta.keepAlive" :key="pageRoute.fullPath" /></KeepAlive><component :is="Component" v-if="!pageRoute.meta.keepAlive" :key="auth.revision+':'+workspaceTabs.refresh+':'+pageRoute.fullPath" /></RouterView></main>
    </div>
  </div>
</template>
