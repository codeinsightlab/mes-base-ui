<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { Menu } from '@/stores/auth'
import { menuQuery } from '@/lib/sourceMenus'
const navigationIcons: Record<string, string> = { system: 'Setting', monitor: 'Monitor', tool: 'SetUp', user: 'User', peoples: 'UserFilled', tree: 'Share', 'tree-table': 'Menu', post: 'Postcard', dict: 'Collection', edit: 'Edit', message: 'ChatLineSquare', log: 'Document', job: 'Timer', server: 'Monitor', redis: 'Coin', druid: 'DataAnalysis', swagger: 'Connection', build: 'SetUp' }
const pageIcons: Record<string, string> = {
  '/system': 'Setting', '/monitor': 'Monitor', '/tool': 'SetUp',
  '/system/user': 'User', '/system/role': 'Key', '/system/menu': 'Menu', '/system/dept': 'Share',
  '/system/post': 'Postcard', '/system/dict': 'Collection', '/system/config': 'SetUp',
  '/system/notice': 'Bell', '/system/message': 'ChatLineSquare',
  '/system/autocode': 'Tickets', '/system/factory': 'OfficeBuilding', '/system/datasource': 'Coin',
  '/monitor/operlog': 'Document', '/monitor/logininfor': 'Tickets', '/monitor/online': 'User',
  '/monitor/job': 'Timer', '/monitor/server': 'Monitor', '/monitor/cache': 'Coin',
  '/monitor/druid': 'DataAnalysis', '/tool/swagger': 'Connection'
}
const icon = computed(() => pageIcons[props.menu.path] ?? navigationIcons[props.menu.icon ?? ''] ?? (props.menu.kind === 'DIRECTORY' ? 'FolderOpened' : 'Document'))
const props = withDefaults(defineProps<{ menu: Menu;collapsed?: boolean;root?: boolean;expanded?: boolean }>(), { collapsed: false })
const emit = defineEmits<{ toggle: [] }>()
const route = useRoute(), localExpanded = ref(false)
const isExpanded = computed(() => props.root ? props.expanded : localExpanded.value)
function toggle() { if (props.root)emit('toggle');else localExpanded.value = !localExpanded.value }
function contains(menu:Menu):boolean { return menu.path === route.path || menu.children.some(contains) }
const active = computed(() => contains(props.menu))
watch(active, value => { if (value)localExpanded.value = true }, { immediate: true })
</script>
<template>
  <div v-if="!menu.hidden" class="nav-node" :class="{'has-active-child':active}">
    <el-popover v-if="collapsed&&menu.children.length" placement="right-start" trigger="hover" :width="236" popper-class="sidebar-flyout">
      <template #reference><button class="nav-group nav-link" :aria-label="menu.name" :title="menu.name"><el-icon><component :is="icon" /></el-icon></button></template>
      <p class="flyout-title">{{ menu.name }}</p><SidebarNode v-for="child in menu.children" :key="child.id" :menu="child" />
    </el-popover>
    <template v-else>
      <button v-if="menu.kind==='DIRECTORY'" class="nav-group nav-link" :title="menu.name" :aria-expanded="isExpanded" @click="toggle"><el-icon><component :is="icon" /></el-icon><span class="nav-text">{{ menu.name }}</span><el-icon class="nav-chevron" :class="{expanded:isExpanded}"><ArrowRight /></el-icon></button>
      <a v-else-if="menu.link" class="nav-link" :href="menu.link" :title="menu.name" target="_blank" rel="noopener noreferrer"><el-icon><component :is="icon" /></el-icon><span class="nav-text">{{ menu.name }}</span><el-icon class="nav-chevron"><TopRight /></el-icon></a>
      <RouterLink v-else class="nav-link" :title="menu.name" :to="{path:menu.path,query:menuQuery(menu.query)}"><el-icon><component :is="icon" /></el-icon><span class="nav-text">{{ menu.name }}</span></RouterLink>
      <div v-if="menu.children.length&&isExpanded" class="nav-children"><SidebarNode v-for="child in menu.children" :key="child.id" :menu="child" /></div>
    </template>
  </div>
</template>
