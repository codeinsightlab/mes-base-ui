<template>
  <div class="app-container production-monitor">
    <div class="page-heading">
      <div><h2>生产监控</h2><span>{{ dashboardContext.month }} · 当前工单 {{ summary ? summary.totalWorkorders : '—' }}</span></div>
      <div class="heading-actions"><span v-if="summaryFetchedAt">读取于 {{ summaryFetchedAt }}</span><el-button :loading="summaryLoading || listLoading" @click="refresh">刷新</el-button></div>
    </div>

    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="filterDraft" @submit.prevent="search">
        <el-form-item label="月份"><el-date-picker v-model="dashboardContext.month" type="month" value-format="YYYY-MM" :clearable="false" @change="changeMonth" /></el-form-item>
        <el-form-item label="状态"><el-select v-model="filterDraft.status" clearable placeholder="全部状态" style="width:130px" @change="filterDraft.inProductionOnly = false"><el-option v-for="item in statuses" :key="item.statusCode" :label="item.statusName" :value="item.statusCode" /></el-select></el-form-item>
        <el-form-item label="工单号"><el-input v-model.trim="filterDraft.workorderCode" clearable placeholder="工单号" style="width:155px" @keyup.enter="search" /></el-form-item>
        <el-form-item label="产品"><el-input v-model.trim="filterDraft.productCode" clearable placeholder="品号" style="width:130px" @keyup.enter="search" /></el-form-item>
        <el-form-item label="提醒"><el-select v-model="filterDraft.riskTag" clearable filterable placeholder="全部提醒" style="width:175px"><el-option v-for="code in productionRiskCodes" :key="code" :label="riskTagOptionLabel(code)" :value="code" /></el-select></el-form-item>
        <el-form-item><el-button type="primary" @click="search">查询</el-button><el-button @click="reset">重置</el-button></el-form-item>
        <el-form-item><el-button link @click="moreFilters = !moreFilters">{{ moreFilters ? '收起筛选' : '更多筛选' }}<i :class="moreFilters ? 'el-icon-arrow-up' : 'el-icon-arrow-down'" /></el-button></el-form-item>
        <template v-if="moreFilters">
          <el-form-item label="数据覆盖"><el-select v-model="filterDraft.coverage" clearable placeholder="全部" style="width:150px"><el-option label="有报工记录" :value="COVERAGE.HAS_RECORD" /><el-option label="无报工关联" :value="COVERAGE.NO_RECORD" /></el-select></el-form-item>
          <el-form-item label="计划完工日"><el-date-picker v-model="filterDraft.finishDateFrom" type="date" value-format="YYYY-MM-DD" placeholder="开始日期" clearable style="width:140px" /><span class="date-separator">至</span><el-date-picker v-model="filterDraft.finishDateTo" type="date" value-format="YYYY-MM-DD" placeholder="结束日期" clearable style="width:140px" /></el-form-item>
        </template>
      </el-form>
    </el-card>

    <div v-loading="summaryLoading" class="kpi-grid">
      <button class="kpi-card" :class="{ active: isProductionFilterActive }" type="button" @click="toggleFilter('inProductionOnly')"><span class="kpi-icon blue"><i class="el-icon-odometer" /></span><span class="kpi-label">生产中工单</span><strong>{{ summary ? summary.inProductionCount : '—' }}</strong><small>按后端状态统计</small></button>
      <button class="kpi-card attention-kpi" :class="{ active: filters.attentionOnly }" type="button" @click="toggleFilter('attentionOnly')"><span class="kpi-icon orange"><i class="el-icon-warning-outline" /></span><span class="kpi-label">需要关注</span><strong>{{ summaryValue('attentionWorkorderCount') }}</strong><small>生产关注工单去重数</small></button>
      <button class="kpi-card" :class="{ active: filters.coverage === COVERAGE.HAS_RECORD }" type="button" @click="toggleCoverage(COVERAGE.HAS_RECORD)"><span class="kpi-icon green"><i class="el-icon-time" /></span><span class="kpi-label">有报工活动</span><strong>{{ summary ? summary.reportingCoveredCount : '—' }}</strong><small>发现报工表关联记录</small></button>
      <button class="kpi-card" :class="{ active: filters.riskTag === 'HAS_DEFECTIVE_RECORD' }" type="button" @click="toggleRiskTag('HAS_DEFECTIVE_RECORD')"><span class="kpi-icon red"><i class="el-icon-circle-close" /></span><span class="kpi-label">存在不良</span><strong>{{ summary ? summary.defectiveWorkorderCount : '—' }}</strong><small>存在不良记录的工单</small></button>
    </div>

    <div v-if="summaryError" class="summary-error"><el-alert title="摘要加载失败，图表和统计暂不可用。" type="error" :closable="false" show-icon /><el-button link @click="loadSummary">重试</el-button></div>

    <div class="charts-grid">
      <el-card shadow="never" class="chart-card"><template #header><div class="chart-heading"><span>工单状态分布</span><small>点击状态筛选工单</small></div></template><div v-loading="summaryLoading" class="status-chart">
        <button v-for="item in statuses" :key="String(item.statusCode)" class="bar-row" :class="{ selected: isStatusFilterActive(item) }" type="button" @click="toggleStatus(item)"><span class="bar-label">{{ item.statusName }}</span><span class="bar-track"><i :style="{ width: barWidth(item.count, statusMax) }" /></span><strong>{{ item.count }}</strong></button>
        <el-empty v-if="!summaryLoading && !statuses.length" :description="summaryError ? '状态分布加载失败' : '暂无状态数据'" :image-size="54" />
      </div></el-card>
      <el-card shadow="never" class="chart-card"><template #header><div class="chart-heading"><span>生产进度分布</span><el-tooltip content="根据 MES 已生产量与计划数量计算"><i class="el-icon-info info-icon" /></el-tooltip></div></template><div v-loading="summaryLoading" class="bucket-chart">
        <div v-for="item in completionBuckets" :key="item.label" class="bucket-item"><span class="bucket-count">{{ item.count }}</span><span class="bucket-track"><i :style="{ height: barWidth(item.count, completionMax) }" /></span><small>{{ item.label }}</small></div>
        <el-empty v-if="!summaryLoading && !completionBuckets.length" :description="summaryError ? '完成比例分布加载失败' : '后端尚未提供完整集合分布'" :image-size="54" />
      </div></el-card>
      <el-card shadow="never" class="chart-card alerts-card"><template #header><div class="chart-heading"><span>异常与提醒</span><small>生产关注与数据完整性分开统计</small></div></template><div v-loading="summaryLoading" class="alert-chart">
        <div class="alert-section"><h4>生产关注</h4><button v-for="item in productionAlerts" :key="item.code" class="bar-row alert-row" :class="{ selected: filters.riskTag === item.code }" type="button" @click="toggleRiskTag(item.code)"><span class="bar-label"><i :class="'level-' + item.level" />{{ item.label }}</span><span class="bar-track"><i :style="{ width: barWidth(item.count, productionAlertMax) }" /></span><strong>{{ item.count }}</strong></button><p v-if="!productionAlerts.length" class="chart-empty">{{ summaryError ? '提醒统计加载失败' : '后端尚未提供逐类提醒统计' }}</p></div>
        <div class="integrity-callout"><span>数据完整性</span><strong>{{ noReportingCount === null ? '—' : noReportingCount }}</strong><span>张工单无报工关联</span><el-button link @click="toggleCoverage(COVERAGE.NO_RECORD)">查看</el-button></div>
      </div></el-card>
    </div>

    <el-card shadow="never" class="table-card">
      <template #header><div class="table-heading">
        <div class="table-heading-context"><strong>工单</strong></div>
        <div class="table-heading-actions"><span class="table-total">共 {{ total }} 条</span></div>
      </div></template>
      <div class="active-filters"><span class="active-filters-label">当前筛选</span><span v-if="!activeFilters.length" class="active-filters-empty">无额外筛选</span><el-tag v-for="filter in activeFilters" :key="filter.key" size="small" closable @close="removeActiveFilter(filter.key)">{{ filter.label }}</el-tag></div>
      <el-table v-loading="listLoading" :data="rows" row-key="workorderId" stripe>
        <el-table-column label="工单号" prop="workorderCode" min-width="132" fixed="left" show-overflow-tooltip />
        <el-table-column label="产品" min-width="150"><template #default="{ row }"><div>{{ displayValue(row.productCode) }}</div><el-tooltip :content="displayValue(row.productName)" placement="top"><small class="muted product-name">{{ displayValue(row.productName) }}</small></el-tooltip></template></el-table-column>
        <el-table-column label="状态" prop="statusName" width="80"><template #default="{ row }">{{ displayValue(row.statusName) }}</template></el-table-column>
        <el-table-column min-width="165"><template #header><el-tooltip content="根据 MES 当前已生产量 / 计划数量计算。"><span>生产进度<i class="el-icon-info info-icon" /></span></el-tooltip></template><template #default="{ row }"><div v-if="row.completionRatio !== null && row.completionRatio !== undefined" class="progress-cell"><div><span>{{ formatNumber(row.quantityProduced) }} / {{ formatNumber(row.quantity) }}</span><strong>{{ formatRatio(row.completionRatio) }}</strong></div><el-progress :percentage="progressPercent(row.completionRatio)" :show-text="false" :stroke-width="6" /></div><span v-else>—</span></template></el-table-column>
        <el-table-column label="计划完工日" prop="finishDate" width="110"><template #default="{ row }">{{ formatTime(row.finishDate, '{y}-{m}-{d}') }}</template></el-table-column>
        <el-table-column label="最近报工" min-width="130"><template #default="{ row }"><template v-if="row.lastReportingTime"><div>{{ formatTime(row.lastReportingTime, '{m}-{d} {h}:{i}') }}</div><small class="muted">{{ displayValue(row.lastProcessName) }} · {{ displayValue(row.lastUserName) }}</small></template><span v-else>—</span></template></el-table-column>
        <el-table-column label="数据状态" width="105"><template #default="{ row }"><el-tooltip v-if="row.reportingCoverage === COVERAGE.NO_RECORD" content="仅表示当前报工表未发现关联记录。"><el-tag type="info" size="small">无报工关联</el-tag></el-tooltip><el-tag v-else-if="row.reportingCoverage === COVERAGE.HAS_RECORD" size="small">有报工记录</el-tag><span v-else>—</span></template></el-table-column>
        <el-table-column label="提醒" min-width="160"><template #default="{ row }"><template v-for="tag in visibleRiskTags(row)" :key="tag.code"><el-tag :type="RISK_TAG_STYLE[tag.code] || 'info'" size="small" effect="plain" class="risk-tag">{{ tag.label }}</el-tag></template><el-popover v-if="productionRiskTags(row).length > 1" trigger="hover" placement="top"><div class="risk-popover-list"><el-tag v-for="tag in productionRiskTags(row)" :key="tag.code" :type="RISK_TAG_STYLE[tag.code] || 'info'" size="small" effect="plain">{{ tag.label }}</el-tag></div><template #reference><el-tag size="small" type="info">+{{ productionRiskTags(row).length - 1 }}</el-tag></template></el-popover><span v-if="!productionRiskTags(row).length" class="muted">—</span></template></el-table-column>
        <el-table-column label="操作" width="70" fixed="right"><template #default="{ row }"><el-button v-permission="{code:'mes:pro:productionMonitor:query',scope:'factory'}" link @click="openDetail(row)">详情</el-button></template></el-table-column>
      </el-table>
      <div v-if="listError" class="list-error"><el-alert :title="listError" type="error" :closable="false" show-icon /><el-button link @click="loadWorkorders">重试</el-button></div>
      <el-empty v-else-if="!listLoading && total === 0" :description="summary && summary.totalWorkorders === 0 ? '当前月份暂无工单' : '没有符合当前筛选条件的工单'" />
      <pagination v-show="total > 0" v-model:page="filters.pageNum" v-model:limit="filters.pageSize" :total="total" :page-sizes="[10, 20, 50]" @pagination="loadWorkorders" />
    </el-card>
    <workorder-detail v-if="detailVisible" :workorder-id="selectedWorkorderId" @close="closeDetail" />
  </div>
