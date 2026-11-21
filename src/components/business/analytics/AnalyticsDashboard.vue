<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MaterialSelect from '@/components/business/MaterialSelect.vue'
import WarehouseSelect from '@/components/business/WarehouseSelect.vue'
import WorkOrderSelect from '@/components/business/production/WorkOrderSelect.vue'
import ExecutionSelect from '@/components/business/production/ExecutionSelect.vue'
import MetricValue from '@/components/MetricValue.vue'
import CodeText from '@/components/CodeText.vue'
import AnalysisRegion from './AnalysisRegion.vue'
import FactChart from './FactChart.vue'
import type { Chart } from './chart'
import { calendarDay, plusDays, useSection, type Section } from './useSection'
import { recentReports } from '@/api/production/workspace'
import { access, readAnalytics, type Amount } from '@/api/production/analytics'
import { executionStatusLabel } from '@/lib/production/executionState'
import { menuPathForComponent } from '@/lib/menuWorkspaces'
import { useAuth } from '@/stores/auth'
import { parseTime } from '@/utils/ruoyi'
type Topic = 'overview' | 'orders' | 'process' | 'quality' | 'inventory'
const props = defineProps<{ topic: Topic }>()
const auth = useAuth(), router = useRouter()
const route = useRoute()
const initialDay = (value: unknown, fallback: string) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback
  const date = new Date(value + 'T00:00:00Z')
  return Number.isFinite(date.getTime()) && date.toISOString().startsWith(value) ? value : fallback
}
const start = ref(initialDay(route.query.start, calendarDay(-6))), end = ref(initialDay(route.query.end, calendarDay()))
const preset = ref(['今天', '近 7 天', '本月', '自定义'].includes(String(route.query.period)) ? String(route.query.period) : '近 7 天')
const product = ref<string | null>(null), warehouse = ref<string | null>(null), order = ref<string | null>(null), batch = ref('')
const status = ref(''), day = ref(''), page = ref(1), recordKind = ref(''), node = ref(''), qualityGroup = ref('types')
const progressBucket = ref('')
const defectFilter = ref<{ dimension: string; id: string; name: string } | null>(null)
watch([() => props.topic, start, end, product, status], () => {
  progressBucket.value = ''
  defectFilter.value = null
}, { flush: 'sync' })
watch([progressBucket, defectFilter], () => {
  page.value = 1
}, { flush: 'sync' })
const pageSize = 20
const valid = computed(() => !!start.value && !!end.value && start.value <= end.value && end.value <= plusDays(start.value, 91))
const period = () => ({ start: start.value, end: end.value })
const detailPeriod = () => day.value ? { start: day.value, end: day.value } : period()
const paging = () => ({ offset: (page.value - 1) * pageSize, limit: pageSize })
const show = (...tabs: Topic[]) => tabs.includes(props.topic)
const active = (...tabs: Topic[]) => valid.value && show(...tabs)
const orderLabels: Record<string, string> = { DRAFT: '草稿', RELEASED: '已下达', COMPLETED: '已完工', CANCELLED: '已作废' }
const wasteLabel = (key: string | null) => ({ PROCESS: '工废', MATERIAL: '料废', BOTH: '工废＋料废' }[key || ''] || key || '未记录')
const has = (p: string) => auth.hasPermission(p, 'factory')

function choosePeriod(value: string) {
  preset.value = value
  if (value === '自定义') return
  end.value = calendarDay()
  start.value = value === '今天' ? end.value : value === '本月' ? end.value.slice(0, 7) + '-01' : calendarDay(-6)
}

