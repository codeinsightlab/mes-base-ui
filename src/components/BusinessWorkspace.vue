<script setup lang="ts">
import { computed, ref } from 'vue'
import { sampleOrders, sampleReports, sampleInspections, sampleTasks, sampleSummary } from '@/lib/businessWorkspaceSample'
defineProps<{ factoryName: string }>()
const active = ref('production'), taskKind = ref('全部'), detail = ref<{ title: string; code: string; text: string } | null>(null)
const tasks = computed(() => sampleTasks.filter(item => taskKind.value === '全部' || item.kind === taskKind.value))
const metrics = [
  { title: '计划 / 已完成', value: sampleSummary.completed, unit: '件', note: '计划 ' + sampleSummary.planned + ' 件', icon: 'Tickets' },
  { title: '生产达成率', value: (sampleSummary.completed / sampleSummary.planned * 100).toFixed(1), unit: '%', note: '当前演示班次', icon: 'TrendCharts' },
  { title: '报工合格率', value: (sampleSummary.accepted / sampleSummary.completed * 100).toFixed(1), unit: '%', note: '合格 ' + sampleSummary.accepted + ' 件', icon: 'CircleCheck' },
  { title: '待检验 / 异常', value: sampleTasks.filter(item => item.kind === '检验').length, unit: '项待检', note: sampleTasks.filter(item => item.kind === '异常').length + ' 项异常待处置', icon: 'Warning' }
]
</script>
<template>
  <div class="business-workspace">
    <div class="sample-disclosure" role="note"><span class="sample-data-label">示例数据</span><span>用于展示 {{ factoryName }} 的工作台布局；生产、报工和检验尚未接入业务系统。</span><span class="section-note">演示班次 · 白班</span></div>
    <div class="snapshot-grid business-metrics"><section v-for="metric in metrics" :key="metric.title" class="snapshot-card"><header><span><el-icon><component :is="metric.icon" /></el-icon>{{ metric.title }}</span><span class="sample-caption">示例数据</span></header><MetricValue class="snapshot-value" :value="metric.value" :unit="metric.unit" /><p>{{ metric.note }}</p></section></div>
    <div class="business-console-grid">
      <section class="business-primary-console">
        <el-tabs v-model="active" aria-label="业务概览">
          <el-tab-pane label="生产概览" name="production">
            <div class="console-caption"><span>{{ sampleOrders.length }} 个演示工单</span><span class="sample-caption">示例数据</span></div>
            <el-table :data="[...sampleOrders]" empty-text="暂无示例工单">
              <el-table-column label="工单 / 产品" min-width="185"><template #default="{ row }"><CodeText :value="row.code" /><div class="secondary">{{ row.product }}</div></template></el-table-column>
              <el-table-column label="产线 / 工序" min-width="120"><template #default="{ row }">{{ row.line }}<div class="secondary">{{ row.process }}</div></template></el-table-column>
              <el-table-column label="完成 / 计划" min-width="140" align="right"><template #default="{ row }"><MetricValue :value="row.completed" /><span class="secondary"> / {{ row.planned }} 件</span><el-progress :percentage="Math.round(row.completed / row.planned * 100)" :show-text="false" :stroke-width="4" /></template></el-table-column>
              <el-table-column label="状态" min-width="125"><template #default="{ row }"><StatusTag :label="row.status" :tone="row.status === '异常待处理' ? 'error' : row.status === '待检验' ? 'warning' : 'running'" /></template></el-table-column>
              <el-table-column label="操作" width="98" fixed="right"><template #default="{ row }"><el-button link type="primary" @click="detail = { title: row.product, code: row.code, text: row.line+' · '+row.process+'；交付：'+row.delivery+'。该记录仅供工作台布局演示。' }">查看示例</el-button></template></el-table-column>
            </el-table>
          </el-tab-pane>
          <el-tab-pane label="近期报工" name="reporting">
            <div class="console-caption"><span>演示班次报工记录</span><span class="sample-caption">示例数据</span></div>
            <el-table :data="[...sampleReports]"><el-table-column label="报工 / 工单" min-width="185"><template #default="{ row }"><CodeText :value="row.code" /><div><CodeText :value="row.order" /></div></template></el-table-column><el-table-column prop="process" label="工序" min-width="100" /><el-table-column label="报工 / 合格" min-width="120" align="right"><template #default="{ row }"><MetricValue :value="row.quantity" /> / {{ row.qualified }}</template></el-table-column><el-table-column label="工时" width="95" align="right"><template #default="{ row }"><MetricValue :value="row.hours" unit="h" /></template></el-table-column><el-table-column prop="time" label="演示时间" width="100" /><el-table-column label="状态" min-width="110"><template #default="{ row }"><StatusTag :label="row.status" :tone="row.status === '已确认' ? 'success' : 'warning'" /></template></el-table-column></el-table>
          </el-tab-pane>
          <el-tab-pane label="质量检验" name="quality">
            <div class="console-caption"><span>检验任务与判定</span><span class="sample-caption">示例数据</span></div>
            <el-table :data="[...sampleInspections]"><el-table-column label="检验 / 工单" min-width="185"><template #default="{ row }"><CodeText :value="row.code" /><div><CodeText :value="row.order" /></div></template></el-table-column><el-table-column prop="type" label="检验类型" min-width="110" /><el-table-column label="抽样" width="95" align="right"><template #default="{ row }"><MetricValue :value="row.samples" unit="件" /></template></el-table-column><el-table-column label="任务状态" min-width="110"><template #default="{ row }"><StatusTag :label="row.status" :tone="row.status === '已完成' ? 'success' : 'warning'" /></template></el-table-column><el-table-column label="判定" min-width="110"><template #default="{ row }"><StatusTag :label="row.result" :tone="row.result === '合格' ? 'success' : 'disabled'" /></template></el-table-column></el-table>
          </el-tab-pane>
        </el-tabs>
        <footer class="console-footer">示例数据 · 不计入实际生产统计，不支持业务提交。</footer>
      </section>
      <section class="business-task-console" aria-label="示例待办任务">
        <div class="section-heading"><h2>待办任务 <span class="sample-caption">示例数据</span></h2><MetricValue :value="sampleTasks.length" unit="项" /></div>
        <el-radio-group v-model="taskKind" size="small" aria-label="筛选示例待办"><el-radio-button v-for="kind in ['全部', '报工', '检验', '异常']" :key="kind" :value="kind">{{ kind }}</el-radio-button></el-radio-group>
        <ul class="business-task-list"><li v-for="task in tasks" :key="task.code"><button type="button" @click="detail = { title: task.title, code: task.code, text: task.detail+'；关联工单：'+task.order+'。' }"><div><strong>{{ task.title }}</strong><StatusTag :label="task.priority" :tone="task.tone" /></div><CodeText :value="task.order" /><p>{{ task.detail }}</p></button></li></ul>
      </section>
    </div>
    <el-dialog :model-value="!!detail" title="任务 / 工单示例" width="520px" @close="detail = null"><div class="sample-disclosure"><span class="sample-data-label">示例数据</span><span>业务系统尚未接入</span></div><h3>{{ detail?.title }}</h3><CodeText :value="detail?.code" /><p>{{ detail?.text }}</p><template #footer><el-button @click="detail = null">关闭</el-button></template></el-dialog>
  </div>
</template>
