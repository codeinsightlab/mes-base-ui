<template>
  <div class="app-container personnel-analysis">
    <div class="personnel-heading">
      <div>
        <h2>人员报工分析</h2>
        <p>按当前工厂报工记录归属账号统计；报工账号不等同于已确认实际操作人员。</p>
      </div>
      <el-popover placement="bottom" width="330" trigger="click">
        <p>统一报工可能分摊生成多条记录。未观察到记录不代表不会操作。当前停用状态不代表历史期间已离职。</p>
        <template #reference><el-button link>统计口径</el-button></template>
      </el-popover>
    </div>

    <el-card shadow="never" class="scope-card">
      <span>当前工厂：<strong>{{ factoryName }}</strong></span>
      <span>统计时间：<strong>{{ rangeLabel }}</strong></span>
      <span>数据截至：<strong>{{ formatDate(dataThrough) }}</strong></span>
    </el-card>

    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" size="small" @submit.prevent="search">
        <el-form-item label="时间范围">
          <el-select v-model="draft.range" style="width: 148px" @change="onRangeChange">
            <el-option v-for="option in ranges" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="draft.range === 'CUSTOM'" label="自定义">
          <el-date-picker
            v-model="draft.dates"
            type="daterange"
            value-format="YYYY-MM-DD"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            unlink-panels
          />
        </el-form-item>
        <el-form-item label="账号">
          <el-input v-model.trim="draft.accountKeyword" clearable placeholder="账号或姓名" @keyup.enter="search" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="search">查询</el-button>
          <el-button @click="reset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="list-card">
      <template #header><div class="card-heading"><strong>当前工厂报工账号</strong><small>共 {{ total }} 个有记录账号</small></div></template>
      <el-table v-loading="listLoading" :data="rows" stripe size="small" row-key="userId" class="account-table">
        <el-table-column label="账号 / 当前名称与状态" min-width="190">
          <template #default="{ row }">
            <strong>{{ displayName(row) }}</strong><br><small class="muted">{{ row.userName || '历史账号 #' + row.userId }}</small>
            <el-tag v-if="row.accountStatusName === '已停用'" size="small" type="info" class="status-tag">已停用</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="activeMonths" label="活跃月份" min-width="100" align="right" />
        <el-table-column prop="processCount" label="工序数" min-width="90" align="right" />
        <el-table-column prop="productCount" label="产品数" min-width="90" align="right" />
        <el-table-column prop="reportRecordCount" label="报工记录数" min-width="112" align="right" />
        <el-table-column label="最近报工" min-width="155"><template #default="{ row }">{{ formatDate(row.lastReportTime) }}</template></el-table-column>
        <el-table-column label="操作" width="84" fixed="right"><template #default="{ row }"><el-button v-permission="{code:'mes:pro:personnelAnalysis:query',scope:'factory'}" link @click="openDetail(row)">查看详情</el-button></template></el-table-column>
      </el-table>
      <el-alert v-if="listError" :title="listError" type="error" :closable="false" show-icon class="panel-error" />
      <el-empty v-else-if="!listLoading && total === 0" description="当前工厂在所选时间范围内未发现报工账号记录" />
      <pagination
        v-show="total > 0"
        v-model:page="pageNum"
        v-model:limit="pageSize"
        :total="total"
        :page-sizes="[10, 30, 50]"
        @pagination="loadAccounts"
      />
    </el-card>

    <el-drawer
      v-model="detailVisible"
      :before-close="closeDetail"
      :with-header="false"
      custom-class="personnel-detail-drawer"
      size="72%"
      append-to-body
    >
      <div v-if="detailVisible" class="detail-body">
        <div class="detail-heading">
          <div><h3>人员报工详情</h3><p>{{ factoryName }} · {{ rangeLabel }} · 按记录归属账号统计</p></div>
          <el-button link aria-label="关闭详情" @click="closeDetail" />
        </div>
        <div v-loading="overviewLoading" class="overview-block">
          <template v-if="overview">
            <div class="identity"><strong>{{ displayName(overview) }}</strong><span>{{ overview.userName || '历史账号 #' + overview.userId }}</span><el-tag v-if="overview.accountStatusName === '已停用'" size="small" type="info">已停用</el-tag></div>
            <div class="metrics">
              <div><small>活跃月份</small><strong>{{ overview.activeMonths }}</strong></div>
              <div><small>工序数</small><strong>{{ overview.processCount }}</strong></div>
              <div><small>产品数</small><strong>{{ overview.productCount }}</strong></div>
              <div><small>报工记录数</small><strong>{{ overview.reportRecordCount }}</strong></div>
              <div><small>最近报工</small><strong class="metric-date">{{ formatDate(overview.lastReportTime) }}</strong></div>
            </div>
            <div class="overview-foot">首次报工：{{ formatDate(overview.firstReportTime) }} · 数据截至：{{ formatDate(overview.dataThrough) }}</div>
            <el-button v-permission="{code:'mes:pro:reportingWork:list',scope:'factory'}" link @click="openRecords()">查看源记录</el-button>
          </template>
          <el-alert v-else-if="overviewError" :title="overviewError" type="error" :closable="false" show-icon />
        </div>

        <el-tabs v-model="activeTab" @tab-click="onTab">
          <el-tab-pane label="工序经验覆盖" name="processes">
            <p class="tab-note">表示该账号在当前工厂、当前时间范围内有报工记录的工序。</p>
            <el-table v-loading="processLoading" :data="processRows" size="small" stripe>
              <el-table-column label="工序编码 / 名称" min-width="190"><template #default="{ row }"><strong>{{ row.processCode || '历史工序 #' + row.processId }}</strong><br><small class="muted">{{ row.processName || '工序主数据已不存在' }}</small></template></el-table-column>
              <el-table-column prop="activeMonths" label="活跃月份" width="86" align="right" />
              <el-table-column prop="productCount" label="产品数" width="76" align="right" />
              <el-table-column prop="workorderCount" label="工单数" width="76" align="right" />
              <el-table-column prop="reportRecordCount" label="记录数" width="78" align="right" />
              <el-table-column label="最近报工" min-width="140"><template #default="{ row }">{{ formatDate(row.lastReportTime) }}</template></el-table-column>
              <el-table-column label="操作" width="92"><template #default="{ row }"><el-button v-permission="{code:'mes:pro:reportingWork:list',scope:'factory'}" link @click="openRecords({ processId: row.processId })">查看报工记录</el-button></template></el-table-column>
            </el-table>
            <el-alert v-if="processError" :title="processError" type="error" :closable="false" show-icon class="panel-error" />
            <pagination v-show="processTotal > 0" v-model:page="processPage" v-model:limit="processPageSize" :total="processTotal" :page-sizes="[10, 30, 50]" @pagination="loadProcesses" />
          </el-tab-pane>
          <el-tab-pane label="产品经验覆盖" name="products">
            <el-table v-loading="productLoading" :data="productRows" size="small" stripe>
              <el-table-column label="产品编码 / 名称" min-width="205"><template #default="{ row }"><strong>{{ row.itemCode }}</strong><br><small class="muted">{{ row.itemName || '历史产品' }}</small></template></el-table-column>
              <el-table-column prop="activeMonths" label="活跃月份" width="86" align="right" />
              <el-table-column prop="processCount" label="工序数" width="76" align="right" />
              <el-table-column prop="reportRecordCount" label="记录数" width="78" align="right" />
              <el-table-column label="最近报工" min-width="140"><template #default="{ row }">{{ formatDate(row.lastReportTime) }}</template></el-table-column>
              <el-table-column label="操作" width="92"><template #default="{ row }"><el-button v-permission="{code:'mes:pro:reportingWork:list',scope:'factory'}" link @click="openRecords({ itemCode: row.itemCode })">查看报工记录</el-button></template></el-table-column>
            </el-table>
            <el-alert v-if="productError" :title="productError" type="error" :closable="false" show-icon class="panel-error" />
            <pagination v-show="productTotal > 0" v-model:page="productPage" v-model:limit="productPageSize" :total="productTotal" :page-sizes="[10, 30, 50]" @pagination="loadProducts" />
          </el-tab-pane>
          <el-tab-pane label="活动趋势" name="trend">
            <p class="tab-note">每月有报工记录的自然日数量，不代表出勤天数。{{ trendRows.some(row => row.partialMonth) ? '本月数据截至当前查询时间。' : '' }}</p>
            <div ref="trendChart" v-loading="trendLoading" class="trend-chart" />
            <el-alert v-if="trendError" :title="trendError" type="error" :closable="false" show-icon class="panel-error" />
            <el-empty v-else-if="!trendLoading && trendLoaded && !trendRows.length" description="当前范围暂无月度报工活动" />
          </el-tab-pane>
        </el-tabs>
      </div>
    </el-drawer>

    <el-dialog v-model="recordsVisible" title="源报工记录" width="min(1100px, 96vw)" append-to-body>
      <p class="tab-note">归属账号、登录录入账号和报工时间分别展示；统一报工可能形成多行。</p>
      <el-table v-loading="recordsLoading" :data="recordRows" size="small" stripe>
        <el-table-column prop="recordId" label="记录ID" width="100" />
        <el-table-column label="报工时间" min-width="145"><template #default="{ row }">{{ formatDate(row.createTime) }}</template></el-table-column>
        <el-table-column label="归属账号" width="110"><template #default="{ row }">{{ row.userName }}（#{{ row.userId }}）</template></el-table-column>
        <el-table-column prop="createBy" label="登录录入账号" width="115" />
        <el-table-column prop="reportingWorkType" label="报工类型" width="78" />
        <el-table-column label="工序" min-width="115"><template #default="{ row }">{{ row.processCode }} {{ row.processName }}</template></el-table-column>
        <el-table-column label="产品" min-width="120"><template #default="{ row }">{{ row.itemCode }} {{ row.itemName }}</template></el-table-column>
        <el-table-column label="数量 / 单位" width="120"><template #default="{ row }">{{ row.reportingWorkQuantity }} {{ row.unitOfMeasure }}</template></el-table-column>
      </el-table>
      <el-alert v-if="recordsError" :title="recordsError" type="error" :closable="false" show-icon class="panel-error" />
      <pagination v-show="recordTotal > 0" v-model:page="recordPage" v-model:limit="recordPageSize" :total="recordTotal" :page-sizes="[10, 30, 50]" @pagination="loadRecords" />
    </el-dialog>
  </div>