watch(() => props.topic, () => {
  product.value = null
  warehouse.value = null
  order.value = null
  batch.value = ''
  node.value = ''
  status.value = ''
  recordKind.value = show('inventory') ? (has(access.stock) ? 'stocks' : 'flows') : show('overview') && !has(access.orders) ? 'reports' : 'orders'
  day.value = ''
  page.value = 1
}, { immediate: true, flush: 'sync' })
watch(order, () => {
  batch.value = ''
  node.value = ''
}, { flush: 'sync' })
watch(batch, () => {
  node.value = ''
}, { flush: 'sync' })
watch([start, end, product, warehouse, order, batch, status, recordKind], () => {
  day.value = ''
  page.value = 1
}, { flush: 'sync' })
watch(day, () => {
  page.value = 1
}, { flush: 'sync' })
const orderStates = useSection(access.orders, () => active('overview', 'orders'), s => readAnalytics('order-states', { ...period(), product: product.value, status: status.value }, s))
const summary = useSection(access.orders, () => active('orders'), s => readAnalytics('order-summary', { ...period(), product: product.value, status: status.value }, s))
const orderRows = useSection(access.orders, () => active('overview', 'orders') && recordKind.value === 'orders', s => readAnalytics('orders', { ...period(), ...paging(), product: product.value, status: status.value, progress: progressBucket.value }, s))
const exec = useSection(access.execution, () => active('overview', 'process'), s => readAnalytics('executions', { ...period(), order: order.value }, s))
const quantities = useSection(access.quantity, () => show('process') && !!batch.value, s => readAnalytics('path', { execution: batch.value, order: order.value }, s).then(r => ({ ...r.facts, unitName: r.unitName })))
const reportDays = useSection(access.report, () => active('overview'), s => readAnalytics('report-days', period(), s))
const reportRows = useSection(access.report, () => active('overview') && recordKind.value === 'reports', s => readAnalytics('reports', { ...detailPeriod(), ...paging() }, s))
const recent = useSection(access.report, () => show('overview') && recordKind.value === 'recent', recentReports)
const declarations = useSection(access.quality, () => active('overview', 'quality'), s => readAnalytics('declaration-count', { ...period(), product: product.value }, s))
const productRank = useSection(access.quality, () => active('quality'), s => readAnalytics('defect-products', period(), s))
const quality = useSection(access.quality, () => active('quality') && !!product.value, s => readAnalytics('quality', { ...period(), material: product.value }, s))
const defects = useSection(access.quality, () => active('quality'), s => readAnalytics('defects', { ...detailPeriod(), ...paging(), product: product.value, ...(defectFilter.value ? { [defectFilter.value.dimension]: defectFilter.value.id } : {}) }, s))
const stock = useSection(access.stock, () => show('inventory') && !!product.value, s => readAnalytics('balances', { material: product.value, warehouse: warehouse.value }, s), true)
const stockRows = useSection(access.stock, () => show('inventory') && recordKind.value === 'stocks', s => readAnalytics('stocks', { ...paging(), material: product.value, warehouse: warehouse.value }, s), true)
const moves = useSection(access.flow, () => active('inventory') && !!product.value, s => readAnalytics('movements', { ...period(), material: product.value, warehouse: warehouse.value }, s), true)
const flows = useSection(access.flow, () => active('inventory') && !!product.value && recordKind.value === 'flows', s => readAnalytics('flows', { ...detailPeriod(), ...paging(), material: product.value, warehouse: warehouse.value }, s), true)
const days = computed(() => {
  const result:string[] = []
  if (valid.value) for (let d = start.value;d <= end.value;d = plusDays(d, 1)) result.push(d)
  return result
})
const orderTotal = computed(() => orderStates.value.data?.reduce((n, r) => n + r.count, 0))
const nodes = computed(() => quantities.value.data?.nodes.filter(n => !node.value || n.routingNodeId === node.value) || [])

function timeline(title:string, unit:string, keys:string[], lines:{ name: string; values: (number | string | null)[] }[], type:Chart['type'] = 'line'):Chart {
  return { title, caption: '', unit, keys, labels: keys.map(k => k.slice(5)), series: lines, type }
}

