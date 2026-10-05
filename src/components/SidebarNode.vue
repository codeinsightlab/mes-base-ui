<script setup lang="ts">
import type {Menu} from '@/stores/auth';import {menuQuery} from '@/lib/sourceMenus';import SvgIcon from '@/components/SvgIcon/index.vue'
defineProps<{menu:Menu}>()
</script>
<template><div v-if="!menu.hidden" class="nav-node"><strong v-if="menu.kind==='DIRECTORY'" class="nav-group"><SvgIcon v-if="menu.icon" :icon-class="menu.icon"/>{{menu.name}}</strong><a v-else-if="menu.link" :href="menu.link" target="_blank" rel="noopener noreferrer"><SvgIcon v-if="menu.icon" :icon-class="menu.icon"/>{{menu.name}}</a><RouterLink v-else :to="{path:menu.path,query:menuQuery(menu.query)}"><SvgIcon v-if="menu.icon" :icon-class="menu.icon"/>{{menu.name}}</RouterLink><div v-if="menu.children.length" class="nav-children"><SidebarNode v-for="child in menu.children" :key="child.id" :menu="child"/></div></div></template>
