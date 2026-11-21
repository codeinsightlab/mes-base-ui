<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ArrowRight, Box, Calendar, DataAnalysis, Document, Grid, Histogram, OfficeBuilding, Operation, SetUp, Tickets, User, View } from '@element-plus/icons-vue'
import PageHeader from '@/components/PageHeader.vue'
import MetricValue from '@/components/MetricValue.vue'
import CodeText from '@/components/CodeText.vue'
import { buildBoard, topics, type Entry, type Table, type Topic } from './boards'
import { balances, defects, executions, executionStates, format, inside, materials, operations, orders, orderStates, people, products, referenceDay, reports, shiftDay, stores, sum } from './sample'
import FactChart from './FactChart.vue'
const icons = { overview: Grid, orders: Tickets, process: SetUp, quality: DataAnalysis, inventory: Box, people: User }

function fromHash(): Topic {
  const key = location.hash.slice(1)
  return Object.hasOwn(topics, key) ? key as Topic : 'overview'
}

const topic = ref<Topic>(fromHash())
const period = ref('近 7 天')
const range = ref<[string, string]>([shiftDay(referenceDay, -6), referenceDay])
const start = computed(() => range.value[0]), end = computed(() => range.value[1])
const product = ref(''), order = ref(''), batch = ref(''), status = ref(''), op = ref(''), person = ref('')
const material = ref(materials[0].name), store = ref(''), erp = ref(false)
const scenario = ref('正常'), previewSettings = ref(false), alternative = ref(false), focus = ref(''), page = ref(1)
const drawer = ref(false), detail = ref<Entry>(), detailColumns = ref<string[]>([])
const scenarios = ['正常', '加载中', '无数据', '读取失败', '无权限', '数据不可用']
const orderOptions = computed(() => orders.filter(o => executions.some(e => e.order === o)))
const batchOptions = computed(() => executions.filter(e => e.order.id === order.value))
const operationOptions = computed(() => topic.value === 'process' ? (batchOptions.value.find(e => e.batch === batch.value)?.order.path || []) : operations)

function selectOrder(value: string) {
  order.value = value
  batch.value = batchOptions.value.find(e => e.state === '运行中')?.batch || batchOptions.value[0]?.batch || ''
  op.value = ''
}

function resetTopic() {
  product.value = topic.value === 'quality' || topic.value === 'orders' ? products[0] : ''
  order.value = ''
  batch.value = ''
  status.value = ''
  op.value = ''
  person.value = ''
  store.value = ''
  erp.value = false
  material.value = materials[0].name
  if (topic.value === 'process') selectOrder([...executions].reverse().find(e => e.state === '运行中' && e.nodes.length >= 3)!.order.id)
  alternative.value = topic.value === 'inventory'
  focus.value = ''
  page.value = 1
  scenario.value = '正常'
  drawer.value = false
}

function selectTopic(next: Topic) {
  if (topic.value !== next) {
    topic.value = next
    resetTopic()
  }
  if (location.hash.slice(1) !== next) location.hash = next
}

const hashChanged = () => selectTopic(fromHash())
window.addEventListener('hashchange', hashChanged)
onBeforeUnmount(() => window.removeEventListener('hashchange', hashChanged))
resetTopic()

function preset(value: string) {
  period.value = value
  if (value === '自定义') return
  range.value = [value === '今天' ? referenceDay : value === '本月' ? referenceDay.slice(0, 8) + '01' : shiftDay(referenceDay, -6), referenceDay]
}

