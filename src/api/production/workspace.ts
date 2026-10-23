import { request } from '@/lib/request'

export interface RecentReport {
  id: string; executionId: string | null; workorderId: string | null
  workorderCode: string | null; source: string | null; productCode: string | null; productName: string | null
  unitName: string | null; routingNodeId: string; operationName: string | null; recordType: string
  quantityDelta: string; operatorUserId: string; operatorName: string | null; reportTime: string; createTime: string
}
export async function recentReports(): Promise<RecentReport[]> {
  const rows = await request<RecentReport[]>('/api/production/reports/recent', { scope: 'factory' })
  if (!Array.isArray(rows)) throw new Error('近期报工响应格式不匹配，请确认后端已加载最新接口')
  return rows
}
