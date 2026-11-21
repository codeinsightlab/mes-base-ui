<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import AnalysisRegion from './AnalysisRegion.vue'
import FactChart from './FactChart.vue'
import PageDialog from '@/components/page/PageDialog.vue'
import MetricValue from '@/components/MetricValue.vue'
import { access, readAnalytics, type OperationCell, type PersonReport } from '@/api/production/analytics'
import { productionReport } from '@/api/production/productionReport'
import { parseTime } from '@/utils/ruoyi'
import { plusDays, useSection } from './useSection'
import type { Chart } from './chart'

const props = defineProps<{ start: string;end: string;valid: boolean;product: string | null;order: string | null }>()
const person = ref(''), personLabel = ref(''), operation = ref(''), operationLabel = ref(''), day = ref('')
const peoplePage = ref(1), detailsPage = ref(1), historyPage = ref(1), voided = ref(false), originalId = ref('')
const detailControls = ref<HTMLElement>()
const recordUnit = ref('')

function showReport(row:PersonReport) {
  recordUnit.value = row.unit || ''
  originalId.value = row.id
}

function focusDetails() {
  void nextTick(() => detailControls.value?.scrollIntoView?.({ block: 'start' }))
}

function selectDay(date:string) {
  day.value = date
  focusDetails()
}

const limit = 20
const enabled = () => props.valid
const scope = () => ({ start: props.start, end: props.end, product: props.product, order: props.order, person: person.value, operation: operation.value })
const range = (page:number) => ({ offset: (page - 1) * limit, limit })
watch(() => [props.start, props.end, props.product, props.order], () => {
  day.value = ''
  person.value = ''
  operation.value = ''
}, { flush: 'sync' })
watch([() => props.start, () => props.end, () => props.product, () => props.order, person, operation], () => {
  peoplePage.value = 1
  detailsPage.value = 1
  originalId.value = ''
}, { flush: 'sync' })
watch([day, voided], () => {
  detailsPage.value = 1
  originalId.value = ''
}, { flush: 'sync' })
watch(originalId, () => {
  historyPage.value = 1
}, { flush: 'sync' })
const summary = useSection(access.report, enabled, s => readAnalytics('people-summary', scope(), s))
const matrix = useSection(access.report, enabled, s => readAnalytics('people', { ...scope(), ...range(peoplePage.value) }, s))
const dates = useSection(access.report, enabled, s => readAnalytics('people-days', scope(), s))
const details = useSection(access.report, enabled, s => readAnalytics('person-reports', { ...scope(), ...(day.value ? { start: day.value, end: day.value } : {}), voided: String(voided.value), ...range(detailsPage.value) }, s))
const original = useSection(access.report, () => !!originalId.value, () => productionReport.detail(originalId.value))
const history = useSection(access.report, () => !!originalId.value, () => productionReport.history(originalId.value, (historyPage.value - 1) * limit, limit))
const metrics = [['reports', '有效报工', '笔'], ['people', '参与人员', '人'], ['orders', '参与工单', '张'], ['operations', '参与工序', '道']] as const
const cells = computed(() => new Map(matrix.value.data?.cells.map(c => [c.person + '/' + c.operation, c])))
const columns = computed(() => Array.from(new Map(matrix.value.data?.cells.map(c => [c.operation, c.name || '工序待确认'])).entries()))
const columnPage = ref(1), columnSize = 6
const visibleColumns = computed(() => columns.value.slice((columnPage.value - 1) * columnSize, columnPage.value * columnSize))
watch(columns, () => {
  columnPage.value = 1
})
const chart = computed<Chart>(() => {
  const byDate = new Map(dates.value.data?.map(row => [row.key, row.count]))
  const keys:string[] = []
  if (props.valid) for (let t = props.start;t <= props.end;t = plusDays(t, 1))keys.push(t)
  return { title: '人员报工趋势', caption: '原报工日', unit: '笔', type: 'line', keys, labels: keys.map(k => k.slice(5)), series: [{ name: '有效报工', values: keys.map(k => byDate.get(k) ?? 0) }] }
})