</template>

<script>
import { dayjs } from 'element-plus'
import { parseTime } from '@/utils/ruoyi'
import { getProductionMonitorSummary, listProductionMonitorWorkorders } from '@/api/pro/productionMonitor'
import { COVERAGE, RISK_TAG_CODES, RISK_TAG_STYLE } from './constants'
import WorkorderDetail from './components/WorkorderDetail.vue'

export default {
  name: 'ProductionMonitor',
  components: { WorkorderDetail },
  data() {
    return {
      COVERAGE, RISK_TAG_STYLE, summary: null, summaryLoading: false, listLoading: false, rows: [], total: 0,
      detailVisible: false, selectedWorkorderId: null, moreFilters: false,
      summarySequence: 0, listSequence: 0, summaryError: '', listError: '', summaryFetchedAt: '',
      dashboardContext: { month: dayjs().format('YYYY-MM') }, filters: this.emptyFilters(), filterDraft: this.emptyFilters()
    }
  },
  computed: {
    statuses() { return this.summary && this.summary.statusCounts ? this.summary.statusCounts : [] },
    productionStatusCode() { const status = this.statuses.find(item => item.statusName === '生产中'); return status ? status.statusCode : null },
    isProductionFilterActive() { return this.filters.inProductionOnly || (this.productionStatusCode !== null && this.filters.status === this.productionStatusCode) },
    productionRiskCodes() { return RISK_TAG_CODES.filter(code => code !== 'NO_REPORTING_RECORD') },
    completionBuckets() { return this.summary && this.summary.completionBuckets ? this.summary.completionBuckets : [] },
    productionAlerts() { return this.summary && this.summary.alertCounts ? this.summary.alertCounts.filter(item => item.category === 'PRODUCTION') : [] },
    noReportingCount() {
      const dataAlert = this.summary && this.summary.alertCounts && this.summary.alertCounts.find(item => item.code === 'NO_REPORTING_RECORD' && item.category === 'DATA')
      return dataAlert ? dataAlert.count : null
    },
    statusMax() { return Math.max(0, ...this.statuses.map(item => Number(item.count))) },
    completionMax() { return Math.max(0, ...this.completionBuckets.map(item => Number(item.count))) },
    productionAlertMax() { return Math.max(0, ...this.productionAlerts.map(item => Number(item.count))) },
    activeFilters() {
      const applied = this.filters
      const filters = []
      if (applied.attentionOnly) filters.push({ key: 'attentionOnly', label: '需要关注' })
      if (applied.inProductionOnly) filters.push({ key: 'inProductionOnly', label: '状态：生产中' })
      if (applied.status !== '') {
        const status = this.statuses.find(item => item.statusCode === applied.status)
        filters.push({ key: 'status', label: '状态：' + (status ? status.statusName : applied.status) })
      }
      if (applied.coverage !== '') filters.push({ key: 'coverage', label: '数据状态：' + (applied.coverage === COVERAGE.NO_RECORD ? '无报工关联' : '有报工记录') })
      if (applied.riskTag !== '') {
        const alert = this.productionAlerts.find(item => item.code === applied.riskTag)
        filters.push({ key: 'riskTag', label: '提醒：' + (alert ? alert.label : applied.riskTag) })
      }
      if (applied.workorderCode !== '') filters.push({ key: 'workorderCode', label: '工单号：' + applied.workorderCode })
      if (applied.productCode !== '') filters.push({ key: 'productCode', label: '产品：' + applied.productCode })
      if (applied.finishDateFrom !== '' || applied.finishDateTo !== '') filters.push({ key: 'finishDate', label: '计划完工日：' + (applied.finishDateFrom || '不限') + ' 至 ' + (applied.finishDateTo || '不限') })
      return filters
    }
  },
  created() { this.refresh() },
  methods: {
    emptyFilters() { return { status: '', workorderCode: '', productCode: '', coverage: '', riskTag: '', attentionOnly: false, inProductionOnly: false, finishDateFrom: '', finishDateTo: '', pageNum: 1, pageSize: 10 } },
    async loadSummary() {
      const sequence = ++this.summarySequence
      this.summaryLoading = true; this.summaryError = ''
      try { const response = await getProductionMonitorSummary({ month: this.dashboardContext.month }); if (sequence === this.summarySequence) { this.summary = response.data; this.summaryFetchedAt = dayjs().format('YYYY-MM-DD HH:mm:ss') } } catch { if (sequence === this.summarySequence) { this.summary = null; this.summaryError = '摘要加载失败，请重试。'; this.summaryFetchedAt = '' } } finally { if (sequence === this.summarySequence) this.summaryLoading = false }
    },
    async loadWorkorders() {
      const sequence = ++this.listSequence
      const requestedQuery = { ...this.filters, month: this.dashboardContext.month }
      this.listLoading = true; this.listError = ''
      try { const response = await listProductionMonitorWorkorders(requestedQuery); if (sequence === this.listSequence) { this.rows = response.rows; this.total = response.total } } catch { if (sequence === this.listSequence) { this.rows = []; this.total = 0; this.listError = '工单列表加载失败，请重试。' } } finally { if (sequence === this.listSequence) this.listLoading = false }
    },
    refresh() { this.loadSummary(); this.loadWorkorders() },
    search() {
      const { status, workorderCode, productCode, coverage, riskTag, finishDateFrom, finishDateTo } = this.filterDraft
      Object.assign(this.filters, { status, workorderCode, productCode, coverage, riskTag, finishDateFrom, finishDateTo })
      if (status !== '') this.filters.inProductionOnly = false
      this.filters.pageNum = 1
      this.loadWorkorders()
    },
    changeMonth() { this.filters = this.emptyFilters(); this.filterDraft = this.emptyFilters(); this.refresh() },
    reset() { this.filters = this.emptyFilters(); this.filterDraft = this.emptyFilters(); this.refresh() },
    updateFilters() { this.filters.pageNum = 1; this.loadWorkorders() },
    isStatusFilterActive(item) { return this.filters.status === item.statusCode || (this.filters.inProductionOnly && item.statusName === '生产中') },
    toggleFilter(key) {
      this.filters[key] = !this.filters[key]
      if (key === 'inProductionOnly' && this.filters[key]) { this.filters.status = ''; this.filterDraft.status = '' }
      this.updateFilters()
    },
    toggleStatus(item) {
      this.filters.inProductionOnly = false
      this.filterDraft.status = item.statusCode
      this.filters.status = this.filters.status === item.statusCode ? '' : item.statusCode
      if (this.filters.status === '') this.filterDraft.status = ''
      this.updateFilters()
    },
    toggleCoverage(coverage) { this.filters.coverage = this.filters.coverage === coverage ? '' : coverage; this.filterDraft.coverage = this.filters.coverage; this.updateFilters() },
    toggleRiskTag(riskTag) { this.filters.riskTag = this.filters.riskTag === riskTag ? '' : riskTag; this.filterDraft.riskTag = this.filters.riskTag; this.updateFilters() },
    removeActiveFilter(key) {
      if (key === 'finishDate') {
        this.filters.finishDateFrom = ''
        this.filters.finishDateTo = ''
      } else {
        this.filters[key] = key === 'attentionOnly' || key === 'inProductionOnly' ? false : ''
      }
      if (key === 'status' || key === 'workorderCode' || key === 'productCode' || key === 'coverage' || key === 'riskTag') this.filterDraft[key] = this.filters[key]
      this.updateFilters()
    },
    openDetail(row) { this.selectedWorkorderId = row.workorderId; this.detailVisible = true },
    closeDetail() { this.detailVisible = false; this.selectedWorkorderId = null },
    summaryValue(field) { return this.summary && this.summary[field] !== undefined && this.summary[field] !== null ? this.summary[field] : '—' },
    riskTagOptionLabel(code) { const alert = this.productionAlerts.find(item => item.code === code); return alert ? alert.label : code },
    productionRiskTags(row) { return (row.riskTags || []).filter(tag => tag.code !== 'NO_REPORTING_RECORD') },
    visibleRiskTags(row) {
      const priority = { PLAN_DATE_PASSED: 1, HAS_DEFECTIVE_RECORD: 2, REPORTING_SILENCE: 3, LOW_STORED_COMPLETION: 4, NEAR_PLAN_DATE: 5 }
      return this.productionRiskTags(row).slice().sort((left, right) => (priority[left.code] || 99) - (priority[right.code] || 99)).slice(0, 1)
    },
    barWidth(value, max) { return max > 0 ? Math.max(3, Number(value) / max * 100) + '%' : '0%' },
    progressPercent(value) { return Math.max(0, Math.min(100, Number(value) * 100)) },
    displayValue(value) { return value === null || value === undefined || value === '' ? '—' : value },
    formatNumber(value) { return value === null || value === undefined ? '—' : String(value) },
    formatRatio(value) { return value === null || value === undefined ? '—' : (Number(value) * 100).toFixed(1) + '%' },
    formatTime(value, pattern) { return parseTime(value, pattern) || '—' }
  }
}
</script>