const reportChart = computed(() => {
  const counts = new Map(reportDays.value.data?.map(r => [r.key, r.count]))
  return timeline('生产报工趋势', '笔', days.value, [{ name: '有效报工', values: days.value.map(d => counts.get(d) ?? 0) }])
})
const qualityChart = computed(() => {
  const values = new Map(quality.value.data?.dates.map(d => [d.key, d.quantity]))
  return timeline('独立净不良趋势', quality.value.data?.unit || '单位待确认', days.value, [{ name: '独立净不良', values: days.value.map(d => values.has(d) ? values.get(d)! : 0) }], 'bar')
})
const movementChart = computed(() => {
  const values = new Map(moves.value.data?.days.map(d => [d.day, d]))
  return timeline('物料出入库趋势', moves.value.data?.unit || '单位待确认', days.value, [{ name: '入库', values: days.value.map(d => values.get(d)?.inbound ?? 0) }, { name: '出库', values: days.value.map(d => values.get(d)?.outbound ?? 0) }], 'bar')
})
const nodeChart = computed<Chart>(() => ({
  title: '实际路径数量', caption: '', unit: quantities.value.data?.unitName || '单位待确认', keys: nodes.value.map(n => n.routingNodeId), labels: nodes.value.map(n => n.name || n.code), type: 'bar',
  series: [{ name: '投入', values: nodes.value.map(n => n.inputQty) }, { name: '有效报工', values: nodes.value.map(n => n.reportedQty) }, { name: '有效产出', values: nodes.value.map(n => n.effectiveOutputQty) }],
}))
const qualityGroups = computed<Amount[]>(() => {
  const data = quality.value.data
  if (!data) return []
  return { types: data.types, waste: data.waste, operations: data.operations }[qualityGroup.value] || []
})

function filterDefects(row:Amount) {
  if (!row.id) return
  defectFilter.value = { dimension: qualityGroup.value === 'types' ? 'type' : qualityGroup.value === 'operations' ? 'operation' : 'waste', id: row.id, name: qualityGroup.value === 'waste' ? wasteLabel(row.key) : row.key || '未记录' }
}

function byDay(key:string) {
  if (show('overview')) recordKind.value = 'reports'
  if (show('inventory')) recordKind.value = 'flows'
  day.value = key
}

function go(component:string, permission:string, query:Record<string, string>) {
  const path = menuPathForComponent(auth.factoryMenus, component)
  if (path && has(permission)) void router.push({ path, query })
}

function canGo(component:string, permission:string) {
  return !!menuPathForComponent(auth.factoryMenus, component) && has(permission)
}

const executionComponent = 'production/mesProductionExecution/index', reportComponent = 'production/productionReport/index', qualityComponent = 'quality/productionDefect/index'

function gotoOrder(id:string) {
  go(executionComponent, access.execution, { workorderId: id })
}

function documentComponent(direction:string) {
  return direction === 'IN' ? 'wm/inboundDocuments/index' : 'wm/outboundDocuments/index'
}

const docPermission = 'business:wm:stock:document:query'

function metric(label:string, value:unknown, unit:string, note:string, section:Section<unknown>) {
  const reason = section.state === 'idle' ? note : section.message || (section.state === 'loading' ? '正在读取…' : note)
  return { label, value: value == null ? '—' : String(value), unit: value == null ? '' : unit, note: reason }
}