function selectPerson(id:string, cell?:OperationCell) {
  personLabel.value = matrix.value.data?.names[id] || id
  if (cell?.operation) {
    operationLabel.value = cell.name || cell.operation
    operation.value = cell.operation
  }
  person.value = id
  voided.value = false
  focusDetails()
}

const detailMode = computed({ get: () => voided.value ? 'voided' : 'effective', set: (value:string) => {
  voided.value = value === 'voided'
} })
</script>
<template>
  <div v-if="person || operation || day" class="people-scopes">
    <el-tag v-if="person" closable @close="person=''">操作人员 · {{ personLabel }}</el-tag>
    <el-tag v-if="operation" closable @close="operation=''">工序 · {{ operationLabel }}</el-tag>
    <el-tag v-if="day" closable @close="day=''">明细日期 · {{ day }}</el-tag>
  </div>
  <AnalysisRegion title="人员参与概况" :result="summary" caption="按原报工日归属，当前有效报工去重">
    <div class="people-metrics"><div v-for="[key,label,unit] in metrics" :key="key"><span>{{ label }}</span><MetricValue :value="summary.data?.[key]" :unit="unit" /></div></div>
  </AnalysisRegion>
  <AnalysisRegion title="人员 × 工序" :result="matrix" caption="点击人员查看报工明细，点击工序单元格可进一步限定工序。选定产品后显示同工序有效量。" :empty="!matrix.data?.page.items.length">
    <div v-if="columns.length>columnSize" class="people-scopes column-selector"><span>本页工序列</span><el-pagination v-model:current-page="columnPage" :page-size="columnSize" :total="columns.length" small layout="total, prev, pager, next" /></div>
    <el-table :data="matrix.data?.page.items" row-key="person">
      <el-table-column label="原报工人" fixed min-width="145"><template #default="{row}"><el-button link type="primary" @click="selectPerson(row.person)">{{ matrix.data?.names[row.person] || row.person }}</el-button></template></el-table-column>
      <el-table-column label="有效报工（笔）" prop="reports" width="120" align="right" /><el-table-column label="参与工单" prop="orders" width="90" align="right" /><el-table-column label="参与工序" prop="operations" width="90" align="right" />
      <el-table-column v-for="[id,label] in visibleColumns" :key="String(id)" :label="label" min-width="140" align="right"><template #default="{row}">
        <template v-if="cells.has(row.person+'/'+id)"><el-button link type="primary" :disabled="!id" @click="selectPerson(row.person,cells.get(row.person+'/'+id))">{{ cells.get(row.person+'/'+id)?.reports }} 笔</el-button>
        <small v-if="product">{{ cells.get(row.person+'/'+id)?.quantity ?? '待确认' }} {{ cells.get(row.person+'/'+id)?.unit }}</small></template><span v-else>—</span>
      </template></el-table-column>
    </el-table>
    <el-pagination v-if="(matrix.data?.page.total||0)>limit" v-model:current-page="peoplePage" :page-size="limit" :total="matrix.data?.page.total" layout="total, prev, pager, next" />
  </AnalysisRegion>
  <div class="people-charts">
  <AnalysisRegion title="人员报工趋势" caption="订正回溯原日期，点击日期筛选明细" :result="dates" :empty="!dates.data?.length"><FactChart :chart="chart" @select="selectDay" /></AnalysisRegion>
    <AnalysisRegion title="人员参与分布" caption="本页按有效报工笔数排列，显示前十人" :result="matrix" :empty="!matrix.data?.page.items.length">
      <div class="distribution"><button v-for="row in matrix.data?.page.items.slice(0,10)" :key="row.person" @click="selectPerson(row.person)"><span>{{ matrix.data?.names[row.person] || row.person }}</span><strong>{{ row.reports }} 笔</strong><progress :value="row.reports" :max="matrix.data?.page.items[0]?.reports || 1" /></button></div>
    </AnalysisRegion>
  </div>
  <div ref="detailControls" class="people-scopes detail-controls"><span v-if="person">{{ personLabel }}{{ operation ? ' · '+operationLabel : '' }}</span><el-radio-group v-model="detailMode" size="small"><el-radio-button value="effective">有效报工</el-radio-button><el-radio-button value="voided">已全额冲销</el-radio-button></el-radio-group><span v-if="day">{{ day }}</span></div>
  <AnalysisRegion title="原始报工明细" :result="details" :caption="voided ? '仅供核对，已全额冲销的原记录不计入参与统计' : '按原报工日倒序，点击流水编号查看原记录与调整历史'" :empty="!details.data?.page.items.length">
    <el-table :data="details.data?.page.items" row-key="id"><el-table-column label="流水编号" width="120"><template #default="{row}"><el-button link type="primary" @click="showReport(row)">{{ row.id }}</el-button></template></el-table-column>
      <el-table-column label="原报工人" min-width="120"><template #default="{row}">{{ details.data?.names[row.person] || row.person }}</template></el-table-column>
      <el-table-column label="原报工时间" width="170"><template #default="{row}">{{ parseTime(row.reportTime) }}</template></el-table-column><el-table-column prop="workorder" label="工单" min-width="140" /><el-table-column prop="product" label="产品" min-width="140" show-overflow-tooltip /><el-table-column prop="operation" label="工序" min-width="120" />
      <el-table-column prop="original" label="原报工量" min-width="110" align="right" /><el-table-column prop="effective" label="当前有效量" min-width="120" align="right" /><el-table-column prop="unit" label="单位" width="75" />
    </el-table>
    <el-pagination v-if="(details.data?.page.total||0)>limit" v-model:current-page="detailsPage" :page-size="limit" :total="details.data?.page.total" layout="total, prev, pager, next" />
  </AnalysisRegion>
  <PageDialog :model-value="!!originalId" title="原始报工与调整历史" width="min(900px,94vw)" @update:model-value="v=>{if(!v)originalId=''}">
    <AnalysisRegion title="原始报工" :result="original"><p v-if="original.data">流水 {{ original.data.record.id }} · {{ original.data.record.operatorName || original.data.record.operatorUserId }} · {{ parseTime(original.data.record.reportTime) }}</p>
      <p v-if="original.data">原报工量 {{ original.data.record.quantityDelta }} {{ recordUnit }} · 当前有效量 {{ original.data.originalEffectiveQty }} {{ recordUnit }}</p></AnalysisRegion>
    <AnalysisRegion title="调整流水" :result="history" :empty="!history.data?.items.length"><el-table :data="history.data?.items"><el-table-column prop="id" label="调整编号" /><el-table-column label="调整录入人"><template #default="{row}">{{ row.recordedByName || row.recordedBy }}</template></el-table-column><el-table-column label="调整录入时间" min-width="165"><template #default="{row}">{{ parseTime(row.createTime) }}</template></el-table-column><el-table-column prop="quantityDelta" :label="recordUnit ? '增减量（'+recordUnit+'）' : '增减量'" /><el-table-column prop="reason" label="原因" /></el-table>
      <el-pagination v-if="(history.data?.total||0)>limit" v-model:current-page="historyPage" :page-size="limit" :total="history.data?.total" layout="total, prev, pager, next" /></AnalysisRegion>
  </PageDialog>
</template>
<style scoped>
.people-scopes{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.detail-controls{scroll-margin-top:16px}.column-selector{margin-bottom:8px}
.people-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));padding:8px 0;gap:16px}
.people-metrics>div{display:grid;gap:8px;padding-inline:12px;border-left:2px solid var(--ui-border)}
.people-metrics :deep(.metric-value){font-size:28px}.people-metrics :deep(small){font-size:12px}
.el-table small{display:block;color:var(--ui-text-secondary)}
@container(max-width:780px){.people-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}
.people-charts{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(240px,1fr);gap:16px}
.distribution{display:grid;gap:6px}.distribution button{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 8px;background:transparent;border:0;color:var(--ui-text);font:inherit;text-align:left;cursor:pointer}
.distribution progress{grid-column:1/-1;width:100%;height:5px;accent-color:var(--mes-accent)}
@container(max-width:860px){.people-charts{grid-template-columns:minmax(0,1fr)}}
</style>
