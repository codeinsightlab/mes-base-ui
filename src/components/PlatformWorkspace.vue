<script setup lang="ts">
import { computed } from 'vue'
import { useAuth, type Menu } from '@/stores/auth'
import { menuQuery } from '@/lib/sourceMenus'
import { availableWorkspaces } from '@/lib/workspaces'
import { menuWorkspaces } from '@/lib/menuWorkspaces'
import { operationStatus } from '@/lib/dataPresentation'
import { parseTime } from '@/utils/ruoyi'
import { useWorkspaceStatus } from '@/composables/useWorkspaceStatus'
import ScopeTag from '@/components/ScopeTag.vue'
import StatusTag from '@/components/StatusTag.vue'
import CodeText from '@/components/CodeText.vue'
import MethodBadge from '@/components/MethodBadge.vue'
import MetricValue from '@/components/MetricValue.vue'
const emit = defineEmits<{ previewBusiness: [] }>()
const auth = useAuth()
function entries(menu: Menu): Menu[] { return menu.hidden ? [] : menu.children.length ? menu.children.flatMap(entries) : [menu] }
const navigation = computed(() => menuWorkspaces(auth.platformMenus, auth.factoryMenus))
const groups = computed(() => [
  ...navigation.value.platform.filter(menu => !menu.hidden).map(menu => ({ menu, kind: 'PLATFORM' })),
  ...navigation.value.factory.filter(menu => !menu.hidden).map(menu => ({ menu, kind: 'FACTORY' }))
])
const entryCount = computed(() => groups.value.reduce((count, group) => count + entries(group.menu).length, 0))
const { online, jobs, server, cache, operations, loading, reload } = useWorkspaceStatus(auth)
const metrics = computed(() => [
  { title: '在线会话', icon: 'User', data: online, value: online.value, unit: '个', note: '平台当前在线会话', path: '/monitor/online' },
  { title: '调度任务', icon: 'Timer', data: jobs, value: jobs.value?.total, unit: '项', note: '已配置任务总数', path: '/monitor/job' },
  { title: '主机内存', icon: 'Monitor', data: server, value: server.value?.mem.usage, unit: '%', note: '服务所在主机使用率', path: '/monitor/server' },
  { title: 'Redis 缓存', icon: 'Coin', data: cache, value: cache.value?.dbSize, unit: '个键', note: cache.value ? 'Redis ' + cache.value.info.redis_version + ' · ' + cache.value.info.used_memory_human : '缓存当前数据库键数', path: '/monitor/cache' }
])
</script>
<template>
  <div class="operational-workspace">
    <div class="workspace-refresh"><span class="section-note">平台范围 · 真实接口快照</span><div><el-button v-if="!availableWorkspaces(auth.workspaceAccess).some(item => item.value === 'business')" @click="emit('previewBusiness')">查看业务工作台示例</el-button><el-button icon="Refresh" :loading="loading" @click="reload">刷新状态</el-button></div></div>
    <section class="system-snapshot" aria-label="平台系统状态">
      <div class="section-heading"><h2>系统状态</h2><span class="section-note">平台范围 · 手动刷新快照</span></div>
      <div class="snapshot-grid">
        <section v-for="metric in metrics" :key="metric.path" class="snapshot-card" :aria-busy="metric.data.state === 'loading'">
          <header><span><el-icon><component :is="metric.icon" /></el-icon>{{ metric.title }}</span><RouterLink v-if="metric.data.state !== 'forbidden'" :to="metric.path" :aria-label="'查看'+metric.title"><el-icon><TopRight /></el-icon></RouterLink></header>
          <div v-if="metric.data.state === 'loading'" class="snapshot-loading">正在读取…</div>
          <template v-else-if="metric.data.state === 'ready'"><MetricValue class="snapshot-value" :value="metric.value" :unit="metric.unit" /><p>{{ metric.note }}</p><footer><StatusTag label="已读取" tone="success" /><span>{{ metric.data.updatedAt }}</span></footer></template>
          <div v-else-if="metric.data.state === 'error'" class="snapshot-error" role="alert"><StatusTag label="读取失败" tone="error" /><p>{{ metric.data.error }}</p><el-button text @click="reload">重新读取</el-button></div>
          <div v-else class="snapshot-unavailable"><span>未授权</span><p>当前账号无此监控读取权限</p></div>
        </section>
      </div>
    </section>

    <div class="operations-grid">
      <section class="activity-console" aria-label="近期平台操作">
        <div class="section-heading"><h2>近期活动</h2><RouterLink v-if="operations.state !== 'forbidden'" to="/monitor/operlog" class="section-link">全部操作日志 <el-icon><ArrowRight /></el-icon></RouterLink></div>
        <div class="activity-surface">
          <div class="console-caption"><span>最近 6 条操作记录</span><ScopeTag kind="PLATFORM" /><span v-if="operations.updatedAt" class="snapshot-time">更新于 {{ operations.updatedAt }}</span></div>
          <el-alert v-if="operations.state === 'error'" :title="operations.error" type="error" :closable="false" show-icon><el-button text @click="reload">重试</el-button></el-alert>
          <p v-else-if="operations.state === 'forbidden'" class="console-empty">当前账号未授权查看操作日志</p>
          <el-table v-else v-loading="operations.state === 'loading'" :data="operations.value?.rows || []" empty-text="暂无操作记录">
            <el-table-column label="系统模块 / 请求" min-width="180"><template #default="{ row }"><div class="activity-title">{{ row.title }}</div><CodeText :value="row.requestId" /></template></el-table-column>
            <el-table-column label="方式" width="82"><template #default="{ row }"><MethodBadge :method="row.requestMethod" /></template></el-table-column>
            <el-table-column label="操作人员" prop="operName" min-width="90" show-overflow-tooltip />
            <el-table-column label="执行范围" width="132"><template #default="{ row }"><ScopeTag :kind="row.executionScope" :factory-id="row.factoryId" /></template></el-table-column>
            <el-table-column label="耗时" width="110" align="right"><template #default="{ row }"><MetricValue :value="row.costTime" unit="ms" latency /></template></el-table-column>
            <el-table-column label="结果" width="82"><template #default="{ row }"><StatusTag v-bind="operationStatus(row.status)" /></template></el-table-column>
            <el-table-column label="操作日期" width="170"><template #default="{ row }"><span class="data-datetime">{{ parseTime(row.operTime) }}</span></template></el-table-column>
          </el-table>
          <div v-if="operations.state === 'ready'" class="console-footer">共 {{ operations.value?.total }} 条记录 · 查看完整日志可筛选与追踪</div>
        </div>
      </section>
      <section class="schedule-console" aria-label="调度状态">
        <div class="section-heading"><h2>调度状态</h2><RouterLink v-if="jobs.state !== 'forbidden'" to="/monitor/job" class="section-link">管理任务 <el-icon><ArrowRight /></el-icon></RouterLink></div>
        <div class="schedule-surface">
          <header class="console-caption"><span>任务配置快照</span><ScopeTag kind="PLATFORM" /></header>
          <p v-if="jobs.state === 'loading'" class="console-empty">正在读取任务…</p>
          <div v-else-if="jobs.state === 'error'" class="snapshot-error" role="alert"><StatusTag label="读取失败" tone="error" /><p>{{ jobs.error }}</p></div>
          <p v-else-if="jobs.state === 'forbidden'" class="console-empty">当前账号未授权查看调度任务</p>
          <div v-else-if="!jobs.value?.rows.length" class="schedule-empty"><el-icon><Timer /></el-icon><strong>暂无调度任务</strong><p>当前没有已配置的 Quartz 任务</p></div>
          <ul v-else class="schedule-list"><li v-for="job in jobs.value.rows" :key="job.jobId"><div><strong>{{ job.jobName }}</strong><StatusTag :label="job.status === '0' ? '启用' : job.status === '1' ? '暂停' : job.status" /></div><p><CodeText :value="job.jobId" /><ScopeTag :kind="job.executionScope" :factory-id="job.factoryId" /></p><span class="data-datetime">下次计划：{{ job.nextValidTime || '未提供' }}</span></li></ul>
          <footer class="console-footer">最多显示 5 项配置；启用状态不表示正在执行</footer>
        </div>
      </section>
    </div>

    <section class="workspace-shortcuts" aria-label="授权工作入口">
      <div class="section-heading"><h2>工作入口</h2><span class="section-note">{{ entryCount }} 个已授权入口</span></div>
      <details class="module-disclosure"><summary>按模块查看全部入口 <el-icon><ArrowDown /></el-icon></summary><div class="compact-module-grid"><section v-for="({ menu: group, kind }) in groups" :key="kind + ':' + group.id"><h3>{{ group.name }} <ScopeTag :kind="kind" /></h3><div><template v-for="menu in entries(group)" :key="menu.id"><a v-if="menu.link" :href="menu.link" target="_blank" rel="noopener noreferrer">{{ menu.name }} <el-icon><TopRight /></el-icon></a><RouterLink v-else :to="{ path: menu.path, query: menuQuery(menu.query) }">{{ menu.name }}</RouterLink></template></div></section><p v-if="!groups.length" class="console-empty">当前工作区暂无授权模块</p></div></details>
      <div class="personal-links"><span>个人入口</span><RouterLink to="/user/profile">个人资料</RouterLink><RouterLink to="/files">个人文件</RouterLink><RouterLink to="/inbox">我的消息</RouterLink></div>
    </section>
  </div>
</template>
