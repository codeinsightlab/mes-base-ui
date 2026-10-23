import { request } from '@/lib/request'

export interface WorkOrderProgressRow {
  id: string; code: string; source: string | null; status: string; productCode: string | null
  productName: string | null; unitName: string | null; plannedQty: string | null; completedQty: string | null
  qualityTransferredQty?: string | null; goodOutputGapQty: string | null; pendingCompletionQty: string | null
  qualityUntreatedQty: string | null; qualityReturnedQty: string | null; qualityUnverifiedQty: string | null; completionPercent: string | null; completedExecutions: number
  lastCompletedAt: string | null; issue: string | null; createTime: string | null
}
export interface WorkOrderProgressPage { items: WorkOrderProgressRow[]; total: number; offset: number; limit: number }
export interface WorkOrderProgressQuery { workorderCode: string; productCode: string; status: string; offset: number; limit: number }
export const loadWorkOrderProgress = (query: WorkOrderProgressQuery) => request<WorkOrderProgressPage>(
  '/api/production/workorder-progress', { query: { ...query }, scope: 'factory' }
)
