<script setup lang="ts">
import QuantityText from '@/components/business/production/QuantityText.vue'
import { computed, ref } from 'vue'
import { useAuth } from '@/stores/auth'
import { useBusinessWorkspace } from '@/composables/useBusinessWorkspace'
import WorkspaceReadState from '@/components/WorkspaceReadState.vue'
import WorkOrderProgress from '@/components/WorkOrderProgress.vue'
import { parseTime } from '@/utils/ruoyi'
import { treatmentActionLabel } from '@/api/quality/qualityTreatment'
defineProps<{ factoryName: string }>()
const auth = useAuth(), active = ref('reporting')
const { drafts, released, ready, running, reports, defects, loading, reload } = useBusinessWorkspace(auth)
const metrics = computed(() => [
  { title: '草稿工单待核对', resource: drafts, note: '当前工厂 · 草稿状态', unit: '张' },
  { title: '已下达工单', resource: released, note: '当前工厂 · 不代表生产已完成', unit: '张' },
  { title: '待执行状态记录', resource: ready, note: '含历史工单记录，不代表均可开工', unit: '张' },
  { title: '执行中单', resource: running, note: '当前工厂 · 执行中状态', unit: '张' }
])
const sourceLabel = (source?: string | null) => ({ LOCAL: '本地', EXTERNAL: 'ERP 同步' }[source ?? ''] ?? '来源待核实')
const readyTasks = computed(() => ready.value?.items.filter(row => row.workorderStatus === 'RELEASED') || [])
const progress = ref<{ reload: () => Promise<void>; loading: boolean } | null>(null)
function refreshWorkspace() { void reload(); void progress.value?.reload() }
</script>
<template>
  <div class="business-workspace">
    <div class="workspace-refresh"><span class="section-note">{{ factoryName }} · 真实业务数据 · 手动刷新快照</span><el-button icon="Refresh" :loading="loading || progress?.loading" @click="refreshWorkspace">刷新工作台</el-button></div>
    <div class="snapshot-grid business-metrics">
      <section v-for="metric in metrics" :key="metric.title" class="snapshot-card" :aria-busy="metric.resource.state === 'loading'">
        <header>{{ metric.title }}</header>
        <WorkspaceReadState :resource="metric.resource" @retry="reload">
          <MetricValue class="snapshot-value" :value="metric.resource.value?.total" :unit="metric.unit" />
          <p>{{ metric.note }}</p><footer class="section-note">更新于 {{ metric.resource.updatedAt }}</footer>
        </WorkspaceReadState>
      </section>
    </div>
    <WorkOrderProgress ref="progress" />
    <div class="business-console-grid">
      <section class="business-primary-console">
        <el-tabs v-model="active" aria-label="业务概览">
          <el-tab-pane :label="reports.state === 'error' ? '报工接入待办' : '近期报工'" name="reporting">
            <WorkspaceReadState :resource="reports" loading-overlay @retry="reload">
              <template #error><h3>待办：恢复近期报工接入</h3><p>近期报工读取失败，请确认后端已加载接口后重新读取。</p><p>{{ reports.error }}</p></template>
              <div class="console-caption">按流水编号倒序显示最近 10 条</div>
              <el-table :data="reports.value || []" row-key="id" empty-text="当前工厂暂无报工流水">
                <el-table-column label="工单 / 执行" min-width="185"><template #default="{ row }"><CodeText :value="row.workorderCode || row.workorderId" /><div><CodeText :value="row.executionId" /></div></template></el-table-column>
                <el-table-column label="产品 / 工序" min-width="155"><template #default="{ row }">{{ row.productName || row.productCode || '未提供' }}<div class="secondary">{{ row.operationName || row.routingNodeId }}</div></template></el-table-column>
                <el-table-column label="类型 / 数量增量" min-width="180" align="right"><template #default="{ row }">{{ row.recordType === 'REPORT' ? '报工' : row.recordType === 'ADJUSTMENT' ? '调整 / 冲销' : row.recordType }}<div><QuantityText :value="row.quantityDelta" /></div><div class="secondary">{{ row.unitName || '单位未提供' }}</div></template></el-table-column>
                <el-table-column label="报工人" min-width="110"><template #default="{ row }">{{ row.operatorName || row.operatorUserId }}</template></el-table-column>
                <el-table-column label="登记时间" min-width="170"><template #default="{ row }">{{ parseTime(row.createTime) }}</template></el-table-column>
                <el-table-column label="操作" width="100"><template #default="{ row }"><RouterLink v-if="row.executionId && auth.hasPermission('business:production:report:quantity', 'factory')" :to="{ path: '/production/productionReport', query: { executionId: row.executionId } }">查看数量</RouterLink></template></el-table-column>
              </el-table>
              <footer class="console-footer">包含历史补录、调整与冲销，数量增量不等于合格产出；单位为当前产品单位。</footer>
            </WorkspaceReadState>
          </el-tab-pane>
          <el-tab-pane :label="defects.state === 'error' ? '质量接入待办' : '不良处置流水'" name="quality">
            <WorkspaceReadState :resource="defects" loading-overlay @retry="reload">
              <template #error><h3>待办：恢复质量数据接入</h3><p>质量处置流水读取失败，请核实接口与业务库版本后重新读取。</p><p>{{ defects.error }}</p></template>
              <div class="console-caption"><span>按登记时间倒序显示最近 10 条处理记录</span><RouterLink to="/quality/productionDefect">质量管理</RouterLink></div>
              <el-table :data="defects.value || []" row-key="id" empty-text="当前工厂暂无不良处置流水">
                <el-table-column label="不良声明 / 执行" min-width="180"><template #default="{ row }"><CodeText :value="row.declarationId" /><div><CodeText :value="row.executionId" /></div></template></el-table-column>
                <el-table-column label="处理动作" min-width="160"><template #default="{ row }">{{ treatmentActionLabel(row.actionType) }}</template></el-table-column>
                <el-table-column label="处理数量" min-width="110" align="right"><template #default="{ row }"><QuantityText v-if="row.actionType === 'RETURN_NODE'" :value="row.returnedQty" /><QuantityText v-else-if="row.actionType === 'TRANSFER_WAREHOUSE'" :value="row.transferQty" /><span v-else>—</span></template></el-table-column>
                <el-table-column label="操作人" min-width="120"><template #default="{ row }">{{ row.operatorName || row.operatorUserId }}</template></el-table-column>
                <el-table-column label="入库单" min-width="160"><template #default="{ row }"><CodeText :value="row.stockDocumentId" /></template></el-table-column>
                <el-table-column label="处理时间" min-width="180"><template #default="{ row }">{{ parseTime(row.recordedAt) }}</template></el-table-column>
                <el-table-column label="登记时间" min-width="180"><template #default="{ row }">{{ parseTime(row.recordedAt) }}</template></el-table-column>
                <el-table-column prop="reason" label="处理原因" min-width="180" />
              </el-table>
              <footer class="console-footer">逐条展示申报核实、入仓和历史返回记录；处理数量为本次动作记录，不代表待处理余额。</footer>
            </WorkspaceReadState>
          </el-tab-pane>
        </el-tabs>
      </section>
      <section class="business-task-console" aria-label="工厂待办与接入事项">
        <div class="section-heading"><h2>工厂待办</h2></div>
        <p class="section-note">按当前工厂状态列出，不代表个人派工；实际操作条件由业务页校验。</p>
        <h3>草稿工单待核对</h3>
        <WorkspaceReadState :resource="drafts" @retry="reload">
          <p v-if="!drafts.value?.total" class="console-empty">暂无草稿工单</p>
          <ul v-else class="business-task-list"><li v-for="row in drafts.value?.items" :key="row.workorder.id"><CodeText :value="row.workorder.code" /><p>{{ row.productName || row.productCode }} · {{ sourceLabel(row.workorder.source) }}</p></li></ul>
          <RouterLink to="/production/workorder">打开工单列表（共 {{ drafts.value?.total }} 张）</RouterLink>
        </WorkspaceReadState>
        <h3>待执行单核对</h3>
        <WorkspaceReadState :resource="ready" @retry="reload">
          <p class="section-note">仅列本次前 6 条中所属工单已下达的记录。</p>
          <p v-if="!readyTasks.length" class="console-empty">本次读取无匹配待办，可在执行列表继续查询。</p>
          <ul v-else class="business-task-list"><li v-for="row in readyTasks" :key="row.id"><RouterLink :to="{ path: '/production/mesProductionExecution', query: { workorderId: row.workorderId } }"><CodeText :value="row.id" /></RouterLink><p>核对实际路径、派工与开工条件</p></li></ul>
          <RouterLink to="/production/mesProductionExecution">打开执行列表</RouterLink>
        </WorkspaceReadState>
        <details class="module-disclosure"><summary>待接入事项</summary><p class="section-note">首检 / 巡检任务、班次计划、工时采集尚无完整数据契约，暂不提供数量与合格率。</p></details>
      </section>
    </div>
  </div>
</template>
