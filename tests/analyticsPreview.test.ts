import { describe, expect, it } from 'vitest'
import { buildBoard, type Filters } from '../src/preview/analytics/boards'
import { days, executions, materials, products, referenceDay, shiftDay } from '../src/preview/analytics/sample'
const filters: Filters = { start: shiftDay(referenceDay, -6), end: referenceDay, product: '', order: '', status: '', batch: '', op: '', person: '', material: materials[0].name, store: '', erp: false }
describe('六专题设计样例', () => {
  it('含首尾日期，跨月按自然日，限制 92 个数据点', () => {
    expect(days('2026-10-31', '2026-11-01')).toEqual(['2026-10-31', '2026-11-01'])
    expect(days(referenceDay, referenceDay)).toEqual([referenceDay])
    expect(days('2026-01-01', referenceDay)).toHaveLength(92)
  })
  it('收窄创建期间不改变当前运行批次数', () => {
    const week = buildBoard('overview', filters)
    const today = buildBoard('overview', { ...filters, start: referenceDay })
    expect(week.metrics[0][1]).toBeGreaterThan(Number(today.metrics[0][1]))
    expect(week.metrics[2]).toEqual(today.metrics[2])
    expect(week.side.bars.reduce((n, b) => n + b.value, 0)).toBe(week.metrics[0][1])
  })
  it('跨产品计划量留空，取消工单不贡献完成排名和数量', () => {
    expect(buildBoard('orders', filters).metrics[2][1]).toBe('—')
    const board = buildBoard('orders', { ...filters, product: products[0], status: '已取消' })
    expect(board.chart.keys).toEqual([])
    expect(board.metrics[2][1]).toBe(0)
  })
  it('无工艺执行保留正式投入、节点为空', () => {
    const execution = executions.find(e => !e.nodes.length && e.state === '已全部入库')!
    const b = buildBoard('process', { ...filters, order: execution.order.id, batch: execution.batch })
    expect(b.table.rows).toEqual([])
    expect(b.metrics[2][1]).toBe(execution.qty)
  })
  it('ERP 无权威来源时不返回示例本地库存', () => {
    const local = buildBoard('inventory', filters), erp = buildBoard('inventory', { ...filters, erp: true })
    expect(local.side.bars.length).toBeGreaterThan(0)
    expect(erp.side.bars).toEqual([])
    expect(erp.table.rows).toEqual([])
    expect(erp.metrics.every(m => m[1] === '—')).toBe(true)
    expect(local.metrics[3][1]).toBe(Number(local.metrics[1][1]) - Number(local.metrics[2][1]))
  })
  it('人员交叉表笔数与趋势合计可核对，缺少分母时质量率为空', () => {
    const b = buildBoard('people', { ...filters, person: '陈宁' })
    expect(Number(b.table.rows[0].values.at(-1))).toBe(b.chart.series[0].values.reduce<number>((a, n) => a + Number(n), 0))
    expect(buildBoard('quality', { ...filters, product: products[0] }).metrics[3][1]).toBe('—')
  })
})
