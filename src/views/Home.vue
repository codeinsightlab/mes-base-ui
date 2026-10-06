<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAuth } from '@/stores/auth'
import PageHeader from '@/components/PageHeader.vue'
import PlatformWorkspace from '@/components/PlatformWorkspace.vue'
import BusinessWorkspace from '@/components/BusinessWorkspace.vue'
import { availableWorkspaces, defaultWorkspace, type WorkspaceKind } from '@/lib/workspaces'
const auth = useAuth()
const choices = computed(() => availableWorkspaces(auth.workspaceAccess))
const selected = ref<WorkspaceKind>('personal'), preview = ref(false)
watch(() => [auth.revision, auth.workspaceAccess] as const, () => { preview.value = false;selected.value = defaultWorkspace(auth.workspaceAccess) }, { immediate: true })
const title = computed(() => preview.value ? '业务工作台示例' : selected.value === 'business' ? '业务工作台' : selected.value === 'platform' ? '平台工作台' : '我的工作台')
const factory = computed(() => auth.factories.find(item => item.factoryId === auth.factoryId))
const businessFactory = computed(() => !!auth.factoryId && auth.workspaceAccess?.factoryIds.includes(auth.factoryId))
</script>
<template>
  <section class="page home-page">
    <PageHeader :title="title" :description="selected === 'business' || preview ? '生产、报工与质量任务' : selected === 'platform' ? '系统运行、资源与近期活动' : '个人工作与授权入口'">
      <el-button v-if="preview" @click="preview = false">返回平台工作台</el-button>
      <el-radio-group v-else-if="choices.length > 1" v-model="selected" class="workspace-switch" aria-label="切换工作台">
        <el-radio-button v-for="choice in choices" :key="choice.value" :value="choice.value">{{ choice.label }}</el-radio-button>
      </el-radio-group>
    </PageHeader>
    <el-alert v-if="!auth.workspaceAccess" type="warning" title="工作台范围尚未读取，请刷新权限与菜单；服务端需支持新的工作台契约" :closable="false" show-icon />
    <template v-else>
      <section class="workspace-context-bar" aria-label="当前工作上下文">
        <div class="workspace-context-primary"><el-icon><OfficeBuilding v-if="selected === 'business' || preview" /><Grid v-else /></el-icon><div><span class="context-caption">{{ preview ? '业务布局预览' : selected === 'business' ? '业务工作空间' : selected === 'platform' ? '平台工作空间' : '个人工作空间' }}</span><strong>{{ preview ? '演示工厂' : selected === 'business' ? (factory?.name || '请选择工厂') : auth.username }}</strong></div><ScopeTag v-if="selected === 'platform' && !preview" kind="PLATFORM" /><ScopeTag v-else-if="selected === 'business' && businessFactory" kind="FACTORY" :factory-id="auth.factoryId" /></div>
        <span v-if="selected === 'business' || preview" class="sample-data-label"><el-icon><InfoFilled /></el-icon>示例数据</span>
        <span v-else class="section-note">当前账号 · {{ auth.username }}</span>
      </section>
      <BusinessWorkspace v-if="preview" factory-name="演示工厂" />
      <template v-else-if="selected === 'business'">
        <el-alert v-if="!businessFactory" :title="auth.factoryId ? '当前工厂没有业务角色，请选择你拥有业务角色的工厂' : '尚未选择工厂，请在顶部选择你拥有业务角色的工厂'" type="info" :closable="false" show-icon />
        <BusinessWorkspace :key="auth.factoryId" :factory-name="businessFactory ? (factory?.name || auth.factoryId) : '演示工厂'" />
      </template>
      <PlatformWorkspace v-else-if="selected === 'platform'" @preview-business="preview = true" />
      <el-empty v-else description="当前账号尚未分配平台或工厂角色"><div class="personal-links"><RouterLink to="/user/profile">个人资料</RouterLink><RouterLink to="/files">个人文件</RouterLink><RouterLink to="/inbox">我的消息</RouterLink></div></el-empty>
    </template>
  </section>
</template>
