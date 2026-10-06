<template>
  <div class="flowcard-panel">
    <el-alert v-if="flowcards.length" class="observed-note" title="以下仅列出当前报工记录中识别到的流程卡，不代表工单全部流程卡。" type="info" :closable="false" show-icon />
    <el-empty v-if="!flowcards.length" description="未发现该工单的流程卡报工记录" />
    <el-collapse v-else accordion :model-value="expandedKey" @change="expandRoute">
      <el-collapse-item v-for="card in flowcards" :key="trackKey(card)" :name="trackKey(card)">
        <template #title>
          <div class="flowcard-heading">
            <strong>{{ displayValue(card.xtransferNo) }}</strong>
            <span>路线：{{ displayValue(card.routeName) }}</span>
            <span>已见报工工序 {{ observedCount(card) }}</span>
            <span>最近报工 {{ formatTime(card.lastReportingTime) }}</span>
            <span>最近报工工序：{{ latestObservedProcess(card) ? displayValue(latestObservedProcess(card).processCode) + ' / ' + displayValue(latestObservedProcess(card).processName) : '展开后读取' }}</span>
          </div>
        </template>
        <div v-if="card.fullyStored" class="flowcard-facts">存在完全入库状态记录（仅为当前报工记录的状态信息）。</div>
        <el-alert v-if="card.routeId === null || card.routeId === undefined" title="该流程卡没有路线编号，无法查询路线轨迹。" type="info" :closable="false" show-icon />
        <div v-else v-loading="routeLoadingKey === trackKey(card)" class="route-track">
          <div v-if="routeErrorKey === trackKey(card)" class="route-error">
            <el-alert title="路线轨迹加载失败，请重试。" type="error" :closable="false" show-icon />
            <el-button link @click.stop="retryRoute(card)">重试</el-button>
          </div>
          <template v-if="routeTrack(card)">
            <el-alert v-if="routeTrack(card).routeDefinitionMissing" title="当前路线定义不可用，以下内容来自报工记录。" type="warning" :closable="false" show-icon />
            <div v-if="routeTrack(card).routeDefinition.length" class="route-steps">
              <div v-for="step in routeTrack(card).routeDefinition" :key="processKey(step)" class="route-step">
                <span class="route-dot" :class="{ 'is-observed': step.observed }" />
                <div class="route-step-content">
                  <div class="route-step-heading"><span class="route-order">{{ displayValue(step.orderNum) }}</span><strong>{{ displayValue(step.processCode) }} / {{ displayValue(step.processName) }}</strong><el-tag size="small" :type="step.observed ? '' : 'info'">{{ step.observed ? '有报工记录' : '未见报工记录' }}</el-tag></div>
                  <div v-if="observedProcess(step, routeTrack(card))" class="route-step-facts">
                    <span>记录 {{ formatNumber(observedProcess(step, routeTrack(card)).reportCount) }} 条</span>
                    <span>最近报工 {{ formatTime(observedProcess(step, routeTrack(card)).lastReportingTime) }}</span>
                    <el-button link size="small" @click.stop="$emit('view-logs', logFilter(card, step))">查看报工日志</el-button>
                  </div>
                </div>
              </div>
            </div>
            <el-empty v-else-if="!routeTrack(card).historicalOnlyProcesses.length" description="暂无可展示的路线工序" :image-size="64" />
            <div v-if="routeTrack(card).historicalOnlyProcesses.length" class="historical-only">
              <h4>当前路线未匹配的报工工序</h4>
              <div v-for="item in routeTrack(card).historicalOnlyProcesses" :key="processKey(item)" class="historical-row">
                <div><strong>{{ displayValue(item.processCode) }} / {{ displayValue(item.processName) }}</strong><span>记录 {{ formatNumber(item.reportCount) }} 条 · 最近报工 {{ formatTime(item.lastReportingTime) }}</span></div>
                <el-button link size="small" @click.stop="$emit('view-logs', logFilter(card, item))">查看报工日志</el-button>
              </div>
            </div>
          </template>
        </div>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script>
import { parseTime } from '@/utils/ruoyi'
import { getProductionMonitorRouteTrack } from '@/api/pro/productionMonitor'