<style scoped>
.production-monitor { width: 100%; min-width: 0; max-width: 2480px; margin: 0 auto; color: #303846; }
.page-heading { display: flex; align-items: center; justify-content: space-between; margin: 0 0 14px; }
.page-heading h2 { display: inline; margin: 0 12px 0 0; font-size: 20px; font-weight: 600; }
.page-heading > div > span, .heading-actions > span { color: #87909e; font-size: 12px; }
.heading-actions { display: flex; align-items: center; gap: 14px; }
.filter-card, .chart-card, .table-card { border-color: #e8edf3; border-radius: 7px; }
.filter-card { margin-bottom: 14px; }
.filter-card ::v-deep .el-card__body { padding: 13px 16px 1px; }
.filter-card .el-form-item { margin-bottom: 10px; }
.date-separator { padding: 0 5px; color: var(--ui-text-muted); }
.kpi-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
.kpi-card { position: relative; display: grid; grid-template-columns: 38px 1fr; grid-template-rows: auto 1fr auto; column-gap: 11px; min-height: 102px; padding: 14px 16px; border: 1px solid #e8edf3; border-radius: 7px; background: var(--ui-surface); text-align: left; cursor: pointer; }
.kpi-card:hover { border-color: #b3d8ff; box-shadow: 0 3px 12px rgba(36, 82, 130, .06); }
.kpi-card.active { border-color: #d7e7f8; }
.kpi-card.active .kpi-icon { box-shadow: 0 0 0 2px rgba(64, 158, 255, .10); }
.kpi-card:focus-visible { outline: 2px solid rgba(64, 158, 255, .55); outline-offset: 2px; }
.kpi-icon { grid-row: 1 / 4; display: flex; width: 36px; height: 36px; align-items: center; justify-content: center; border-radius: 8px; font-size: 17px; }
.kpi-icon.blue { color: #3979c6; background: #edf5ff; }.kpi-icon.orange { color: #c87821; background: #fff4e8; }.kpi-icon.green { color: #3d9163; background: #edf8f1; }.kpi-icon.red { color: #c45454; background: #fff0f0; }
.kpi-label { align-self: center; color: #687486; font-size: 13px; }
.kpi-card strong { align-self: center; margin: 2px 0; color: #263445; font-size: 25px; font-weight: 600; line-height: 1.1; }
.kpi-card small { color: #9aa3af; font-size: 11px; }
.attention-kpi { border-color: #f1dfcf; }
.charts-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
.chart-card ::v-deep .el-card__header { padding: 13px 16px; }
.chart-card ::v-deep .el-card__body { min-height: 204px; padding: 13px 16px; }
.chart-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: #3c4858; font-size: 14px; font-weight: 600; }
.chart-heading small { color: #9aa3af; font-size: 11px; font-weight: 400; }
.info-icon { color: #9aa3af; }
.status-chart, .alert-chart { min-height: 170px; }
.bar-row { display: grid; width: 100%; grid-template-columns: minmax(80px, 116px) minmax(40px, 1fr) 34px; align-items: center; gap: 9px; margin: 0; padding: 7px 5px; border: 0; border-radius: 4px; background: transparent; text-align: left; cursor: pointer; }
.bar-row:hover, .bar-row.selected { background: #f3f7fc; }
.bar-label { overflow: hidden; color: #606c7b; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.bar-row > strong { color: #586577; font-size: 12px; text-align: right; }
.bar-track { display: block; height: 7px; overflow: hidden; border-radius: 8px; background: #f0f3f7; }
.bar-track i { display: block; height: 100%; min-width: 3px; border-radius: inherit; background: #6d9fd6; }
.bucket-chart { display: flex; min-height: 170px; align-items: flex-end; justify-content: space-around; gap: 5px; padding: 7px 0 0; }
.bucket-item { display: flex; min-width: 32px; flex: 1; height: 145px; flex-direction: column; align-items: center; justify-content: flex-end; gap: 6px; padding: 0; border: 0; background: transparent; }
.bucket-count { color: #647184; font-size: 11px; }
.bucket-track { display: flex; width: 58%; min-width: 15px; height: 102px; align-items: flex-end; overflow: hidden; border-radius: 4px 4px 0 0; background: #f1f4f8; }
.bucket-track i { display: block; width: 100%; min-height: 3px; border-radius: 4px 4px 0 0; background: #78a9dc; }
.bucket-item small { color: #87909e; font-size: 10px; white-space: nowrap; }
.alert-section h4 { margin: 0 0 7px; color: #7e8997; font-size: 11px; font-weight: 500; }
.alert-row { grid-template-columns: minmax(105px, 148px) minmax(35px, 1fr) 27px; padding: 5px 3px; }
.alert-row .bar-track i { background: #e4a253; }.alert-row .bar-label { display: flex; align-items: center; gap: 6px; }
.alert-row .bar-label i { width: 6px; height: 6px; flex: none; border-radius: 50%; background: #e4a253; }.alert-row .bar-label i.level-danger { background: #db7373; }.alert-row .bar-label i.level-info { background: #78a9dc; }
.integrity-callout { display: flex; align-items: center; gap: 7px; margin-top: 10px; padding: 9px 10px; border-radius: 5px; background: #f3f7fb; color: #758296; font-size: 11px; }.integrity-callout strong { color: #4e6d92; font-size: 15px; }.integrity-callout .el-button { margin-left: auto; padding: 0; }
.chart-empty { color: #a1a9b4; font-size: 12px; text-align: center; }
.summary-error { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.table-card { margin-bottom: 20px; }
.table-card ::v-deep .el-card__header { padding: 10px 16px; }
.table-card ::v-deep .el-card__body { padding: 10px 16px 12px; }
.table-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.table-heading-context, .table-heading-actions { display: flex; align-items: center; gap: 10px; min-width: 0; }
.table-heading-context strong { color: #3c4858; font-size: 14px; font-weight: 600; }
.active-filters { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; margin: 0 0 8px; }
.active-filters-label { color: #7c8795; font-size: 12px; }
.active-filters-empty { color: #9aa3af; font-size: 12px; }
.table-card ::v-deep .el-table td.el-table__cell { padding: 12px 0; }
.table-total, .muted { color: #929daa; font-size: 11px; white-space: nowrap; }
.product-name { display: block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.progress-cell > div { display: flex; justify-content: space-between; gap: 7px; margin-bottom: 5px; color: #5d6978; font-size: 11px; }.progress-cell strong { color: #3b526c; font-weight: 600; }
.progress-cell ::v-deep .el-progress-bar__outer { background: #edf1f5; }
.risk-tag { margin: 1px 3px 1px 0; vertical-align: middle; }
.risk-popover-list { display: flex; flex-direction: column; align-items: flex-start; gap: 5px; }
@media (max-width: 1450px) { .charts-grid { gap: 9px; }.chart-card ::v-deep .el-card__body { padding-right: 11px; padding-left: 11px; }.bar-row { grid-template-columns: minmax(72px, 100px) minmax(30px, 1fr) 30px; gap: 6px; } }
@media (max-width: 1100px) { .charts-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }.alerts-card { grid-column: 1 / -1; }.kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 760px) { .page-heading { align-items: flex-start; }.charts-grid { grid-template-columns: 1fr; }.alerts-card { grid-column: auto; }.kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }.heading-actions > span { display: none; } }
</style>
