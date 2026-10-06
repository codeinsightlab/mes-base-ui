<template>
  <el-drawer
    :model-value="true"
    :with-header="false"
    size="76%"
    :append-to-body="true"
    :wrapper-closable="true"
    class="production-monitor-drawer"
    @close="$emit('close')"
  >
    <div v-loading="detailLoading" class="detail-shell">
      <div class="detail-header">
        <div><div class="detail-title">工单详情</div><div class="detail-subtitle">{{ detail ? displayValue(detail.workorderCode) : '正在读取工单…' }}</div></div>
        <el-button circle aria-label="关闭工单详情" @click="$emit('close')" />
      </div>
      <template v-if="detail">
        <div class="detail-summary">
          <div><span>生产进度</span><strong>{{ formatRatio(detail.completionRatio) }}</strong></div>
          <div><span>MES 已生产量</span><strong>{{ formatNumber(detail.quantityProduced) }}</strong></div>
          <div><span>计划量</span><strong>{{ formatNumber(detail.quantity) }}</strong></div>
          <div><span>最近报工记录</span><strong class="summary-time">{{ formatTime(detail.lastReportingTime, '{m}-{d} {h}:{i}') }}</strong></div>
          <div><span>不良记录数</span><strong>{{ formatNumber(detail.defectiveRecordCount) }}</strong></div>
          <div><span>计划完工日</span><strong class="summary-time">{{ formatTime(detail.finishDate, '{y}-{m}-{d}') }}</strong></div>
        </div>
        <el-tabs v-model="activeTab" class="detail-tabs">
          <el-tab-pane label="基本信息" name="basic">
            <el-tag
              v-for="tag in detail.riskTags"
              :key="tag.code"
              :type="RISK_TAG_STYLE[tag.code] || 'info'"
              size="small"
              effect="plain"
              class="risk-tag"
            >{{ tag.label }}</el-tag>
            <h4 class="detail-group-title">工单与产品</h4>
            <el-descriptions :column="2" border class="detail-descriptions">
              <el-descriptions-item label="工单号">{{ displayValue(detail.workorderCode) }}</el-descriptions-item>
              <el-descriptions-item label="工单名称">{{ displayValue(detail.workorderName) }}</el-descriptions-item>
              <el-descriptions-item label="品号">{{ displayValue(detail.productCode) }}</el-descriptions-item>
              <el-descriptions-item label="产品">{{ displayValue(detail.productName) }}</el-descriptions-item>
              <el-descriptions-item label="规格">{{ displayValue(detail.productSpc) }}</el-descriptions-item>
              <el-descriptions-item label="单位">{{ displayValue(detail.unitOfMeasure) }}</el-descriptions-item>
              <el-descriptions-item label="状态">{{ displayValue(detail.statusName) }}</el-descriptions-item>
            </el-descriptions>
            <h4 class="detail-group-title">计划与数量</h4>
            <el-descriptions :column="2" border class="detail-descriptions">
              <el-descriptions-item label="计划数量">{{ formatNumber(detail.quantity) }}</el-descriptions-item>
              <el-descriptions-item label="MES 已生产量（存储值）">{{ formatNumber(detail.quantityProduced) }}</el-descriptions-item>
              <el-descriptions-item label="生产进度">{{ formatRatio(detail.completionRatio) }}</el-descriptions-item>
              <el-descriptions-item label="请求日期">{{ formatTime(detail.requestDate) }}</el-descriptions-item>
              <el-descriptions-item label="交易日期">{{ formatTime(detail.transactionDate) }}</el-descriptions-item>
              <el-descriptions-item label="计划完工日">{{ formatTime(detail.finishDate, '{y}-{m}-{d}') }}</el-descriptions-item>
            </el-descriptions>
            <h4 class="detail-group-title">客户 / 来源 / 最近活动</h4>
            <el-descriptions :column="2" border class="detail-descriptions">
              <el-descriptions-item label="订单来源">{{ displayValue(detail.orderSource) }}</el-descriptions-item>
              <el-descriptions-item label="来源单号">{{ displayValue(detail.sourceCode) }}</el-descriptions-item>
              <el-descriptions-item label="客户编码">{{ displayValue(detail.clientCode) }}</el-descriptions-item>
              <el-descriptions-item label="客户">{{ displayValue(detail.clientName) }}</el-descriptions-item>
              <el-descriptions-item label="最近报工记录时间">{{ formatTime(detail.lastReportingTime) }}</el-descriptions-item>
              <el-descriptions-item label="最近报工工序">{{ displayValue(detail.lastProcessName) }}</el-descriptions-item>
              <el-descriptions-item label="最近报工账号">{{ displayValue(detail.lastUserName) }}</el-descriptions-item>
              <el-descriptions-item label="最近报工昵称">{{ displayValue(detail.lastNickName) }}</el-descriptions-item>
              <el-descriptions-item label="报工覆盖说明" :span="2">
                <el-tooltip
                  v-if="detail.reportingCoverage === COVERAGE.NO_RECORD"
                  content="仅表示当前报工表未发现关联记录，不代表零产量、停工或尚未生产。"
                >
                  <el-tag type="info" size="small">无报工关联</el-tag>
                </el-tooltip>
                <el-tag v-else-if="detail.reportingCoverage === COVERAGE.HAS_RECORD" size="small">有报工记录</el-tag><span v-else>—</span>
              </el-descriptions-item>
            </el-descriptions>
          </el-tab-pane>
          <el-tab-pane label="流程卡轨迹" name="flowcards">
            <workorder-flowcards :workorder-id="detail.workorderId" :flowcards="detail.flowcards" @view-logs="openReportingLogs" />
          </el-tab-pane>
          <el-tab-pane label="报工日志" name="events">
            <workorder-timeline :workorder-id="detail.workorderId" :active="activeTab === 'events'" :filter="timelineFilter" :filter-reset-key="timelineFilterRevision" @clear-filter="clearTimelineFilter" />
          </el-tab-pane>
        </el-tabs>
      </template>
      <el-empty v-else-if="!detailLoading" :description="detailLoadError ? '工单详情加载失败，请重试。' : '当前工厂未读取到工单详情'">
        <el-button v-if="detailLoadError" type="primary" size="small" @click="loadDetail">重试</el-button>
      </el-empty>
    </div>
  </el-drawer>
