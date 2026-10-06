<script setup lang="ts">
import {computed} from 'vue'
import {useAuth,type Menu} from '@/stores/auth'
import {menuQuery} from '@/lib/sourceMenus'
import PageHeader from '@/components/PageHeader.vue'
const auth=useAuth()
const factory=computed(()=>auth.factories.find(f=>f.factoryId===auth.factoryId))
const groups=computed(()=>[...auth.platformMenus,...auth.factoryMenus].filter(menu=>!menu.hidden))
function entries(menu:Menu):Menu[]{return menu.children.length?menu.children.filter(child=>!child.hidden).flatMap(entries):[menu]}
</script>
<template>
  <section class="page home-page">
    <PageHeader title="工作台概览" description="组织、权限与基础系统的统一入口" section="MES BASE / WORKSPACE" />
    <div class="panel home-context"><div><h2>你好，{{auth.username}}</h2><p>从当前授权模块开始工作。</p></div><dl class="context-details"><div><dt>当前工厂</dt><dd>{{factory?.name??'未选择工厂'}}</dd></div><div><dt>工作范围</dt><dd>{{auth.factoryId?'平台 / 当前工厂':'平台管理'}}</dd></div></dl></div>
    <h2 class="home-section-label">模块导航</h2>
    <div class="home-groups"><section v-for="group in groups" :key="group.id" class="panel home-group"><h2><el-icon><FolderOpened/></el-icon>{{group.name}}</h2><div class="home-links"><template v-for="menu in entries(group)" :key="menu.id"><a v-if="menu.link" :href="menu.link" target="_blank" rel="noopener noreferrer">{{menu.name}}<el-icon><TopRight/></el-icon></a><RouterLink v-else :to="{path:menu.path,query:menuQuery(menu.query)}">{{menu.name}}<el-icon><ArrowRight/></el-icon></RouterLink></template></div></section><section class="panel home-group"><h2><el-icon><User/></el-icon>个人工作区</h2><div class="home-links"><RouterLink to="/user/profile">个人资料<el-icon><ArrowRight/></el-icon></RouterLink><RouterLink to="/files">个人文件<el-icon><ArrowRight/></el-icon></RouterLink><RouterLink to="/inbox">我的消息<el-icon><ArrowRight/></el-icon></RouterLink></div></section></div>
    <p class="home-note">模块入口随当前权限显示；工厂可在顶部工作上下文中切换。</p>
  </section>
</template>
