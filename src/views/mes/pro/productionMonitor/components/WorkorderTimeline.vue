<template>
  <div class="event-log">
    <div v-if="hasFilter" class="filter-banner">
      <span>日志过滤：{{ filterSummary }}</span>
      <el-button link @click="$emit('clear-filter')">清除过滤</el-button>
    </div>
    <div v-if="initialError && !rows.length" class="timeline-error">
      <el-alert :title="pagingContractError ? '分页接口返回超过每页 30 条，请确认后端已更新。' : '报工日志加载失败，请重试。'" type="error" :closable="false" show-icon />
      <el-button link @click="load(1)">重试</el-button>
    </div>
    <el-empty v-else-if="!initialLoading && rows.length === 0 && loadedOnce" :description="hasFilter ? '未发现符合条件的报工记录' : '未发现该工单的报工记录'" :image-size="72" />
    <div v-else v-loading="initialLoading" class="timeline-content">
      <template v-if="rows.length">
        <section v-for="group in eventGroups" :key="group.date" class="event-day">
          <h4>{{ group.date }}</h4>
          <div class="event-list">
            <article v-for="(row, index) in group.records" :key="row.recordId" class="event-item">
              <time class="event-time">{{ formatTime(row.createTime, '{h}:{i}:{s}') }}</time>
              <div class="event-axis"><span class="event-dot" /><span v-if="index < group.records.length - 1" class="event-connector" /></div>
              <div class="event-card">
                <div class="event-card-heading"><strong>流程卡 {{ displayValue(row.xtransferNo) }}</strong><el-tag v-if="row.statusName" size="small" type="info">记录当前状态：{{ row.statusName }}</el-tag></div>
                <div class="event-process">{{ displayValue(row.processCode) }} / {{ displayValue(row.processName) }}</div>
                <div class="event-meta"><span>报工账号：{{ displayValue(row.userName) }}<template v-if="row.nickName">（{{ row.nickName }}）</template></span><strong>报工 {{ formatNumber(row.reportingWorkQuantity) }} {{ displayValue(row.unitOfMeasure) }}</strong></div>
                <div class="event-written-at">报工记录写入时间：{{ formatTime(row.createTime) }}</div>
              </div>
            </article>
          </div>
        </section>
      </template>
      <div v-if="moreError" class="more-error"><el-alert :title="pagingContractError ? '分页接口返回超过每页 30 条，已保留当前记录。' : '后续报工日志加载失败，已保留当前记录。'" type="error" :closable="false" show-icon /><el-button link @click="loadMore">重试加载</el-button></div>
      <div v-else-if="hasMore" class="event-load-more"><el-button :loading="moreLoading" @click="loadMore">加载更多</el-button><span>已加载 {{ rows.length }} / {{ total }} 条</span></div>
      <p v-else-if="loadedOnce && rows.length > 0" class="event-loaded-all">已加载全部 {{ total }} 条报工记录</p>
    </div>
  </div>
</template>

<script>
import { parseTime } from '@/utils/ruoyi'
import { listProductionMonitorTimeline } from '@/api/pro/productionMonitor'

