import { request } from '@/lib/request'
export interface WorkorderMaterial { id: string; bomId: string | null; bomBaseQty: string | null; bomComponentQty: string | null; outputUnitId: string | null; frozenAt: string | null; materialId: string; unitId: string; totalRequiredQty: string; plannedQty: string; warehouseIds: string; workCenter: string; revision: string; status: string; updatedAt: string }
export interface MaterialDemandSave { expectedRevision: string; expectedBomRevision: string; bomId: string; warehouseIds: string[]; workCenter: string; enabled: boolean }
const url = (id: string) => '/api/production/workorder/' + encodeURIComponent(id) + '/material'
export const workorderMaterial = {
  get: (id: string) => request<WorkorderMaterial | null>(url(id), { scope: 'factory' }).then(v => v ?? null),
  save: (id: string, body: MaterialDemandSave) => request<WorkorderMaterial>(url(id), { method: 'PUT', body, scope: 'factory' })
}
