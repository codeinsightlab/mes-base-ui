import type { Chart, Line } from '@/components/business/analytics/chart'
import { balances, days, defects, executions, format, inside, materials, movements, orders, orderStates, people, reports, sum } from './sample'

export const topics = {
  overview: ['生产总览', '查看工单、执行批次与近期报工。'],
  orders: ['工单分析', '按建单期间查看当前完成进度，比较同一产品的工单。'],
  process: ['工序与执行', '沿执行批次的实际路径核对投入、报工与有效产出。'],
  quality: ['质量分析', '按申报日期追踪当前有效的独立净不良。'],
  inventory: ['库存与物料', '按物料和基本单位核对当前余额与期间收发。'],
  people: ['人员报工', '按实际操作人员查看报工参与情况与工序分布。'],
} as const
export type Topic = keyof typeof topics
export interface Filters {
  start: string; end: string; product: string; order: string; status: string; batch: string
  op: string; person: string; material: string; store: string; erp: boolean
}
export type Reading = [label: string, value: number | string, unit: string, note: string]
export type Measure = { label: string; value: number; token?: string }
export type { Chart } from '@/components/business/analytics/chart'
export interface Section { title: string; caption: string; unit: string; bars: Measure[] }
export interface Entry { key: string; order?: string; batch?: string; values: string[]; progress?: number; day?: string }
export interface Table { title: string; columns: string[]; rows: Entry[]; note: string }
export interface Board { metrics: Reading[]; chart: Chart; side: Section; table: Table }
export function buildBoard(topic: Topic, f: Filters): Board {
  const period = (d: string) => inside(d, f.start, f.end)
  const matches = (o: typeof orders[number]) => (!f.product || o.product === f.product) && (!f.order || o.id === f.order)
  const cohort = orders.filter(o => matches(o) && period(o.day) && (!f.status || o.status === f.status))
  const batches = executions.filter(e => matches(e.order) && (!f.batch || e.batch === f.batch))
  const logs = reports.filter(r => matches(r.execution.order) && period(r.day) && (!f.op || r.op === f.op) && (!f.person || r.person === f.person))
  const quality = defects.filter(d => matches(d.execution.order) && period(d.day) && (!f.op || d.op === f.op))
  const dates = days(f.start, f.end)
  const timeline = (title: string, caption: string, unit: string, series: Line[], type: Chart['type'] = 'line'): Chart => ({
    title, caption, unit, series, type, keys: dates, labels: dates.map(d => d.slice(5).replace('-', '/')),
  })
  const totalLogs = { name: '有效报工', values: dates.map(day => logs.filter(r => r.day === day).length) }
  const orderTable: Table = {
    title: '工单执行概况', note: '建单期间 · 当前进度', columns: ['工单编号', '产品', '计划数量', '正式完成', '完成率', '当前状态'],
    rows: [...cohort].reverse().map(o => ({
      key: o.id, order: o.id, day: o.day, progress: o.status === '已取消' ? undefined : o.done / o.plan * 100,
      values: [o.id, o.product, format(o.plan) + ' 件', format(o.done) + ' 件', o.status === '已取消' ? '—' : format(Math.round(o.done / o.plan * 1000) / 10) + '%', o.status],
    })),
  }
  if (topic === 'overview' || topic === 'orders') {
    const completed = cohort.filter(o => o.status === '已完成').length
    const active = cohort.filter(o => o.status !== '已取消')
    const bars = orderStates.map((label, i) => ({ label, value: cohort.filter(o => o.status === label).length, token: ['--mes-primary', '--mes-accent', '--ui-text-muted', '--mes-border'][i] }))
    if (topic === 'overview') return {
      metrics: [
        ['期间新建工单', cohort.length, '张', '按工单创建日'],
        ['其中已完成', completed, '张', '所选工单当前状态'],
        ['当前运行批次', batches.filter(e => e.state === '运行中').length, '个', '全厂当前快照'],
        ['有效质量申报', quality.length, '笔', '按不良发生日'],
      ],
      chart: timeline('生产报工趋势', '按原报工日统计有效记录', '笔', [totalLogs]),
      side: { title: '工单状态分布', caption: '期间新建工单的当前状态', unit: '张', bars },
      table: orderTable,
    }
    const ranked = [...active].sort((a, b) => b.done / b.plan - a.done / a.plan || b.id.localeCompare(a.id)).slice(0, 6)
    return {
      metrics: [['期间工单', cohort.length, '张', '含已取消工单'], ['已完成工单', completed, '张', '当前状态'], ['计划数量', f.product ? sum(active, o => o.plan) : '—', f.product ? '件' : '', f.product || '选择单一产品后显示'], ['正式完成量', f.product ? sum(active, o => o.done) : '—', f.product ? '件' : '', '已收尾执行贡献 · 排除取消']],
      chart: { title: '工单完成率排名', caption: '按当前完成率取前 6 张有效工单', unit: '%', type: 'bar', keys: ranked.map(o => o.id), labels: ranked.map(o => o.id.slice(-4)), series: [{ name: '完成率', values: ranked.map(o => Math.round(o.done / o.plan * 1000) / 10) }] },
      side: { title: '工单进度分布', caption: '有效工单 · 正式完成量 / 计划量', unit: '张', bars: [
        { label: '尚无完成量', value: active.filter(o => !o.done).length }, { label: '部分完成', value: active.filter(o => o.done > 0 && o.done < o.plan).length }, { label: '已达计划', value: active.filter(o => o.done >= o.plan).length },
      ] }, table: orderTable,
    }
  }
  if (topic === 'process') {
    const selected = batches[0], nodes = selected?.nodes.filter(n => !f.op || n.name === f.op) || []
    const current = selected ? batches.filter(b => b === selected) : []
    return {
      metrics: [['期间创建批次', batches.filter(e => period(e.created)).length, '个', '按执行创建日'], ['期间完成批次', batches.filter(e => e.closed && period(e.closed)).length, '个', '按完工事实日'], ['当前有效投入', selected?.state === '已取消' ? 0 : selected?.qty ?? '—', '件', '所选批次 · 已扣退料影响'], ['实际节点', nodes.length, '道', selected?.order.route || '未选择批次']],
      chart: { title: '实际路径数量', caption: selected?.order.path.length ? selected.order.path.join(' → ') : '无工艺执行按正式投入直接入库', unit: '件', type: 'bar', keys: nodes.map(n => n.name), labels: nodes.map(n => n.name), series: [{ name: '节点投入', values: nodes.map(n => n.input) }, { name: '有效报工', values: nodes.map(n => n.reported) }, { name: '有效产出', values: nodes.map(n => n.good) }] },
      side: { title: '执行状态', caption: '所选工单的当前批次 · 点击切换', unit: '个', bars: ['运行中', '已全部入库', '待开工', '已取消'].map(label => ({ label, value: executions.filter(e => e.order.id === f.order && e.state === label).length })) },
      table: { title: '实际节点明细', note: selected?.batch || '', columns: ['工序', '执行批次', '有效报工', '独立不良', '有效产出', '可报余量'], rows: current.flatMap(e => nodes.map(n => ({ key: e.batch + n.name, order: e.order.id, batch: e.batch, values: [n.name, e.batch, format(n.reported), format(n.defect), format(n.good), format(n.input - n.reported)] }))) },
    }
  }
  if (topic === 'quality') {
    const net = sum(quality, d => d.net)
    return {
      metrics: [['独立净不良', net, '件', '当前有效 · 已扣返还'], ['有效申报', quality.length, '笔', '按申报身份去重'], ['涉及工序', new Set(quality.map(d => d.op)).size, '道', '按实际工序'], ['不良率', '—', '', '缺少同范围检验分母']],
      chart: timeline('独立净不良趋势', '按申报发生日归属 · ' + f.product, '件', [{ name: '净不良', values: dates.map(day => sum(quality.filter(d => d.day === day), d => d.net)) }], 'bar'),
      side: { title: '不良类型分布', caption: '独立净不良 · ' + f.product, unit: '件', bars: ['尺寸偏差', '表面划伤', '孔位偏移'].map(label => ({ label, value: sum(quality.filter(d => d.kind === label), d => d.net) })).sort((a, b) => b.value - a.value) },
      table: { title: '不良申报明细', note: '最新有效版本', columns: ['申报编号', '工单编号', '工序', '不良类型', '废别', '净不良', '发生日期'], rows: [...quality].reverse().map(d => ({ key: d.id, order: d.execution.order.id, batch: d.execution.batch, day: d.day, values: [d.id, d.execution.order.id, d.op, d.kind, d.waste, d.net + ' 件', d.day] })) },
    }
  }
  if (topic === 'inventory') {
    const material = materials.find(m => m.name === f.material) || materials[0], unit = material.unit
    const stock = balances.filter(b => !f.erp && b.material === material && (!f.store || b.store === f.store))
    const flow = movements.filter(m => !f.erp && m.material === material && period(m.day) && (!f.store || m.store === f.store))
    const issued = sum(flow.filter(m => m.kind === '生产领料'), m => m.qty), returned = sum(flow.filter(m => m.kind === '生产退料'), m => m.qty)
    return {
      metrics: [['当前库存', sum(stock, b => b.qty), unit, '当前余额 · ' + material.code], ['生产领料', issued, unit, '期间有效领出'], ['生产退料', returned, unit, '期间有效退回'], ['净领料', issued - returned, unit, '实际消耗暂无可靠事实']].map(([l, v, u, n]) => [String(l), f.erp ? '—' : v, f.erp ? '' : String(u), f.erp ? 'ERP 权威数据不可用' : String(n)]),
      chart: timeline('物料出入库趋势', material.name + ' · 按库存动作日', unit, ['入库', '出库'].map((name, i) => ({ name, values: dates.map(day => sum(flow.filter(m => m.day === day && (m.kind === '生产领料') === Boolean(i)), m => m.qty)) })), 'bar'),
      side: { title: '各仓当前库存', caption: material.name + ' · 当前快照', unit, bars: stock.map(s => ({ label: s.store, value: s.qty })) },
      table: { title: '收发流水', note: '仅含所选物料', columns: ['单据编号', '业务类型', '物料', '仓库', '发生数量', '发生日期'], rows: [...flow].reverse().map(m => ({ key: m.id, order: m.order.id, day: m.day, values: [m.id, m.kind, material.code, m.store, format(m.qty) + ' ' + unit, m.day] })) },
    }
  }
  const ops = [...new Set(logs.map(r => r.op))].sort()
  return {
    metrics: [['有效报工', logs.length, '笔', '调整流水不另计次数'], ['参与人员', new Set(logs.map(r => r.person)).size, '人', '实际操作人员'], ['参与工单', new Set(logs.map(r => r.execution.order.id)).size, '张', '按工单去重'], ['参与工序', ops.length, '道', '按工序去重']],
    chart: timeline('人员报工趋势', f.person || '全部人员 · 原报工发生日', '笔', [totalLogs]),
    side: { title: '人员参与分布', caption: '按有效报工笔数', unit: '笔', bars: people.filter(p => !f.person || f.person === p).map(label => ({ label, value: logs.filter(r => r.person === label).length })) },
    table: { title: '人员 × 工序', note: '单元格为有效报工笔数', columns: ['操作人员', ...ops, '合计'], rows: people.filter(p => logs.some(r => r.person === p)).map(p => ({ key: p, values: [p, ...ops.map(op => String(logs.filter(r => r.person === p && r.op === op).length)), String(logs.filter(r => r.person === p).length)] })) },
  }
}