</template>

<script>
import { dayjs } from 'element-plus'
import * as echarts from 'echarts'
import { useAuth } from '@/stores/auth'
import { listPersonnelRecords } from '@/api/pro/personnelAnalysis'
import { listPersonnelAccounts, getPersonnelOverview, listPersonnelProcesses, listPersonnelProducts, getPersonnelTrend } from '@/api/pro/personnelAnalysis'

const ranges = [
  { value: '3M', label: '最近3个月' }, { value: '6M', label: '最近6个月' },
  { value: '12M', label: '最近12个月' }, { value: 'ALL', label: '全部保留历史' },
  { value: 'CUSTOM', label: '自定义' }
]
const emptyFilter = () => ({ range: '12M', dates: null, accountKeyword: '' })

export default {
  name: 'PersonnelAnalysis',
  data() {
    return {
      factory: useAuth(), ranges, draft: emptyFilter(), applied: emptyFilter(),
      pageNum: 1, pageSize: 30, total: 0, rows: [], listLoading: false, listError: '', dataThrough: null,
      detailVisible: false, selectedUserId: null, overview: null, overviewLoading: false, overviewError: '', activeTab: 'processes',
      processRows: [], processTotal: 0, processPage: 1, processPageSize: 30, processLoading: false, processError: '',
      productRows: [], productTotal: 0, productPage: 1, productPageSize: 30, productLoading: false, productError: '', productsLoaded: false,
      trendRows: [], trendLoading: false, trendError: '', trendLoaded: false, chart: null,
      recordsVisible: false, recordScope: {}, recordRows: [], recordTotal: 0, recordPage: 1, recordPageSize: 30,
      recordsLoading: false, recordsError: '', sequence: 0, listSequence: 0, detailSequence: 0, recordsSequence: 0
    }
  },
  computed: {
    factoryName() { const item = this.factory.factories.find(value => value.factoryId === this.factory.factoryId); return item ? item.name : '未选择工厂' },
    rangeLabel() { const value = this.ranges.find(item => item.value === this.applied.range); return value ? value.label : '' }
  },
  watch: {
    'factory.factoryId'() { this.invalidate(); this.reset() }
  },
  created() { this.loadAccounts() },
  mounted() { window.addEventListener('resize', this.resizeChart) },
  beforeUnmount() { window.removeEventListener('resize', this.resizeChart); this.invalidate(); this.disposeChart() },
  methods: {
    formatDate(value) { return value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '—' },
    displayName(row) { return row.nickName || row.userName || `历史账号 #${row.userId}` },
    onRangeChange() { if (this.draft.range !== 'CUSTOM') this.draft.dates = null },
    params(filter) {
      const params = { range: filter.range }
      if (filter.range === 'CUSTOM' && filter.dates) {
        params.startTime = `${filter.dates[0]} 00:00:00`
        params.endTime = dayjs(filter.dates[1]).add(1, 'day').format('YYYY-MM-DD 00:00:00')
      }
      return params
    },
    search() {
      if (this.draft.range === 'CUSTOM' && (!this.draft.dates || this.draft.dates.length !== 2)) {
        this.$message.warning('请选择完整的自定义时间范围'); return
      }
      this.applied = { ...this.draft, dates: this.draft.dates && [...this.draft.dates] }
      this.pageNum = 1; this.closeDetail(); this.loadAccounts()
    },
    reset() { this.draft = emptyFilter(); this.applied = emptyFilter(); this.pageNum = 1; this.closeDetail(); this.loadAccounts() },
    invalidate() { this.sequence++; this.listSequence++; this.detailSequence++; this.recordsSequence++; this.recordsVisible = false },
    async loadAccounts() {
      const ticket = ++this.listSequence
      this.listLoading = true; this.listError = ''
      try {
        const response = await listPersonnelAccounts({ ...this.params(this.applied), accountKeyword: this.applied.accountKeyword, pageNum: this.pageNum, pageSize: this.pageSize })
        if (ticket !== this.listSequence) return
        this.rows = response.rows; this.total = response.total
        if (this.pageNum === 1) this.dataThrough = this.rows.length ? this.rows[0].lastReportTime : null
      } catch {
        if (ticket === this.listSequence) { this.rows = []; this.total = 0; this.dataThrough = null; this.listError = '账号列表加载失败，请重试。' }
      } finally { if (ticket === this.listSequence) this.listLoading = false }
    },
    openDetail(row) {
      this.closeDetail()
      this.selectedUserId = row.userId; this.detailVisible = true; this.activeTab = 'processes'
      this.loadOverview(); this.loadProcesses()
    },
    closeDetail(done) {
      this.detailSequence++; this.recordsSequence++; this.detailVisible = false; this.recordsVisible = false
      this.selectedUserId = null; this.overview = null; this.overviewError = ''
      this.processRows = []; this.processTotal = 0; this.processPage = 1; this.processError = ''
      this.productRows = []; this.productTotal = 0; this.productPage = 1; this.productError = ''; this.productsLoaded = false
      this.trendRows = []; this.trendError = ''; this.trendLoaded = false; this.disposeChart()
      if (typeof done === 'function') done()
    },
    async loadOverview() {
      const ticket = this.detailSequence; const userId = this.selectedUserId
      this.overviewLoading = true; this.overviewError = ''
      try { const response = await getPersonnelOverview(userId, this.params(this.applied)); if (ticket === this.detailSequence) this.overview = response.data } catch { if (ticket === this.detailSequence) this.overviewError = '概览加载失败，请重试。' } finally { if (ticket === this.detailSequence) this.overviewLoading = false }
    },
    async loadProcesses() {
      const ticket = this.detailSequence; const userId = this.selectedUserId
      this.processLoading = true; this.processError = ''
      try { const response = await listPersonnelProcesses(userId, { ...this.params(this.applied), pageNum: this.processPage, pageSize: this.processPageSize }); if (ticket === this.detailSequence) { this.processRows = response.rows; this.processTotal = response.total } } catch { if (ticket === this.detailSequence) this.processError = '工序经验加载失败，请重试。' } finally { if (ticket === this.detailSequence) this.processLoading = false }
    },
    async loadProducts() {
      const ticket = this.detailSequence; const userId = this.selectedUserId
      this.productLoading = true; this.productError = ''
      try { const response = await listPersonnelProducts(userId, { ...this.params(this.applied), pageNum: this.productPage, pageSize: this.productPageSize }); if (ticket === this.detailSequence) { this.productRows = response.rows; this.productTotal = response.total; this.productsLoaded = true } } catch { if (ticket === this.detailSequence) this.productError = '产品经验加载失败，请重试。' } finally { if (ticket === this.detailSequence) this.productLoading = false }
    },
    async loadTrend() {
      const ticket = this.detailSequence; const userId = this.selectedUserId
      this.trendLoading = true; this.trendError = ''
      try { const response = await getPersonnelTrend(userId, this.params(this.applied)); if (ticket === this.detailSequence) { this.trendRows = response.data; this.trendLoaded = true; this.$nextTick(this.renderTrend) } } catch { if (ticket === this.detailSequence) this.trendError = '活动趋势加载失败，请重试。' } finally { if (ticket === this.detailSequence) this.trendLoading = false }
    },
    onTab(tab) {
      if (tab.name === 'products' && !this.productsLoaded) this.loadProducts()
      if (tab.paneName === 'trend') { if (!this.trendLoaded) this.loadTrend(); else this.$nextTick(this.renderTrend) }
    },
    renderTrend() {
      if (!this.$refs.trendChart || !this.trendRows.length || this.activeTab !== 'trend') return
      this.disposeChart(); this.chart = echarts.init(this.$refs.trendChart)
      this.chart.setOption({ grid: { left: 48, right: 28, top: 34, bottom: 60 }, tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: this.trendRows.map(row => row.month), axisLabel: { rotate: this.trendRows.length > 12 ? 45 : 0 }},
        yAxis: { type: 'value', minInterval: 1, name: '有记录天数' },
        series: [{ type: 'bar', name: '有报工记录的天数', data: this.trendRows.map(row => row.activeDayCount), barMaxWidth: 34, itemStyle: { color: '#409EFF' }}] })
    },
    resizeChart() { if (this.chart) this.chart.resize() },
    disposeChart() { if (this.chart) { this.chart.dispose(); this.chart = null } },
    openRecords(scope = {}) { this.recordScope = scope; this.recordRows = []; this.recordTotal = 0; this.recordPage = 1; this.recordsVisible = true; this.loadRecords() },
    async loadRecords() {
      const ticket = ++this.recordsSequence
      this.recordsLoading = true; this.recordsError = ''
      const rangeStart = this.overview && (this.overview.rangeStart || this.overview.firstReportTime)
      const rangeEnd = this.overview && this.overview.rangeEndExclusive
      if (!rangeStart || !rangeEnd) { this.recordsLoading = false; this.recordsError = '统计范围尚未加载，请稍后重试。'; return }
      try {
        const response = await listPersonnelRecords(this.selectedUserId, { ...this.params(this.applied), ...this.recordScope,
          pageNum: this.recordPage, pageSize: this.recordPageSize
        })
        if (ticket === this.recordsSequence) { this.recordRows = response.rows; this.recordTotal = response.total }
      } catch { if (ticket === this.recordsSequence) this.recordsError = '源记录加载失败。请核对报工列表查看权限后重试。' } finally { if (ticket === this.recordsSequence) this.recordsLoading = false }
    }
  }
}
</script>