export default {
  name: 'ProductionMonitorWorkorderFlowcards',
  props: { workorderId: { type: Number, required: true }, flowcards: { type: Array, default: () => [] }},
  emits: ['view-logs'],
  data() { return { expandedKey: '', routeTracks: {}, routeLoadingKey: '', routeErrorKey: '', routeSequence: 0 } },
  methods: {
    trackKey(card) { return String(card.xtransferNo) + '|' + String(card.routeId) },
    processKey(item) { return String(item.processId) + '|' + String(item.processCode) },
    routeTrack(card) { return this.routeTracks[this.trackKey(card)] },
    observedProcess(step, track) { return track.observedEvents.find(item => this.processKey(item) === this.processKey(step)) },
    observedCount(card) { const track = this.routeTrack(card); return track ? track.observedEvents.length + ' 道' : '展开后读取' },
    latestObservedProcess(card) {
      const track = this.routeTrack(card)
      if (!track || !track.observedEvents.length) return null
      return track.observedEvents.slice().sort((a, b) => {
        const timeCompare = String(b.lastReportingTime || '').localeCompare(String(a.lastReportingTime || ''))
        if (timeCompare) return timeCompare
        const recordCompare = Number(b.lastReportingRecordId || 0) - Number(a.lastReportingRecordId || 0)
        if (recordCompare) return recordCompare
        return String(b.lastReportingTime || '').localeCompare(String(a.lastReportingTime || ''))
      })[0]
    },
    logFilter(card, process) { return { xtransferNo: card.xtransferNo, routeId: card.routeId, processId: process.processId, processCode: process.processCode } },
    async expandRoute(name) {
      this.expandedKey = name || ''
      const card = this.flowcards.find(item => this.trackKey(item) === this.expandedKey)
      if (!card || card.routeId === null || card.routeId === undefined || this.routeTracks[this.expandedKey]) return
      const sequence = ++this.routeSequence
      const key = this.expandedKey
      this.routeLoadingKey = key
      this.routeErrorKey = ''
      try {
        const response = await getProductionMonitorRouteTrack(this.workorderId, card.xtransferNo, card.routeId)
        if (sequence === this.routeSequence && this.expandedKey === key) this.routeTracks[key] = response.data
      } catch {
        if (sequence === this.routeSequence) this.routeErrorKey = key
      } finally { if (sequence === this.routeSequence && this.routeLoadingKey === key) this.routeLoadingKey = '' }
    },
    retryRoute(card) { this.routeErrorKey = ''; this.expandRoute(this.trackKey(card)) },
    displayValue(value) { return value === null || value === undefined || value === '' ? '—' : value },
    formatNumber(value) { return value === null || value === undefined ? '—' : String(value) },
    formatTime(value) { return parseTime(value) || '—' }
  }
}
</script>

<style scoped>
.flowcard-panel { padding-top: 8px; }
.observed-note { margin-bottom: 12px; }
.flowcard-heading { display: flex; align-items: center; flex-wrap: wrap; gap: 14px; padding-right: 12px; }
.flowcard-heading strong { color: var(--ui-text); }
.flowcard-heading span { color: var(--ui-text-secondary); font-size: 12px; }
.flowcard-facts { padding: 8px 0; color: var(--ui-text-muted); font-size: 12px; }
.route-track { padding-top: 6px; }
.route-steps { margin: 14px 0 20px 5px; padding-left: 18px; border-left: 2px solid #e7ecf2; }
.route-step { position: relative; padding: 10px 0 11px; border-bottom: 1px solid #f2f3f5; }
.route-step:last-child { border-bottom: 0; }
.route-dot { position: absolute; top: 16px; left: -24px; width: 9px; height: 9px; border: 2px solid #c0c4cc; border-radius: 50%; background: var(--ui-surface); }
.route-dot.is-observed { border-color: var(--ui-primary); background: var(--ui-primary); }
.route-step-heading { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.route-step-heading strong { color: #303846; font-size: 13px; font-weight: 600; }
.route-order { min-width: 34px; color: #87909e; font-size: 12px; }
.route-step-facts { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 16px; margin: 6px 0 0 42px; color: #87909e; font-size: 11px; }
.historical-only { margin-top: 18px; padding: 12px; background: #f7f8fa; border: 1px solid #edf0f4; border-radius: 4px; }
.historical-only h4 { margin: 0 0 10px; font-size: 13px; }
.historical-row { display: flex; justify-content: space-between; align-items: center; gap: 20px; padding: 5px 0; color: var(--ui-text-secondary); font-size: 12px; }
.historical-row > div { display: flex; flex-direction: column; gap: 4px; }
.historical-row > div span { color: var(--ui-text-muted); font-size: 11px; }
@media (max-width: 760px) { .flowcard-heading { gap: 8px; }.route-step-facts { margin-left: 0; }.historical-row { align-items: flex-start; flex-direction: column; gap: 4px; } }
</style>
