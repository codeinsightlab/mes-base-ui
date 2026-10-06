<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import {useRoute} from 'vue-router'
import type {Menu} from '@/stores/auth'
import {menuQuery} from '@/lib/sourceMenus'
import SvgIcon from '@/components/SvgIcon/index.vue'
const props=withDefaults(defineProps<{menu:Menu;collapsed?:boolean}>(),{collapsed:false})
const route=useRoute(),expanded=ref(true)
function contains(menu:Menu):boolean{return menu.path===route.path||menu.children.some(contains)}
const active=computed(()=>contains(props.menu))
watch(active,value=>{if(value)expanded.value=true})
</script>
<template>
  <div v-if="!menu.hidden" class="nav-node" :class="{'has-active-child':active}">
    <el-popover v-if="collapsed&&menu.children.length" placement="right-start" trigger="hover" :width="236" popper-class="sidebar-flyout">
      <template #reference><button class="nav-group nav-link" :aria-label="menu.name" :title="menu.name"><SvgIcon v-if="menu.icon" :icon-class="menu.icon"/><el-icon v-else><FolderOpened/></el-icon></button></template>
      <p class="flyout-title">{{menu.name}}</p><SidebarNode v-for="child in menu.children" :key="child.id" :menu="child" />
    </el-popover>
    <template v-else>
      <button v-if="menu.kind==='DIRECTORY'" class="nav-group nav-link" :title="menu.name" :aria-expanded="expanded" @click="expanded=!expanded"><SvgIcon v-if="menu.icon" :icon-class="menu.icon"/><el-icon v-else><FolderOpened/></el-icon><span class="nav-text">{{menu.name}}</span><el-icon class="nav-chevron" :class="{expanded}"><ArrowRight/></el-icon></button>
      <a v-else-if="menu.link" class="nav-link" :href="menu.link" :title="menu.name" target="_blank" rel="noopener noreferrer"><SvgIcon v-if="menu.icon" :icon-class="menu.icon"/><el-icon v-else><Document/></el-icon><span class="nav-text">{{menu.name}}</span><el-icon class="nav-chevron"><TopRight/></el-icon></a>
      <RouterLink v-else class="nav-link" :title="menu.name" :to="{path:menu.path,query:menuQuery(menu.query)}"><SvgIcon v-if="menu.icon" :icon-class="menu.icon"/><el-icon v-else><Document/></el-icon><span class="nav-text">{{menu.name}}</span></RouterLink>
      <div v-if="menu.children.length&&expanded" class="nav-children"><SidebarNode v-for="child in menu.children" :key="child.id" :menu="child" /></div>
    </template>
  </div>
</template>