<style scoped>
.personnel-analysis { color: var(--ui-text); }
.personnel-heading, .card-heading, .detail-heading { display: flex; align-items: center; justify-content: space-between; gap: 18px; }
.personnel-heading { margin-bottom: 16px; }
.personnel-heading h2 { margin: 0 0 6px; font-size: 21px; }
.personnel-heading p, .detail-heading p, .tab-note { color: var(--ui-text-secondary); font-size: 13px; line-height: 1.55; }
.personnel-heading p, .detail-heading p { margin: 0; }
.scope-card, .filter-card, .list-card { margin-bottom: 14px; }
.scope-card >>> .el-card__body { display: flex; flex-wrap: wrap; gap: 12px 28px; font-size: 13px; }
.scope-card strong { color: var(--ui-text); }
.filter-card >>> .el-card__body { padding-bottom: 4px; }
.card-heading small, .muted, .overview-foot { color: var(--ui-text-muted); }
.status-tag { margin-left: 8px; }
.panel-error { margin-top: 12px; }
.account-table strong, .detail-body strong { font-weight: 600; }
.detail-body { padding: 20px 26px 30px; min-width: 0; }
.detail-heading { margin-bottom: 18px; }
.detail-heading h3 { margin: 0 0 5px; font-size: 18px; }
.overview-block { min-height: 96px; }
.identity { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.identity strong { font-size: 18px; }
.identity span { color: var(--ui-text-muted); font-size: 13px; }
.metrics { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 9px; }
.metrics > div { padding: 14px 12px; border: 1px solid #e4e7ed; border-radius: 5px; min-width: 0; }
.metrics small, .metrics strong { display: block; }
.metrics small { color: var(--ui-text-muted); margin-bottom: 7px; }
.metrics strong { font-size: 18px; overflow-wrap: anywhere; }
.metrics .metric-date { font-size: 13px; line-height: 1.4; }
.overview-foot { margin: 12px 0 6px; font-size: 12px; }
.tab-note { margin: 4px 0 14px; }
.trend-chart { width: 100%; height: 310px; max-width: 920px; }
@media (max-width: 1450px) { .metrics { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
</style>

<style>
.personnel-detail-drawer { max-width: 1100px; }
.personnel-detail-drawer .el-drawer__body { overflow-y: auto; }
@media (max-width: 900px) { .personnel-detail-drawer { width: calc(100vw - 24px) !important; } }
</style>