export default {
  name: 'ProductionMonitorWorkorderTimeline',
  props: {
    workorderId: { type: Number, required: true },
    active: { type: Boolean, default: false },
    filter: { type: Object, default: () => ({}) },
    filterResetKey: { type: Number, default: 0 }
  },
  emits: ['clear-filter'],
  data() { return { rows: [], total: 0, initialLoading: false, moreLoading: false, initialError: false, moreError: false, pagingContractError: false, loadedOnce: false, requestSequence: 0, query: { pageNum: 1, pageSize: 30 }} },
  computed: {
    hasMore() { return this.rows.length < this.total },
    hasFilter() { return Object.keys(this.filter).some(key => this.filter[key] !== null && this.filter[key] !== undefined && this.filter[key] !== '') },
    filterSummary() { return [this.filter.xtransferNo, this.filter.routeId !== undefined ? '路线 ' + this.filter.routeId : '', this.filter.processCode || ''].filter(Boolean).join(' · ') },
    eventGroups() {
      const groups = []
      const groupByDate = new Map()
      this.rows.forEach(row => {
        const date = this.formatTime(row.createTime, '{y}-{m}-{d}')
        if (!groupByDate.has(date)) {
          const group = { date, records: [] }
          groupByDate.set(date, group)
          groups.push(group)
        }
        groupByDate.get(date).records.push(row)
      })
      return groups
    }
  },
  watch: {
    active(value) {
      if (value && !this.loadedOnce) {
        this.$nextTick(() => {
          if (this.active && !this.loadedOnce && !this.initialLoading) this.load(1)
        })
      }
    },
    workorderId() { this.resetAndReload() },
    filterResetKey() { this.resetAndReload() }
  },
  methods: {
    resetAndReload() {
      this.requestSequence++
      this.rows = []
      this.total = 0
      this.initialError = false
      this.moreError = false
      this.pagingContractError = false
      this.loadedOnce = false
      this.query.pageNum = 1
      this.initialLoading = false
      this.moreLoading = false
      if (this.active) this.load(1)
    },
    async load(page) {
      if (!this.active || this.initialLoading || this.moreLoading) return
      const requestedPage = page || 1
      const sequence = ++this.requestSequence
      const isInitial = requestedPage === 1
      if (isInitial) this.initialLoading = true
      else this.moreLoading = true
      if (isInitial) this.initialError = false
      else this.moreError = false
      this.pagingContractError = false
      try {
        const params = Object.assign({ pageNum: requestedPage, pageSize: this.query.pageSize }, this.filter)
        const response = await listProductionMonitorTimeline(this.workorderId, params)
        if (sequence === this.requestSequence) {
          if (response.rows.length > this.query.pageSize) throw new Error('PAGING_OVERFLOW')
          const currentRows = isInitial ? [] : this.rows
          const ids = new Set(currentRows.map(row => String(row.recordId)))
          const newRows = response.rows.filter(row => !ids.has(String(row.recordId)))
          this.rows = currentRows.concat(newRows)
          this.total = response.total
          this.query.pageNum = requestedPage
          this.loadedOnce = true
        }
      } catch(error) {
        if (sequence === this.requestSequence) {
          this.pagingContractError = error && error.message === 'PAGING_OVERFLOW'
          if (isInitial) this.initialError = true
          else this.moreError = true
        }
      } finally {
        if (sequence === this.requestSequence) {
          this.initialLoading = false
          this.moreLoading = false
        }
      }
    },
    loadMore() { if (this.hasMore) return this.load(this.query.pageNum + 1) },
    displayValue(value) { return value === null || value === undefined || value === '' ? '—' : value },
    formatNumber(value) { return value === null || value === undefined ? '—' : String(value) },
    formatTime(value, pattern) { return parseTime(value, pattern) || '—' }
  }
}
</script>

<style scoped>
.event-log { min-height: 120px; padding-top: 8px; }
.filter-banner { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; padding: 8px 12px; color: var(--ui-text-secondary); background: #f4f8fd; border: 1px solid #dce9f8; border-radius: 4px; font-size: 12px; }
.timeline-content { min-height: 100px; }
.timeline-error, .more-error { display: flex; align-items: center; gap: 10px; }
.more-error { padding: 8px 0 14px; }
.event-day { margin-bottom: 18px; }
.event-day h4 { margin: 0 0 8px; padding: 0 0 7px; border-bottom: 1px solid #ebeef5; color: #566273; font-size: 13px; font-weight: 600; }
.event-item { display: grid; grid-template-columns: 68px 16px minmax(0, 1fr); gap: 10px; min-height: 76px; }
.event-time { padding-top: 12px; color: #87909e; font-size: 12px; text-align: right; }
.event-axis { position: relative; display: flex; justify-content: center; }
.event-dot { z-index: 1; width: 9px; height: 9px; margin-top: 15px; border: 2px solid var(--ui-primary); border-radius: 50%; background: var(--ui-surface); }
.event-connector { position: absolute; top: 24px; bottom: -1px; width: 1px; background: #dce7f3; }
.event-card { align-self: start; margin: 4px 0 8px; padding: 10px 13px; border: 1px solid #e8edf3; border-radius: 5px; background: var(--ui-surface); }
.event-card-heading, .event-meta { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.event-card-heading strong { color: #485567; font-size: 12px; font-weight: 600; }
.event-process { margin-top: 6px; color: #303846; font-size: 13px; font-weight: 500; }
.event-meta { margin-top: 8px; color: #87909e; font-size: 11px; }
.event-meta strong { color: #5d6978; font-size: 12px; font-weight: 500; }
.event-written-at { margin-top: 6px; color: #a0a7b1; font-size: 10px; }
.event-load-more { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 8px 0 14px; }
.event-load-more span, .event-loaded-all { color: #9aa3af; font-size: 11px; }
.event-loaded-all { margin: 8px 0 14px; text-align: center; }
@media (max-width: 640px) { .event-item { grid-template-columns: 54px 12px minmax(0, 1fr); gap: 7px; }.event-time { font-size: 11px; }.event-card { padding: 9px; }.event-meta { align-items: flex-start; flex-direction: column; gap: 4px; } }
</style>