const rangeError = computed(() => !start.value || !end.value || start.value > end.value ? '请选择有效的起止日期' : end.value > shiftDay(start.value, 91) ? '单次最多查看 92 天' : '')
const board = computed(() => buildBoard(topic.value, { start: start.value, end: end.value, product: product.value, order: order.value, batch: batch.value, status: status.value, op: op.value, person: person.value, material: material.value, store: store.value, erp: erp.value }))
const erpUnavailable = computed(() => topic.value === 'inventory' && erp.value)
const eventLogs = computed(() => reports.filter(r => inside(r.day, start.value, end.value) && (!product.value || r.execution.order.product === product.value) && (!op.value || r.op === op.value) && (!person.value || r.person === person.value)))
const eventTable = computed<Table>(() => ({
  title: '报工流水', note: '原报工记录', columns: ['记录编号', '工单编号', '操作人员', '工序', '有效报工量', '报工时间'],
  rows: eventLogs.value.map(r => ({ key: r.id, day: r.day, order: r.execution.order.id, batch: r.execution.batch, values: [r.id, r.execution.order.id, r.person, r.op, format(r.qty) + ' 件', r.day + ' ' + r.time] })),
}))
const table = computed<Table>(() => {
  if (!alternative.value) return board.value.table
  if (topic.value === 'quality') {
    const q = defects.filter(d => inside(d.day, start.value, end.value) && d.execution.order.product === product.value && (!op.value || d.op === op.value))
    return { title: '工序与废别', note: '同一产品 · 独立净不良', columns: ['工序', '工废（件）', '料废（件）', '净不良（件）'], rows: operations.filter(o => q.some(d => d.op === o)).map(o => {
      const rows = q.filter(d => d.op === o)
      return { key: o, values: [o, ...['工废', '料废'].map(w => format(sum(rows.filter(d => d.waste === w), d => d.net))), format(sum(rows, d => d.net))] }
    }) }
  }
  if (topic.value === 'inventory') {
    return { title: '库存明细', note: '当前余额', columns: ['物料编号', '仓库', '库位', '批次', '账面数量'], rows: balances.filter(b => !erp.value && b.material.name === material.value && (!store.value || store.value === b.store)).map(b => ({ key: b.lot, values: [b.material.code, b.store, b.bin, b.lot, format(b.qty) + ' ' + b.material.unit] })) }
  }
  return eventTable.value
})
const progressBucket = (value: number) => value === 0 ? '尚无完成量' : value >= 100 ? '已达计划' : '部分完成'
const rows = computed(() => table.value.rows.filter(r => !focus.value || r.day === focus.value || r.values.includes(focus.value)
  || (topic.value === 'orders' && r.progress !== undefined && progressBucket(r.progress) === focus.value)))
const selectedExecution = computed(() => batchOptions.value.find(e => e.batch === batch.value))
const qualityByProduct = computed(() => products.map(name => ({
  name, count: defects.filter(d => d.execution.order.product === name && inside(d.day, start.value, end.value) && (!op.value || op.value === d.op)).length,
})).sort((a, b) => b.count - a.count))
const currentRows = computed(() => rows.value.slice((page.value - 1) * 6, page.value * 6))
watch([start, end, product, order, batch, status, op, person, material, store, erp], () => {
  focus.value = ''
  page.value = 1
  drawer.value = false
}, { flush: 'sync' })

function switchTable(alt: boolean) {
  alternative.value = alt
  focus.value = ''
  page.value = 1
}

function drill(key: string, chart = false) {
  if (topic.value === 'people' || topic.value === 'overview') switchTable(chart || topic.value === 'people')
  if (topic.value === 'inventory') switchTable(!chart)
  if (topic.value === 'quality') switchTable(false)
  if (!chart && topic.value === 'process') {
    const match = batchOptions.value.find(e => e.state === key)
    if (match) {
      batch.value = match.batch
      op.value = ''
    }
    return
  }
  focus.value = key
  page.value = 1
  document.querySelector('#records')?.scrollIntoView({ behavior: 'instant', block: 'nearest' })
}

function showDetail(row: Entry, columns: string[]) {
  detail.value = row
  detailColumns.value = columns
  drawer.value = true
}

function openPath(row: Entry) {
  if (!row.order) return
  selectTopic('process')
  selectOrder(row.order)
  if (row.batch) batch.value = row.batch
  drawer.value = false
}