</template>

<script>
import { parseTime } from '@/utils/ruoyi'
import { getProductionMonitorWorkorder } from '@/api/pro/productionMonitor'
import { COVERAGE, RISK_TAG_STYLE } from '../constants'
import WorkorderTimeline from './WorkorderTimeline.vue'
import WorkorderFlowcards from './WorkorderFlowcards.vue'

export default {
  name: 'ProductionMonitorWorkorderDetail',
  components: { WorkorderTimeline, WorkorderFlowcards },
  props: { workorderId: { type: Number, required: true }},
  data() { return { COVERAGE, RISK_TAG_STYLE, detail: null, detailLoading: false, detailLoadError: false, activeTab: 'basic', requestSequence: 0, timelineFilter: {}, timelineFilterRevision: 0 } },
  watch: { workorderId() { this.loadDetail() } },
  created() { this.loadDetail() },
  methods: {
    openReportingLogs(filter) {
      this.timelineFilter = Object.assign({}, filter)
      this.timelineFilterRevision++
      this.activeTab = 'events'
    },
    clearTimelineFilter() {
      this.timelineFilter = {}
      this.timelineFilterRevision++
    },
    async loadDetail() {
      const sequence = ++this.requestSequence
      this.detailLoading = true
      this.detail = null
      this.detailLoadError = false
      try {
        const response = await getProductionMonitorWorkorder(this.workorderId)
        if (sequence === this.requestSequence) {
          this.detail = response.data
          this.activeTab = this.detail.reportCount > 0 ? 'flowcards' : 'basic'
        }
      } catch (error) {
        if (sequence === this.requestSequence) {
          this.detailLoadError = true
          if (error && error.message === '工单不存在') {
            this.$emit('close')
            this.$modal.msgError('工单不存在或当前工厂无权限访问。')
          }
        }
      } finally { if (sequence === this.requestSequence) this.detailLoading = false }
    },
    coverageLabel(value) {
      if (value === COVERAGE.NO_RECORD) return '无报工关联'
      if (value === COVERAGE.HAS_RECORD) return '有报工记录'
      return '—'
    },
    displayValue(value) { return value === null || value === undefined || value === '' ? '—' : value },
    formatNumber(value) { return value === null || value === undefined ? '—' : String(value) },
    formatRatio(value) { return value === null || value === undefined ? '—' : (Number(value) * 100).toFixed(2) + '%' },
    formatTime(value, pattern) { return parseTime(value, pattern) || '—' }
  }
}
</script>

<style scoped>
.detail-shell { min-height: 100%; padding: 18px 22px 26px; box-sizing: border-box; }
.detail-header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 15px; border-bottom: 1px solid #ebeef5; }
.detail-title { color: var(--ui-text); font-size: 18px; font-weight: 600; }
.detail-subtitle { margin-top: 5px; color: var(--ui-text-muted); font-size: 13px; }
.detail-summary { display: grid; grid-template-columns: repeat(6, minmax(100px, 1fr)); gap: 9px; margin: 14px 0; }
.detail-summary > div { display: flex; flex-direction: column; gap: 8px; padding: 12px; background: #f7f8fa; border-radius: 4px; }
.detail-summary span { color: var(--ui-text-muted); font-size: 12px; }
.detail-summary strong { color: var(--ui-text); font-size: 18px; }
.detail-summary strong.summary-time { font-size: 14px; }
.detail-tabs { margin-top: 12px; }
.detail-descriptions { margin-top: 14px; }
.detail-group-title { margin: 18px 0 -4px; color: #566273; font-size: 13px; font-weight: 600; }
.risk-tag { margin-right: 4px; }
@media (max-width: 1100px) { .detail-summary { grid-template-columns: repeat(3, minmax(110px, 1fr)); } }
@media (max-width: 700px) { .detail-summary { grid-template-columns: repeat(2, minmax(110px, 1fr)); } }
</style>
