<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAuth } from '@/stores/auth'
import { useDruidMonitor } from '@/composables/useDruidMonitor'
import type { DruidSql } from '@/api/monitor/druid'
import { parseTime } from '@/utils/ruoyi'
const auth = useAuth()
const { catalog, snapshot, selected, pageNum, pageSize, loading, detailLoading, error, detailError, select, reload } = useDruidMonitor(auth)
const active = ref('pool'), sqlDetail = ref<DruidSql | null>(null)
watch(() => [selected.value, auth.revision], () => { sqlDetail.value = null;active.value = 'pool' })
const kinds = { PLATFORM: '中心库', BUSINESS: '工厂业务库', EXTERNAL: '外部数据库' }
const states: Record<string, { label: string; tone: 'success' | 'disabled' | 'warning' }> = { INITIALIZED: { label: '已初始化', tone: 'success' }, NOT_INITIALIZED: { label: '未初始化', tone: 'disabled' }, DISABLED: { label: '已停用', tone: 'disabled' }, UNBOUND: { label: '未绑定工厂', tone: 'warning' }, CLOSED: { label: '已关闭', tone: 'disabled' }}
const poolFields = [
  ['initialSize', '初始连接数'], ['minIdle', '最小空闲连接'], ['maxActive', '最大连接数'], ['maxWaitMillis', '最大等待时间 (ms)'],
  ['activePeak', '活跃连接峰值'], ['poolingPeak', '空闲连接峰值'], ['waitingPeak', '等待线程峰值'], ['waitCount', '累计等待次数'],
  ['waitMillis', '累计等待时间 (ms)'], ['connectCount', '连接借用次数'], ['closeCount', '连接归还次数'], ['createCount', '物理连接创建次数'],
  ['destroyCount', '物理连接销毁次数'], ['connectErrorCount', '建连错误次数'], ['errorCount', '执行错误次数'], ['queryCount', 'SQL 执行次数'],
  ['transactionCount', '事务开启次数'], ['commitCount', '事务提交次数'], ['rollbackCount', '事务回滚次数']
] as const
</script>
<template>
  <div class="app-container druid-monitor">
    <PageHeader title="数据源监控" description="本节点的 JDBC 连接池、SQL 活动与防火墙"><el-button icon="Refresh" :loading="loading" @click="reload">刷新快照</el-button></PageHeader>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <div class="druid-monitor-layout">
      <aside class="druid-source-directory" aria-label="数据源目录" :aria-busy="loading">
        <div class="section-heading"><h2>数据源目录</h2><MetricValue :value="catalog?.total" unit="个" /></div>
        <p class="section-note">中心库、工厂业务库及已配置外部连接</p>
        <div v-loading="loading" class="druid-source-list"><button v-for="source in catalog?.rows" :key="source.id" type="button" :class="{selected:selected===source.id}" :aria-pressed="selected===source.id" @click="select(source.id)"><div><strong>{{ source.name }}</strong><StatusTag v-bind="states[source.state] || { label: source.state, tone: 'disabled' }" /></div><span>{{ kinds[source.kind] }} · {{ source.databaseType }}</span><span v-if="source.factoryId">{{ source.factoryName || source.factoryId }}</span><CodeText :value="source.id" /></button><p v-if="catalog && !catalog.rows.length" class="console-empty">本页没有数据源</p></div>
        <el-pagination v-if="catalog && catalog.total > pageSize" v-model:current-page="pageNum" small :page-size="pageSize" :total="catalog.total" layout="prev, pager, next" :pager-count="5" @current-change="reload" />
        <p class="druid-directory-note">监控不主动创建连接池。新增外部连接后，将按配置标识出现在目录中。</p>
      </aside>
      <section v-loading="detailLoading" class="druid-source-detail" aria-label="选中数据源统计">
        <el-alert v-if="detailError" :title="detailError" type="error" :closable="false" show-icon><el-button text @click="select(selected)">重试</el-button></el-alert>
        <template v-if="snapshot">
          <div class="druid-detail-header"><div><h2>{{ snapshot.source.name }}</h2><div class="druid-source-meta"><span>{{ kinds[snapshot.source.kind] }}</span><CodeText :value="snapshot.source.databaseType" /><ScopeTag v-if="snapshot.source.kind === 'PLATFORM'" kind="PLATFORM" /><ScopeTag v-else-if="snapshot.source.factoryId" kind="FACTORY" :factory-id="snapshot.source.factoryId" /><StatusTag v-bind="states[snapshot.source.state] || { label: snapshot.source.state, tone: 'disabled' }" /></div></div><div class="druid-snapshot-time"><span>更新于 {{ parseTime(snapshot.capturedAt) }}</span><CodeText :value="snapshot.nodeId" /></div></div>
          <el-alert v-if="!snapshot.pool" type="info" :title="'当前数据源'+(states[snapshot.source.state]?.label || snapshot.source.state)+'，暂无本节点连接池统计'" :closable="false" show-icon />
          <template v-else>
            <div class="snapshot-grid druid-metrics"><section class="snapshot-card"><header>活跃 / 最大连接</header><MetricValue class="snapshot-value" :value="snapshot.pool.activeCount" /><p>最大 {{ snapshot.pool.maxActive }} · 峰值 {{ snapshot.pool.activePeak }}</p></section><section class="snapshot-card"><header>空闲连接</header><MetricValue class="snapshot-value" :value="snapshot.pool.poolingCount" /><p>最小空闲 {{ snapshot.pool.minIdle }}</p></section><section class="snapshot-card"><header>等待线程</header><MetricValue class="snapshot-value" :value="snapshot.pool.waitingThreads" /><p>累计等待 {{ snapshot.pool.waitMillis }} ms</p></section><section class="snapshot-card"><header>SQL 执行</header><MetricValue class="snapshot-value" :value="snapshot.pool.queryCount" /><p>执行错误 {{ snapshot.pool.errorCount }} 次</p></section></div>
            <el-tabs v-model="active"><el-tab-pane label="连接池详情" name="pool"><el-descriptions :column="2" border><el-descriptions-item label="连接池名称"><CodeText :value="snapshot.pool.name" /></el-descriptions-item><el-descriptions-item label="SQL 统计"><StatusTag :label="snapshot.pool.sqlStatisticsEnabled ? '已启用' : '未启用'" :tone="snapshot.pool.sqlStatisticsEnabled ? 'success' : 'disabled'" /></el-descriptions-item><el-descriptions-item v-for="[key,label] in poolFields" :key="key" :label="label"><MetricValue :value="snapshot.pool[key]" /></el-descriptions-item></el-descriptions></el-tab-pane>
              <el-tab-pane label="SQL 统计" name="sql"><div class="console-caption"><span>按累计耗时排序 · 最多 100 条 SQL 模板</span><span>不展示 SQL 参数</span></div><el-alert v-if="!snapshot.pool.sqlStatisticsEnabled" type="info" title="此连接池未启用 SQL 统计" :closable="false" /><el-table :data="snapshot.sql" empty-text="暂无已记录的 SQL"><el-table-column label="SQL 模板" min-width="320" show-overflow-tooltip><template #default="{ row }"><CodeText :value="row.sql" /></template></el-table-column><el-table-column label="执行次数" width="100" align="right"><template #default="{ row }"><MetricValue :value="row.executeCount" /></template></el-table-column><el-table-column label="总耗时" width="125" align="right"><template #default="{ row }"><MetricValue :value="row.totalMillis" unit="ms" /></template></el-table-column><el-table-column label="最大耗时" width="125" align="right"><template #default="{ row }"><MetricValue :value="row.maxMillis" unit="ms" latency /></template></el-table-column><el-table-column label="错误次数" width="100" align="right"><template #default="{ row }"><MetricValue :value="row.errorCount" /></template></el-table-column><el-table-column label="操作" width="70" fixed="right"><template #default="{ row }"><el-button link type="primary" @click="sqlDetail = row">详情</el-button></template></el-table-column></el-table></el-tab-pane>
              <el-tab-pane label="SQL 防火墙" name="wall"><el-descriptions v-if="snapshot.wall?.enabled" :column="2" border><el-descriptions-item label="检查次数"><MetricValue :value="snapshot.wall.checkCount" /></el-descriptions-item><el-descriptions-item label="违规次数"><MetricValue :value="snapshot.wall.violationCount" /></el-descriptions-item><el-descriptions-item label="白名单命中"><MetricValue :value="snapshot.wall.whiteListHitCount" /></el-descriptions-item><el-descriptions-item label="黑名单命中"><MetricValue :value="snapshot.wall.blackListHitCount" /></el-descriptions-item></el-descriptions><el-alert v-else type="info" title="此连接池未启用 SQL 防火墙" :closable="false" show-icon /></el-tab-pane></el-tabs>
          </template>
          <p class="druid-directory-note">统计来自当前应用节点；不是数据库服务器的全局负载，也未汇总其他节点。</p>
        </template>
        <el-empty v-else-if="!detailLoading && !detailError" description="选择数据源查看监控" />
      </section>
    </div>
    <el-dialog :model-value="!!sqlDetail" title="SQL 统计详情" width="760px" @close="sqlDetail = null"><template v-if="sqlDetail"><pre class="druid-sql-template">{{ sqlDetail.sql }}</pre><el-descriptions :column="2" border><el-descriptions-item label="统计编号"><CodeText :value="sqlDetail.id" /></el-descriptions-item><el-descriptions-item label="执行次数"><MetricValue :value="sqlDetail.executeCount" /></el-descriptions-item><el-descriptions-item label="正在执行"><MetricValue :value="sqlDetail.runningCount" /></el-descriptions-item><el-descriptions-item label="最大并发"><MetricValue :value="sqlDetail.concurrentMax" /></el-descriptions-item><el-descriptions-item label="更新行数"><MetricValue :value="sqlDetail.updateCount" /></el-descriptions-item><el-descriptions-item label="读取行数"><MetricValue :value="sqlDetail.fetchRowCount" /></el-descriptions-item><el-descriptions-item label="最近执行">{{ parseTime(sqlDetail.lastExecuteAt) || '暂无记录' }}</el-descriptions-item><el-descriptions-item label="最近错误">{{ parseTime(sqlDetail.lastErrorAt) || '暂无记录' }}</el-descriptions-item></el-descriptions></template><template #footer><el-button @click="sqlDetail = null">关闭</el-button></template></el-dialog>
  </div>
</template>