const metrics = computed(() => {
  const count = (key:string) => orderStates.value.data?.find(r => r.key === key)?.count ?? (orderStates.value.data ? 0 : undefined)
  if (show('overview', 'orders')) {
    const result = [metric('期间新建工单', orderTotal.value, '张', '按工单创建日', orderStates.value), metric('其中已完工', count('COMPLETED'), '张', '期间工单的当前状态', orderStates.value)]
    if (show('overview')) return [...result, metric('当前运行批次', exec.value.data?.states.find(r => r.key === 'RUNNING')?.count ?? (exec.value.data ? 0 : undefined), '个', '当前快照', exec.value), metric('有效质量申报', declarations.value.data, '笔', '按发生日去重', declarations.value)]
    return [...result, metric('计划数量', summary.value.data?.planned, summary.value.data?.unit || '', '单产品 · 排除已作废', summary.value), metric('正式完成量', summary.value.data?.completed, summary.value.data?.unit || '', '已收尾执行贡献', summary.value)]
  }
  if (show('process')) return [metric('期间创建批次', exec.value.data?.created, '个', '按创建日', exec.value), metric('期间完成批次', exec.value.data?.completed, '个', '按正式收尾日', exec.value), metric('当前有效投入', quantities.value.data?.productionInputQty, quantities.value.data?.unitName || '', '所选执行批次', quantities.value), metric('实际路径节点', quantities.value.data?.nodes.length, '道', '所选执行批次', quantities.value)]
  if (show('quality')) return [metric('有效申报', declarations.value.data, '笔', '按最新申报身份', declarations.value), metric('独立净不良', quality.value.data?.net, quality.value.data?.unit || '', '单产品 · 已扣正式返还', quality.value), metric('待核实申报', quality.value.data?.unverified, '笔', '待核实归属', quality.value), { label: '不良率', value: '—', unit: '', note: '缺少同范围检验分母' }]
  return [metric('当前账面库存', stock.value.data?.quantity, stock.value.data?.unit || '', '选择物料查看当前量', stock.value), metric('期间生产领料', moves.value.data?.issued, moves.value.data?.unit || '', '有效领出 · 含冲销', moves.value), metric('期间生产退料', moves.value.data?.returned, moves.value.data?.unit || '', '引用原领料明细', moves.value), metric('净领料', moves.value.data?.net, moves.value.data?.unit || '', '实际消耗暂无可靠事实', moves.value)]
})
const total = computed(() => show('quality') ? defects.value.data?.total : show('inventory') ? (recordKind.value === 'stocks' ? stockRows.value.data?.total : flows.value.data?.total) : recordKind.value === 'reports' ? reportRows.value.data?.total : orderRows.value.data?.total)
</script>
<template>
  <div class="production-analytics">
    <div class="analysis-filter filter-panel">
      <el-radio-group :model-value="preset" aria-label="统计期间" @change="choosePeriod(String($event))"><el-radio-button v-for="p in ['今天','近 7 天','本月','自定义']" :key="p" :value="p">{{ p }}</el-radio-button></el-radio-group>
      <template v-if="preset==='自定义'"><label>开始日期<input v-model="start" type="date"></label><label>结束日期<input v-model="end" type="date"></label></template><small v-else>{{ start }} — {{ end }}</small>
      <label v-if="show('orders','quality','inventory')">{{ show('inventory')?'物料':'产品' }}<MaterialSelect v-model="product" /></label>
      <label v-if="show('orders') || (show('overview') && status)">工单状态<el-select v-model="status" clearable placeholder="全部状态"><el-option v-for="(label,value) in orderLabels" :key="value" :label="label" :value="value" /></el-select></label>
      <template v-if="show('process')"><label>工单<WorkOrderSelect v-model="order" /></label><el-button v-if="order" link @click="order=null">全部工单</el-button><label>执行批次<ExecutionSelect v-model="batch" :workorder-id="order" /></label></template>
      <label v-if="show('inventory')">仓库<WarehouseSelect v-model="warehouse" source="LOCAL" history /></label>
    </div>
    <p v-if="!valid" role="alert">请选择有效的起止日期，范围最多 92 天。</p>
    <section class="analytics-metrics" aria-label="关键指标"><div v-for="m in metrics" :key="m.label"><span>{{ m.label }}</span><MetricValue :value="m.value" :unit="m.unit" /><small>{{ m.note }}</small></div></section>
    <div v-if="show('overview')" class="analytics-pair">
      <AnalysisRegion title="生产报工趋势" caption="按原报工日统计当前有效笔数" :result="reportDays" :empty="!reportDays.data?.length"><FactChart :chart="reportChart" @select="byDay" /></AnalysisRegion>
      <AnalysisRegion title="工单状态分布" caption="期间新建工单的当前状态" :result="orderStates" :empty="!orderStates.data?.length">
        <div class="analysis-bars"><button v-for="r in orderStates.data" :key="r.key" @click="status=r.key;recordKind='orders'"><span>{{ orderLabels[r.key]||r.key }}</span><b>{{ r.count }} 张</b><progress :value="r.count" :max="orderTotal||1" /></button></div>
      </AnalysisRegion>
    </div>
    <div v-if="show('orders')" class="analytics-pair">
      <AnalysisRegion title="工单完成率排名" caption="当前有效工单 · 前十张" :result="summary" :empty="!summary.data?.ranking.length">
        <div class="analysis-bars"><button v-for="r in summary.data?.ranking" :key="r.id" :disabled="!canGo(executionComponent,access.execution)" @click="gotoOrder(r.id)"><CodeText :value="r.code" /><b>{{ r.percent }}%</b><progress :value="Number(r.percent)" max="100" /></button></div>
      </AnalysisRegion>
      <AnalysisRegion title="工单进度分布" caption="正式完工贡献 / 计划量 · 张" :result="summary"><div class="analysis-bars"><button v-for="r in summary.data?.progress" :key="r.key" @click="progressBucket=r.key"><span>{{ r.key }}</span><b>{{ r.count }} 张</b><progress :value="r.count" :max="orderTotal||1" /></button></div></AnalysisRegion>
    </div>
    <AnalysisRegion v-if="show('overview','process')" title="当前执行批次" caption="当前状态 · 不按历史日期回推" :result="exec" :empty="!exec.data?.states.length"><div class="analysis-strip"><span v-for="r in exec.data?.states" :key="r.key">{{ executionStatusLabel(r.key) }} <b>{{ r.count }}</b></span></div></AnalysisRegion>
    <template v-if="show('process')">
      <AnalysisRegion title="执行路径与节点数量" caption="所选执行当前正式数量" :result="quantities" prompt="选择工单和执行批次，或输入执行唯一码">
        <template v-if="quantities.data">
          <p v-if="!quantities.data.routingId" class="analytics-state">无工艺，按正式投入直接入库。</p>
          <template v-else><div class="analysis-strip"><span>{{ quantities.data.routingLabel }} · {{ ({ LOCKED:'已锁定', SELECTED:'已选择，未锁定', UNSELECTED:'尚未选择' } as Record<string,string>)[quantities.data.pathStatus || ''] || quantities.data.pathStatus }}</span><el-select v-model="node" clearable placeholder="全部实际工序"><el-option v-for="n in quantities.data.nodes" :key="n.routingNodeId" :value="n.routingNodeId" :label="n.name || n.code" /></el-select></div>
            <FactChart v-if="nodes.length" :chart="nodeChart" @select="key=>node=key" /><p v-else class="analytics-state">{{ quantities.data.boundary || '当前批次尚无实际路径节点' }}</p>
            <el-table v-if="nodes.length" :data="nodes"><el-table-column prop="name" label="实际工序" /><el-table-column prop="inputQty" label="有效投入" /><el-table-column prop="reportedQty" label="有效报工" /><el-table-column prop="directDefectQty" label="直接不良" /><el-table-column prop="effectiveOutputQty" label="有效产出" /><el-table-column prop="availableQty" label="可报余量" /></el-table>
          </template><el-button v-if="canGo(reportComponent,access.quantity)" link type="primary" @click="go(reportComponent,access.quantity,{executionCode:batch})">查看执行数量及报工流水 →</el-button>
        </template>
      </AnalysisRegion>
    </template>
    <template v-if="show('quality')">
      <AnalysisRegion title="产品申报笔数排名" caption="跨产品按记录笔数比较 · 前十项" :result="productRank" :empty="!productRank.data?.length"><div class="analysis-strip"><el-button v-for="r in productRank.data" :key="r.id" :disabled="!r.id" :type="product===r.id?'primary':'default'" plain @click="product=r.id">{{ r.name || '产品待确认' }} · {{ r.count }} 笔</el-button></div></AnalysisRegion>
      <div class="analytics-pair">
        <AnalysisRegion title="独立净不良趋势" caption="按申报发生日归属 · 扣除正式返还" :result="quality" prompt="选择产品查看同单位净量" :empty="!quality.data?.dates.length"><p v-if="quality.data?.unresolved" role="status">{{ quality.data.unresolved }} 笔申报待确认，受影响的净量留空。</p><FactChart :chart="qualityChart" @select="byDay" /></AnalysisRegion>
        <AnalysisRegion title="不良构成" :result="quality" prompt="选择产品查看不良构成" :empty="!quality.data?.dates.length">
          <small>重复归属 {{ quality.data?.overlap }} 笔 · 待核实 {{ quality.data?.unverified }} 笔</small><br><el-radio-group v-model="qualityGroup" size="small"><el-radio-button value="types">类型</el-radio-button><el-radio-button value="waste">废别</el-radio-button><el-radio-button value="operations">工序</el-radio-button></el-radio-group>
          <div class="analysis-bars"><button v-for="r in qualityGroups" :key="String(r.id)+r.key" :disabled="!r.id" @click="filterDefects(r)"><span>{{ qualityGroup==='waste'?wasteLabel(r.key):r.key || '未记录' }}</span><b>{{ r.quantity ?? '待确认' }} {{ quality.data?.unit }}</b></button></div>
        </AnalysisRegion>
      </div>
      <el-tag v-if="defectFilter" closable @close="defectFilter=null">申报明细 · {{ defectFilter.name }}</el-tag>
      <AnalysisRegion title="不良申报明细" caption="最新有效版本 · 数量为申报原量" :result="defects" :empty="!defects.data?.items.length">
        <el-table :data="defects.data?.items"><el-table-column label="申报编号" min-width="200" show-overflow-tooltip><template #default="{row}"><el-button v-if="canGo(qualityComponent,access.quality)" link type="primary" @click="go(qualityComponent,access.quality,{declarationId:row.declarationId,sourceFactory:auth.factoryId})">{{ row.declarationId }}</el-button><span v-else>{{ row.declarationId }}</span></template></el-table-column><el-table-column prop="product" label="产品" show-overflow-tooltip /><el-table-column prop="operationName" label="工序" /><el-table-column prop="typeName" label="不良类型" /><el-table-column label="废别"><template #default="{row}">{{ wasteLabel(row.waste) }}</template></el-table-column><el-table-column label="申报量"><template #default="{row}">{{ row.declared }} {{ row.unit }}</template></el-table-column><el-table-column label="发生时间" width="165"><template #default="{row}">{{ parseTime(row.occurredAt) }}</template></el-table-column></el-table>
      </AnalysisRegion>
    </template>
    <div v-if="show('inventory')" class="analytics-pair">
      <AnalysisRegion title="物料出入库趋势" caption="冲销按发生日冲减原方向" :result="moves" prompt="选择物料后按基本单位查看" :empty="!moves.data?.days.length"><FactChart :chart="movementChart" @select="byDay" /></AnalysisRegion>
      <AnalysisRegion title="各仓当前库存" caption="同一物料 · 余额前十仓" :result="stock" prompt="选择物料查看仓库分布" :empty="!stock.data?.warehouses.length"><p>当前可用量 <b>{{ stock.data?.available ?? '待确认' }} {{ stock.data?.unit }}</b></p><div class="analysis-bars"><button v-for="r in stock.data?.warehouses" :key="r.id" @click="warehouse=r.id;recordKind='stocks'"><span>{{ r.warehouse }}</span><b>{{ r.quantity }} {{ r.unit }}</b><progress :value="Number(r.quantity)" :max="Number(stock.data?.warehouses[0]?.quantity)||1" /></button></div></AnalysisRegion>
    </div>
    <div v-if="show('overview','inventory')" class="record-switch"><el-radio-group v-model="recordKind" size="small"><template v-if="show('overview')"><el-radio-button value="orders" :disabled="!has(access.orders)">工单进度</el-radio-button><el-radio-button value="reports" :disabled="!has(access.report)">有效报工流水</el-radio-button><el-radio-button value="recent" :disabled="!has(access.report)">最近活动</el-radio-button></template><template v-else><el-radio-button value="stocks" :disabled="!has(access.stock)">当前库存明细</el-radio-button><el-radio-button value="flows" :disabled="!has(access.flow)">收发流水</el-radio-button></template></el-radio-group></div>
    <el-tag v-if="progressBucket" closable @close="progressBucket=''">进度明细 · {{ progressBucket }}</el-tag>
    <el-tag v-if="day" closable @close="day=''">明细日期 {{ day }}</el-tag>
    <AnalysisRegion v-if="show('overview','orders') && recordKind==='orders'" title="工单执行概况" caption="建单期间 · 当前进度" :result="orderRows" :empty="!orderRows.data?.items.length"><el-table :data="orderRows.data?.items">
      <el-table-column label="工单编号" min-width="155"><template #default="{row}"><el-button v-if="canGo(executionComponent,access.execution)" link type="primary" @click="gotoOrder(row.id)">{{ row.code }}</el-button><span v-else>{{ row.code }}</span></template></el-table-column>
      <el-table-column prop="productName" label="产品" min-width="130" show-overflow-tooltip /><el-table-column prop="plannedQty" label="计划" /><el-table-column label="正式完成"><template #default="{row}">{{ row.completedQty ?? '待确认' }}</template></el-table-column><el-table-column prop="unitName" label="单位" /><el-table-column label="完成率"><template #default="{row}"><span :title="row.issue">{{ row.completionPercent==null?'待确认':row.completionPercent+'%' }}</span></template></el-table-column><el-table-column label="当前状态"><template #default="{row}">{{ orderLabels[row.status]||row.status }}</template></el-table-column></el-table></AnalysisRegion>
    <AnalysisRegion v-if="show('overview') && recordKind==='reports'" title="有效原报工流水" :result="reportRows" :empty="!reportRows.data?.items.length"><el-table :data="reportRows.data?.items"><el-table-column prop="workorderCode" label="工单" /><el-table-column label="执行唯一码" min-width="160" show-overflow-tooltip><template #default="{row}"><el-button v-if="canGo(reportComponent,access.quantity)" link type="primary" @click="go(reportComponent,access.quantity,{executionCode:row.executionCode})">{{ row.executionCode }}</el-button><span v-else>{{ row.executionCode }}</span></template></el-table-column><el-table-column prop="operationName" label="工序" /><el-table-column prop="effectiveQty" label="有效报工" /><el-table-column prop="unit" label="单位" /><el-table-column label="报工时间" width="165"><template #default="{row}">{{ parseTime(row.reportTime) }}</template></el-table-column></el-table></AnalysisRegion>
    <AnalysisRegion v-if="show('overview') && recordKind==='recent'" title="最近报工活动" caption="按录入顺序，含原报工及后续调整，不受期间筛选影响" :result="recent" :empty="!recent.data?.length">
      <el-table :data="recent.data"><el-table-column prop="workorderCode" label="工单" /><el-table-column prop="operationName" label="工序" /><el-table-column label="操作类型"><template #default="{row}">{{ row.recordType==='REPORT'?'报工':row.recordType==='ADJUSTMENT'?'调整 / 冲销':row.recordType }}</template></el-table-column><el-table-column prop="quantityDelta" label="变动数量" /><el-table-column prop="unitName" label="单位" /><el-table-column label="录入时间"><template #default="{row}">{{ parseTime(row.createTime) }}</template></el-table-column></el-table>
    </AnalysisRegion>
    <AnalysisRegion v-if="show('inventory') && recordKind==='stocks'" title="库存明细" caption="当前 LOCAL 余额" :result="stockRows" :empty="!stockRows.data?.items.length"><el-table :data="stockRows.data?.items"><el-table-column label="物料" min-width="150"><template #default="{row}"><el-button link type="primary" @click="product=row.materialId">{{ row.material || row.materialId }}</el-button></template></el-table-column><el-table-column prop="warehouse" label="仓库" /><el-table-column prop="bin" label="库位" /><el-table-column prop="batch" label="原料批次" show-overflow-tooltip /><el-table-column prop="quantity" label="账面数量" /><el-table-column prop="available" label="可用数量" /><el-table-column prop="unit" label="单位" /></el-table></AnalysisRegion>
    <AnalysisRegion v-if="show('inventory') && recordKind==='flows'" title="收发流水" caption="按库存动作日 · 保留反向动作" :result="flows" prompt="选择物料查看来源单据" :empty="!flows.data?.items.length"><el-table :data="flows.data?.items"><el-table-column label="来源单据" min-width="155"><template #default="{row}"><el-button v-if="canGo(documentComponent(row.direction),docPermission)" link type="primary" @click="go(documentComponent(row.direction),docPermission,{documentId:row.documentId,lineId:row.lineId})">{{ row.documentNo }}</el-button><span v-else>{{ row.documentNo }}</span></template></el-table-column><el-table-column prop="type" label="库存动作" /><el-table-column prop="delta" label="余额变动" /><el-table-column prop="unit" label="单位" /><el-table-column label="发生时间"><template #default="{row}">{{ parseTime(row.occurredAt) }}</template></el-table-column></el-table></AnalysisRegion>
    <el-pagination v-if="total" v-model:current-page="page" :page-size="pageSize" :total="total" layout="total, prev, pager, next" />
  </div>