const counts = computed(() => executionStates.map(label => ({ label, value: executions.filter(e => e.state === label).length })))
const chartEmpty = computed(() => !board.value.chart.keys.length || board.value.chart.series.every(s => s.values.every(v => v === 0)))
const tabAlt = computed(() => ({ overview: '报工流水', orders: '', process: '', quality: '工序与废别', inventory: '库存明细', people: '报工流水' }[topic.value]))
const sideTotal = computed(() => sum(board.value.side.bars, b => b.value))
const token = (i: number) => ['--mes-primary', '--mes-accent', '--ui-text-muted', '--mes-border'][i % 4]
</script>
<template>
  <div class="analytics-shell">
    <aside class="rail">
      <a href="#overview" class="identity"><span class="brand-glyph"><Operation /></span><strong>MES <b>Base</b></strong></a>
      <div class="section-name">工厂工作空间</div>
      <nav aria-label="生产分析专题">
        <a v-for="(meta, key) in topics" :key="key" :href="'#' + key" :class="{ active: topic === key }" :aria-current="topic === key ? 'page' : undefined" @click.prevent="selectTopic(key)">
          <component :is="icons[key]" /><span>{{ meta[0] }}</span>
        </a>
      </nav>
      <div class="rail-bottom"><OfficeBuilding /><div><strong>示例制造工厂</strong><small>工厂数据空间</small></div></div>
    </aside>
    <div class="work">
      <header class="topbar"><div class="crumb"><Histogram /><span>生产分析</span><ArrowRight /><strong>{{ topics[topic][0] }}</strong></div>
        <el-popover v-model:visible="previewSettings" trigger="click" width="250" placement="bottom-end">
          <template #reference><button class="demo-mark"><View />示例数据 · 设计预览</button></template>
          <label class="setting">趋势区域状态
            <select v-model="scenario"><option v-for="s in scenarios" :key="s">{{ s }}</option></select>
          </label><p class="help">基准日期 {{ referenceDay }}。状态切换仅作用于主图，其他区域可独立读取。</p>
        </el-popover>
      </header>
      <main :class="'topic-' + topic">
        <PageHeader :title="topics[topic][0]" :description="topics[topic][1]">
          <div class="date-group" aria-label="统计期间"><button v-for="p in ['今天', '近 7 天', '本月', '自定义']" :key="p" :aria-pressed="period === p" @click="preset(p)">{{ p }}</button></div>
        </PageHeader>
        <div class="filters">
          <span class="date-stamp"><Calendar />{{ start }} — {{ end }}</span>
          <template v-if="period === '自定义'"><label>从 <input v-model="range[0]" type="date"></label><label>至 <input v-model="range[1]" type="date"></label></template>
          <label v-if="['orders','quality','people'].includes(topic)">产品<select v-model="product"><option v-if="topic !== 'quality'" value="">全部产品</option><option v-for="p in products" :key="p">{{ p }}</option></select></label>
          <label v-if="topic === 'orders'">状态<select v-model="status"><option value="">全部状态</option><option v-for="s in orderStates" :key="s">{{ s }}</option></select></label>
          <template v-if="topic === 'process'"><label>工单<select :value="order" @change="selectOrder(($event.target as HTMLSelectElement).value)"><option v-for="o in orderOptions" :key="o.id" :value="o.id">{{ o.id }}</option></select></label>
            <label>批次<select v-model="batch" @change="op = ''"><option v-for="b in batchOptions" :key="b.batch" :value="b.batch">{{ b.batch }} · {{ b.state }}</option></select></label></template>
          <label v-if="['process','quality','people'].includes(topic)">工序<select v-model="op"><option value="">全部工序</option><option v-for="o in operationOptions" :key="o">{{ o }}</option></select></label>
          <label v-if="topic === 'people'">人员<select v-model="person"><option value="">全部人员</option><option v-for="p in people" :key="p">{{ p }}</option></select></label>
          <template v-if="topic === 'inventory'"><label>来源<select v-model="erp"><option :value="false">LOCAL 工厂</option><option :value="true">ERP 工厂</option></select></label>
            <label>物料<select v-model="material"><option v-for="m in materials" :key="m.code">{{ m.name }}</option></select></label>
            <label>仓库<select v-model="store"><option value="">全部仓库</option><option v-for="s in stores" :key="s">{{ s }}</option></select></label></template>
        </div>
        <div v-if="rangeError" class="read-state" role="alert">{{ rangeError }}</div>
        <template v-else>
          <section class="metrics" aria-label="关键指标">
            <div v-for="([name, value, unit, note], i) in board.metrics" :key="name" class="reading">
              <div class="reading-name"><i :class="'mark-' + i" />{{ name }}</div>
              <MetricValue :class="{ compact: typeof value === 'number' && format(value).length > 9 }" :value="typeof value === 'number' ? format(value) : value" :unit="value === '—' ? '' : unit" />
              <small>{{ note }}</small>
            </div>
          </section>
          <section v-if="topic === 'process' && selectedExecution" class="route-band">
            <div><strong>{{ selectedExecution.nodes.length ? '实际路径' : '入库依据' }}</strong><span>{{ selectedExecution.order.route }} · {{ selectedExecution.batch }}</span></div>
            <ol v-if="selectedExecution.nodes.length"><li v-for="n in selectedExecution.nodes" :key="n.name"><button :aria-pressed="op === n.name" @click="op = op === n.name ? '' : n.name">{{ n.name }}</button></li></ol>
            <strong v-else>无工艺 · 直接入库</strong>
          </section>
          <div class="analysis-grid">
            <section class="chart-panel panel">
              <div class="panel-head"><div><h2>{{ board.chart.title }}</h2><p>{{ board.chart.caption }}</p></div><span class="kind">{{ topic === 'process' ? '当前路径' : '期间分析' }}</span></div>
              <div v-if="scenario !== '正常' || erpUnavailable || chartEmpty" class="read-state" role="status">
                <strong>{{ erpUnavailable ? 'ERP 权威库存数据不可用' : scenario === '正常' ? '当前范围暂无记录' : scenario }}</strong>
                <span>{{ erpUnavailable ? '当前设计未接入 ERP 权威收发接口。' : scenario === '数据不可用' ? '统计依据暂不完整。' : scenario === '无权限' ? '当前角色缺少此区域的读取权限。' : scenario === '读取失败' ? '此图表未取得结果，其他区域仍可查看。' : scenario === '加载中' ? '正在读取趋势…' : topic === 'process' && !operationOptions.length ? '无工艺，按正式投入直接入库。' : '可调整筛选范围。' }}</span>
                <button v-if="scenario === '读取失败' && !erpUnavailable" class="action" @click="scenario = '正常'">重试</button>
              </div>
              <FactChart v-else :chart="board.chart" @select="key => drill(key, true)" />
            </section>
            <section class="panel side-panel"><div class="panel-head"><div><h2>{{ board.side.title }}</h2><p>{{ board.side.caption }}</p></div></div>
              <div v-if="erpUnavailable" class="read-state">ERP 权威余额尚不可用</div>
              <template v-else>
                <div v-if="topic === 'overview'" class="stacked" aria-hidden="true"><i v-for="(bar, i) in board.side.bars" :key="bar.label" :style="{ flexGrow: bar.value, background: 'var(' + token(i) + ')' }" /></div>
                <div class="breakdown" :class="{ composition: topic === 'overview' }"><button v-for="(bar, i) in board.side.bars" :key="bar.label" :disabled="!bar.value" @click="drill(bar.label)">
                  <span class="bar-name"><i v-if="topic === 'overview'" :style="{ background: 'var(' + token(i) + ')' }" />{{ bar.label }}</span>
                  <strong>{{ format(bar.value) }} <small>{{ board.side.unit }}</small></strong>
                  <small v-if="topic === 'overview'">{{ sideTotal ? Math.round(bar.value / sideTotal * 100) : 0 }}%</small>
                  <span v-else class="track"><i :style="{ width: (bar.value / Math.max(1, ...board.side.bars.map(b => b.value)) * 100) + '%' }" /></span>
                </button></div>
              </template>
            </section>
          </div>
          <div v-if="topic === 'overview'" class="execution-strip"><strong>当前执行批次</strong><span v-for="c in counts" :key="c.label">{{ c.label }} <b>{{ c.value }}</b></span></div>
          <section v-if="topic === 'quality'" class="quality-rank"><div><strong>产品申报笔数排名</strong><small>期间全部产品 · 笔</small></div><button v-for="item in qualityByProduct" :key="item.name" :class="{ chosen: product === item.name }" @click="product = item.name"><span :title="item.name">{{ item.name }}</span><b>{{ item.count }}</b></button></section>
          <section id="records" class="panel records">
            <div class="panel-head"><div><h2>{{ table.title }}</h2><p>{{ table.note }} · {{ rows.length }} 条</p></div>
              <div v-if="tabAlt" class="table-switch"><button :aria-pressed="!alternative" @click="switchTable(false)">{{ board.table.title }}</button><button :aria-pressed="alternative" @click="switchTable(true)">{{ tabAlt }}</button></div>
            </div>
            <button v-if="focus" class="focus-tag" @click="focus = ''; page = 1">筛选：{{ focus }} ×</button>
            <div v-if="erpUnavailable || !rows.length" class="read-state">{{ erpUnavailable ? '缺少 ERP 权威数据' : '当前条件下暂无记录' }}</div>
            <template v-else><div class="scroll-table"><table><thead><tr><th v-for="col in table.columns" :key="col" scope="col">{{ col }}</th></tr></thead><tbody><tr v-for="row in currentRows" :key="row.key">
              <td v-for="(v, i) in row.values" :key="i" :title="v">
                <button v-if="i === 0" class="row-link" @click="showDetail(row, table.columns)"><CodeText :value="v" /></button>
                <span v-else-if="table.columns[i] === '完成率' && row.progress !== undefined" class="progress-cell"><i><b :style="{ width: Math.min(100, row.progress) + '%' }" /></i>{{ v }}</span>
                <span v-else-if="table.columns[i] === '当前状态'" class="order-status"><i :style="{ background: 'var(' + token(orderStates.indexOf(v)) + ')' }" />{{ v }}</span><span v-else>{{ v }}</span>
              </td></tr></tbody></table></div>
              <div class="pager"><span>第 {{ page }} / {{ Math.ceil(rows.length / 6) }} 页</span><button :disabled="page === 1" @click="page--">上一页</button><button :disabled="page * 6 >= rows.length" @click="page++">下一页</button></div>
            </template>
          </section>
        </template>
      </main>
    </div>
    <el-drawer v-model="drawer" title="示例记录" size="min(440px, 90vw)">
      <template v-if="detail"><h2 class="drawer-title"><Document />{{ detail.key }}</h2>
        <dl><template v-for="(col, i) in detailColumns" :key="col"><dt>{{ col }}</dt><dd>{{ detail.values[i] }}</dd></template></dl>
        <button v-if="detail.order && orderOptions.some(o => o.id === detail?.order) && topic !== 'process'" class="action" @click="openPath(detail)">查看工单执行路径 →</button>
        <button v-if="topic === 'people' && !alternative" class="action" @click="person = detail.key; switchTable(true); drawer = false">查看人员报工流水 →</button>
      </template>
    </el-drawer>
  </div>
</template>
