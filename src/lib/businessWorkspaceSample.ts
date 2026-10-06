/** Explicit visual fixture. Never used as an API error fallback or persisted business data. */
export const sampleOrders = [
  { code: 'DEMO-WO-001', product: '传动轴组件', line: '机加一线', planned: 800, completed: 640, accepted: 622, status: '进行中', delivery: '本班次', process: '精加工' },
  { code: 'DEMO-WO-002', product: '精密连接件', line: '装配二线', planned: 600, completed: 480, accepted: 468, status: '进行中', delivery: '下一班次', process: '装配' },
  { code: 'DEMO-WO-003', product: '支撑座', line: '机加二线', planned: 500, completed: 380, accepted: 371, status: '待检验', delivery: '本班次', process: '终检' },
  { code: 'DEMO-WO-004', product: '定位套', line: '机加一线', planned: 260, completed: 140, accepted: 135, status: '异常待处理', delivery: '本班次', process: '车削' }
] as const
export const sampleTasks = [
  { code: 'DEMO-RPT-001', kind: '报工', title: '精加工工序报工', order: 'DEMO-WO-001', detail: '待确认本班次产量与工时', priority: '待处理', tone: 'running' },
  { code: 'DEMO-QC-001', kind: '检验', title: '支撑座完工检验', order: 'DEMO-WO-003', detail: '抽样 20 件 · 外观与尺寸', priority: '待检验', tone: 'warning' },
  { code: 'DEMO-EX-001', kind: '异常', title: '定位套尺寸偏差', order: 'DEMO-WO-004', detail: '隔离 5 件 · 等待质量处置', priority: '需关注', tone: 'error' },
  { code: 'DEMO-RPT-002', kind: '报工', title: '装配工序报工', order: 'DEMO-WO-002', detail: '待确认已完成装配数量', priority: '待处理', tone: 'running' },
  { code: 'DEMO-QC-002', kind: '检验', title: '连接件首件检验', order: 'DEMO-WO-002', detail: '首件 1 件 · 复核装配精度', priority: '待检验', tone: 'warning' }
] as const
export const sampleReports = [
  { code: 'DEMO-RPT-003', order: 'DEMO-WO-001', process: '精加工', quantity: 160, qualified: 156, hours: '2.5', time: '10:30', status: '已确认' },
  { code: 'DEMO-RPT-004', order: 'DEMO-WO-002', process: '装配', quantity: 120, qualified: 117, hours: '2.0', time: '10:15', status: '已确认' },
  { code: 'DEMO-RPT-005', order: 'DEMO-WO-004', process: '车削', quantity: 70, qualified: 65, hours: '1.5', time: '09:50', status: '待确认' }
] as const
export const sampleInspections = [
  { code: 'DEMO-QC-001', order: 'DEMO-WO-003', type: '完工检验', samples: 20, status: '待检验', result: '尚未判定' },
  { code: 'DEMO-QC-002', order: 'DEMO-WO-002', type: '首件检验', samples: 1, status: '待检验', result: '尚未判定' },
  { code: 'DEMO-QC-003', order: 'DEMO-WO-001', type: '巡检', samples: 10, status: '已完成', result: '合格' }
] as const
export const sampleSummary = {
  planned: sampleOrders.reduce((sum, item) => sum + item.planned, 0),
  completed: sampleOrders.reduce((sum, item) => sum + item.completed, 0),
  accepted: sampleOrders.reduce((sum, item) => sum + item.accepted, 0)
}