</template>
<style scoped>
.production-analytics{container-type:inline-size;display:grid;gap:var(--ui-space-4);min-width:0}
.analysis-filter,.analysis-strip,.record-switch{display:flex;align-items:center;flex-wrap:wrap;gap:12px}
.analysis-filter label{white-space:nowrap;display:flex;align-items:center;gap:6px;color:var(--ui-text-secondary);font-size:13px}
.analysis-filter :deep(.el-select),.analysis-strip .el-select{width:170px}
.analysis-filter input{font:inherit;color:var(--ui-text);border:1px solid var(--ui-border);border-radius:var(--ui-radius);padding:5px;background:var(--ui-surface)}
.analytics-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));padding:18px 0;background:var(--ui-surface);border-block:1px solid var(--ui-border)}
.analytics-metrics>div{min-width:0;display:grid;gap:5px;padding:0 20px;border-right:1px solid var(--ui-border-soft)}
.analytics-metrics :deep(.metric-value){font-size:clamp(19px,2vw,32px);font-weight:600;overflow-wrap:anywhere;line-height:1.2}
.analytics-metrics small,.analysis-filter small,.analytics-panel small{color:var(--ui-text-secondary)}
.analytics-pair{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(230px,1fr);gap:16px}
.production-analytics :deep(.analytics-panel){background:var(--ui-surface);border:1px solid var(--ui-border);border-radius:var(--ui-radius-lg);min-width:0;padding:16px 20px}
.production-analytics :deep(.analytics-panel header){margin-bottom:12px}
.production-analytics :deep(.analytics-panel h2){margin:0;font-size:17px}
.production-analytics :deep(.analytics-state){min-height:85px;display:grid;align-content:center;justify-content:center;text-align:center;color:var(--ui-text-secondary)}
.analysis-bars{display:grid;gap:7px}.analysis-bars>button,.analysis-bars>div{background:transparent;border:0;color:var(--ui-text);font:inherit;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;text-align:left;gap:4px 12px;padding:3px 0}
.analysis-bars>button{cursor:pointer}.analysis-bars progress{grid-column:1/-1;accent-color:var(--mes-accent);width:100%;height:5px}.analysis-strip b{margin-left:4px}
.production-analytics :deep(.chart-surface){height:190px}.production-analytics :deep(.chart-legend){display:flex;gap:15px;align-items:center;font-size:12px}.production-analytics :deep(.chart-legend>span:first-child){margin-right:auto}.production-analytics :deep(.chart-legend i){display:inline-block;width:12px;height:3px;margin-right:4px}.production-analytics :deep(.ink-0){background:var(--mes-primary)}.production-analytics :deep(.ink-1){background:var(--mes-accent)}.production-analytics :deep(.ink-2){background:var(--ui-text-muted)}
.production-analytics :deep(.chart-values){font-size:12px;color:var(--ui-text-secondary)}.production-analytics :deep(.chart-values button){font:inherit;color:var(--mes-primary);border:0;background:var(--ui-running-bg);margin:3px;cursor:pointer}
@media(max-width:950px){.analytics-pair{grid-template-columns:minmax(0,1fr)}.analytics-metrics{grid-template-columns:repeat(2,minmax(0,1fr));row-gap:16px}}
.analysis-bars>button>span,.analysis-bars>div>span{min-width:0;overflow-wrap:anywhere}
.analysis-bars>button,.analysis-bars>div{min-width:0}
@container(max-width:860px){.analytics-pair{grid-template-columns:minmax(0,1fr)}.analytics-metrics{grid-template-columns:repeat(2,minmax(0,1fr));row-gap:16px}}
</style>
