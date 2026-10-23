<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAuth } from '@/stores/auth'
import PageHeader from '@/components/PageHeader.vue'
import PlatformWorkspace from '@/components/PlatformWorkspace.vue'
import BusinessWorkspace from '@/components/BusinessWorkspace.vue'
import { availableWorkspaces, defaultWorkspace, hasBusinessWorkspace, type WorkspaceKind } from '@/lib/workspaces'
const auth = useAuth()
const choices = computed(() => availableWorkspaces(auth.workspaceAccess))
const selected = ref<WorkspaceKind>('personal')
watch(() => [auth.revision, auth.workspaceAccess] as const, () => { selected.value = defaultWorkspace(auth.workspaceAccess) }, { immediate: true })
const title = computed(() => selected.value === 'business' ? '业务工作台' : selected.value === 'platform' ? '平台工作台' : '我的工作台')
const factory = computed(() => auth.factories.find(item => item.factoryId === auth.factoryId))
const businessFactory = computed(() => hasBusinessWorkspace(auth.workspaceAccess, auth.factoryId))
</script>
<template>
  <section class="page home-page">
    <PageHeader :title="title" :description="selected === 'business' ? '生产、报工与质量任务' : selected === 'platform' ? '系统运行、资源与近期活动' : '个人工作与授权入口'">
      <el-radio-group v-if="choices.length > 1" v-model="selected" class="workspace-switch" aria-label="切换工作台">
        <el-radio-button v-for="choice in choices" :key="choice.value" :value="choice.value">{{ choice.label }}</el-radio-button>
      </el-radio-group>
    </PageHeader>
    <el-alert v-if="!auth.workspaceAccess" type="warning" title="工作台范围尚未读取，请刷新权限与菜单；服务端需支持新的工作台契约" :closable="false" show-icon />
    <template v-else>
      <section class="workspace-context-bar" aria-label="当前工作上下文">
        <div class="workspace-context-primary"><el-icon><OfficeBuilding v-if="selected === 'business'" /><Grid v-else /></el-icon><div><span class="context-caption">{{ selected === 'business' ? '业务工作空间' : selected === 'platform' ? '平台工作空间' : '个人工作空间' }}</span><strong>{{ selected === 'business' ? (factory?.name || '请选择工厂') : auth.username }}</strong></div><ScopeTag v-if="selected === 'platform'" kind="PLATFORM" /><ScopeTag v-else-if="selected === 'business' && businessFactory" kind="FACTORY" :factory-id="auth.factoryId" /></div>
        <span v-if="selected === 'business'" class="section-note">当前工厂 · 真实接口</span>
        <span v-else class="section-note">当前账号 · {{ auth.username }}</span>
      </section>
      <template v-if="selected === 'business'">
        <el-alert v-if="!businessFactory" :title="auth.factoryId ? '当前工厂没有已分配的业务访问范围' : '尚未选择工厂，请在顶部选择工厂'" type="info" :closable="false" show-icon />
        <BusinessWorkspace v-else :key="auth.factoryId" :factory-name="factory?.name || auth.factoryId" />
      </template>
      <PlatformWorkspace v-else-if="selected === 'platform'" />
      <el-empty v-else description="当前账号尚未分配平台或工厂角色"><div class="personal-links"><RouterLink to="/user/profile">个人资料</RouterLink><RouterLink to="/files">个人文件</RouterLink><RouterLink to="/inbox">我的消息</RouterLink></div></el-empty>
    </template>
  </section>
</template>
