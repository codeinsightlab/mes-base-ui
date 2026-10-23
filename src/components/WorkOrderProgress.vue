<script setup lang="ts">
import QueryForm from '@/components/QueryForm.vue'

import QuantityText from '@/components/business/production/QuantityText.vue'
import { useAuth } from '@/stores/auth'
import { useWorkOrderProgress } from '@/composables/useWorkOrderProgress'
import WorkspaceReadState from '@/components/WorkspaceReadState.vue'
import Pagination from '@/components/Pagination/index.vue'
import { parseTime } from '@/utils/ruoyi'
const auth = useAuth()
const { workorderCode, productCode, status, page, limit, result, loading, allowed, load, search, reset, paginate } = useWorkOrderProgress(auth)
const orderStatus = (value: string) => ({ DRAFT: '草稿', RELEASED: '已下达', CANCELLED: '已作废', COMPLETED: '已完工' }[value] ?? value)
const bar = (percent: string | null) => percent == null ? 0 : Math.max(0, Math.min(100, Number(percent)))
defineExpose({ reload: load, loading })
</script>
<template>
  <section class="panel workorder-progress" aria-label="工单进度">
    <div class="section-heading"><h2>工单进度</h2><span v-if="result.updatedAt" class="section-note">更新于 {{ result.updatedAt }}</span></div>
    <p class="section-note">入库收尾贡献为完全入库执行的正常品入库量与有效不良损失之和；不良入仓不再重复计入。待收尾差额＝计划－入库收尾贡献（最低为 0），合格品缺口＝计划－正常品入库量。历史返回事实保留，入仓后流转和最终处置由仓储办理。</p>
    <QueryForm v-if="allowed" inline class="filter-panel" @submit="search">
      <el-form-item label="工单号"><el-input v-model="workorderCode" aria-label="工单号前缀" placeholder="按工单号前缀查询" maxlength="64" clearable /></el-form-item>
      <el-form-item label="产品编码"><el-input v-model="productCode" aria-label="产品编码前缀" placeholder="按产品编码前缀查询" maxlength="64" clearable /></el-form-item>
      <el-form-item label="工单状态"><el-select v-model="status" aria-label="工单进度状态" clearable placeholder="未作废工单" style="width: 170px"><el-option value="ALL" label="全部（含已作废）" /><el-option v-for="s in ['DRAFT', 'RELEASED', 'COMPLETED', 'HISTORICAL', 'CANCELLED']" :key="s" :value="s" :label="orderStatus(s)" /></el-select></el-form-item>
      <el-form-item><el-button type="primary" native-type="submit" :loading="loading">查询</el-button><el-button native-type="button" @click="reset">重置</el-button></el-form-item>
    </QueryForm>
    <WorkspaceReadState :resource="result" loading-overlay @retry="load">
      <el-table :data="result.value?.items || []" row-key="id" empty-text="未找到匹配工单" style="width: 100%">
        <el-table-column label="工单 / 产品" min-width="200"><template #default="{ row }"><CodeText :value="row.code" /><div class="secondary">{{ row.productName || row.productCode || '产品名称未提供' }}</div></template></el-table-column>
        <el-table-column label="状态 / 来源" min-width="120"><template #default="{ row }"><StatusTag :label="orderStatus(row.status)" /><div class="secondary">{{ row.source === 'LOCAL' ? '本地' : row.source === 'EXTERNAL' ? 'ERP 同步' : '来源待核实' }}</div></template></el-table-column>
        <el-table-column label="计划数量" min-width="160" align="right"><template #default="{ row }"><QuantityText :value="row.plannedQty" /><div class="secondary">{{ row.unitName || '单位未提供' }}</div></template></el-table-column>
        <el-table-column label="入库收尾贡献（含不良损失）" min-width="160" align="right"><template #default="{ row }"><QuantityText :value="row.completedQty" /></template></el-table-column>

        <el-table-column label="不良入仓进度" min-width="200"><template #default="{ row }"><template v-if="row.qualityUntreatedQty != null"><div v-if="Number(row.qualityTransferredQty) > 0">已入仓：<QuantityText :value="row.qualityTransferredQty" /></div><div>未处理：<QuantityText :value="row.qualityUntreatedQty" /></div><div v-if="Number(row.qualityReturnedQty) > 0">历史已返回：<QuantityText :value="row.qualityReturnedQty" /></div><div v-if="Number(row.qualityUnverifiedQty) > 0">未处理（待核实申报）：<QuantityText :value="row.qualityUnverifiedQty" /></div></template><span v-else>{{ row.issue || '未取得处置统计' }}</span></template></el-table-column>
        <el-table-column label="待收尾差额" min-width="160" align="right"><template #default="{ row }"><QuantityText :value="row.pendingCompletionQty" /><div class="secondary">合格品缺口：<QuantityText :value="row.goodOutputGapQty" /></div></template></el-table-column>
        <el-table-column label="入库收尾达成率" min-width="200"><template #default="{ row }"><template v-if="row.completionPercent != null"><MetricValue :value="row.completionPercent" unit="%" /><span v-if="Number(row.completionPercent) > 100" class="secondary"> · 超计划</span><el-progress :percentage="bar(row.completionPercent)" :show-text="false" :stroke-width="6" /></template><span v-else>{{ row.issue || '无法计算' }}</span></template></el-table-column>
        <el-table-column label="工单创建时间" min-width="180"><template #default="{ row }">{{ parseTime(row.createTime) || '—' }}</template></el-table-column>
        <el-table-column label="最近完全入库" min-width="170"><template #default="{ row }">{{ parseTime(row.lastCompletedAt) || '尚无完全入库记录' }}</template></el-table-column>
        <el-table-column label="操作" width="110" fixed="right"><template #default="{ row }"><RouterLink v-if="auth.hasPermission('business:mes:production:execution:list', 'factory')" :to="{ path: '/production/mesProductionExecution', query: { workorderId: row.id } }">查看执行</RouterLink></template></el-table-column>
      </el-table>
      <Pagination v-model:page="page" v-model:limit="limit" :total="result.value?.total || 0" :page-sizes="[5, 10, 20, 50]" :auto-scroll="false" @pagination="paginate" />
    </WorkspaceReadState>
  </section>
</template>
<style scoped>
.workorder-progress { margin-bottom: var(--ui-space-4); padding: var(--ui-space-4); min-width: 0; }
.workorder-progress :deep(.filter-panel .el-input) { width: 260px !important; max-width: 100%; }
</style>
