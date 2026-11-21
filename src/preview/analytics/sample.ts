// Isolated design fixtures. Nothing in this module reads the business application.
export const referenceDay = '2026-11-21'
export function shiftDay(day: string, delta: number) {
  const value = new Date(day + 'T00:00:00Z')
  value.setUTCDate(value.getUTCDate() + delta)
  return value.toISOString().slice(0, 10)
}
export function days(start: string, end: string) {
  const result: string[] = []
  for (let day = start; day && day <= end && result.length < 92; day = shiftDay(day, 1)) result.push(day)
  return result
}
export const products = ['精密传动轴', '泵体端盖', '伺服传动系统用高精度铝合金一体式安装支座', '定位套筒']
export const people = ['陈宁', '沈岚', '林浩', '郑文', '顾青', '徐远']
export const operations = ['粗车', '精车', '铣削', '终检']
export const materials = [
  { name: '铝合金棒材', code: 'AL-6061', unit: 'kg' },
  { name: '深沟球轴承', code: 'BR-6205', unit: '个' },
]
export const stores = ['原料一库', '线边仓', '备料库']
export const orderStates = ['已下达', '已完成', '草稿', '已取消']
export const executionStates = ['运行中', '已全部入库', '待开工', '已取消']
const startDay = '2026-10-21'
const paths = [['粗车', '精车', '终检'], ['铣削', '终检'], ['精车', '终检'], []]
const routeTypes = ['LINEAR', 'BRANCH', 'MERGE', '无工艺']
export const orders = Array.from({ length: 96 }, (_, i) => {
  const product = products[i % 4]
  const status = orderStates[[0, 1, 0, 2, 1, 0, 3, 1, 0, 1, 0][i % 11]]
  const plan = [360, 840, 1200, 640, 480, 960, 560][i % 7]
  const route = (Math.floor(i / 4) + i) % 4
  const day = shiftDay(startDay, Math.floor(i / 3))
  // A released order can contain both an already closed execution and an open one.
  const done = status === '已完成' ? plan : status === '已下达' ? Math.floor(plan * ((i % 5) / 6)) : 0
  return { id: 'WO-2611-' + String(1001 + i), product, status, plan, done, day, route: routeTypes[route], path: paths[route] }
})
export const executions = orders.flatMap((order, i) => {
  if (order.status === '草稿') return []
  const parts: { state: string; qty: number }[] = []
  if (order.done) parts.push({ state: '已全部入库', qty: order.done })
  if (order.plan > order.done) parts.push({ state: order.status === '已取消' ? '已取消' : i % 5 === 0 ? '待开工' : '运行中', qty: order.plan - order.done })
  return parts.map(({ state, qty }, part) => ({
    order, state, qty, batch: 'P' + order.day.replaceAll('-', '').slice(2) + '-' + (100 + i * 2 + part),
    created: order.day, closed: state === '已全部入库' ? order.day : '',
    nodes: order.path.map((name, index) => {
      const active = state === '运行中', closed = state === '已全部入库'
      const previous = index === 0 ? qty : Math.floor(qty * (0.86 - (index - 1) * 0.21)) - 2
      const reported = closed ? qty : active ? Math.floor(qty * (0.86 - index * 0.21)) : 0
      const defect = active ? 2 : 0
      return { name, input: state === '已取消' ? 0 : closed || index === 0 ? qty : active ? previous : 0, reported, good: reported - defect, defect }
    }),
  }))
})
export const reports = executions.flatMap((execution, e) => execution.nodes.flatMap((node, n) => {
  if (!node.reported) return []
  const count = 1 + (e + n) % 3
  return Array.from({ length: count }, (_, j) => ({
    id: 'RP-' + (10000 + e * 12 + n * 3 + j), execution, op: node.name, person: people[(e + n + j) % people.length],
    day: execution.created, time: String(8 + (e + n + j) % 10).padStart(2, '0') + ':30',
    qty: Math.floor(node.reported / count) + (j === 0 ? node.reported % count : 0),
  }))
})).sort((a, b) => (b.day + b.time).localeCompare(a.day + a.time))
export const defects = executions.flatMap((execution, e) => execution.nodes.filter(n => n.defect > 0).map((node, n) => ({
  id: 'QD-' + (5000 + e * 4 + n), execution, day: execution.created, op: node.name,
  kind: ['尺寸偏差', '表面划伤', '孔位偏移'][(e + n) % 3], waste: e % 3 ? '工废' : '料废', net: node.defect,
})))
export const movements = orders.filter(o => o.done || o.status === '已下达').flatMap((order, i) => {
  const material = materials[i % 2], store = stores[(i + Math.floor(i / 3)) % 3]
  return ['采购入库', '生产领料', ...(i % 4 === 0 ? ['生产退料'] : [])].map((kind, j) => ({
    id: 'SD-' + (8000 + i * 3 + j), day: order.day, order, material, store, kind,
    qty: [240 + i % 8 * 24, 110 + i % 9 * 12, 12][j],
  }))
})
export const balances = materials.flatMap((material, m) => stores.map((store, i) => ({
  store, material, lot: 'MAT-2610-' + (m * 3 + i + 1), bin: 'A-0' + (i + 1),
  qty: (i ? 36500 : 1234567.25) + movements.filter(x => x.store === store && x.material === material)
    .reduce((total, x) => total + (x.kind === '生产领料' ? -x.qty : x.qty), 0),
}))).map(b => ({ ...b, qty: b.material.unit === '个' ? Math.round(b.qty) : b.qty }))
export const format = (n: number) => n.toLocaleString('zh-CN', { maximumFractionDigits: 6 })
export const inside = (day: string, start: string, end: string) => day >= start && day <= end
export function sum<T>(rows: T[], value: (row: T) => number) {
  return rows.reduce((total, row) => total + value(row), 0)
}
