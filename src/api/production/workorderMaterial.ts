import { request } from '@/lib/request'
export interface WorkorderMaterialItem {
  id: string | null; bomItemId: string | null; materialId: string; unitId: string; totalRequiredQty: string
  standardRequiredQty?: string | null; bomBaseQty?: string | null; bomComponentQty?: string | null
  outputUnitId?: string | null; plannedQty?: string; manuallyAdjusted: boolean; clientKey?: string
}
export interface WorkorderMaterial {
  workorderId: string; bomId: string | null; bomRevision: string | null; frozenAt: string | null
  warehouseIds: string | null; workCenter: string | null; revision: string; status: string | null
  updatedAt: string | null; items: WorkorderMaterialItem[]
}
export interface MaterialDemandSave {
  expectedRevision: string; expectedBomRevision: string | null; bomId: string | null
  warehouseIds: string[]; workCenter: string; enabled: boolean; items: WorkorderMaterialItem[]; adjustmentsConfirmed: boolean
}
export function emptyMaterialDemand(): MaterialDemandSave {
  return { expectedRevision: '0', expectedBomRevision: null, bomId: null, warehouseIds: [], workCenter: '', enabled: true, items: [], adjustmentsConfirmed: false }
}
function warehouseIds(value: string | null): string[] {
  if (!value) return []
  // Preserve BIGINT identity in the existing persisted JSON array before JavaScript can round it.
  const decoded: unknown = JSON.parse(value.replace(/"(?:\\.|[^"\\])*"|\d+/g, token => token.startsWith('"') ? token : JSON.stringify(token)))
  if (!Array.isArray(decoded) || decoded.some(id => typeof id !== 'string' || !/^[1-9]\d{0,18}$/.test(id))) throw new Error('允许领料仓库配置无效，请核对原记录')
  return decoded
}
export function materialDemandDraft(value: WorkorderMaterial): MaterialDemandSave {
  return { expectedRevision: value.revision, expectedBomRevision: value.bomRevision, bomId: value.bomId,
    warehouseIds: warehouseIds(value.warehouseIds), workCenter: value.workCenter ?? '',
    enabled: value.status !== 'DISABLED', adjustmentsConfirmed: false,
    items: value.items.map(row => ({ ...row, manuallyAdjusted: row.manuallyAdjusted || !row.bomItemId })) }
}
export function materialDemandBody(value: MaterialDemandSave) {
  return { expectedRevision: value.expectedRevision, expectedBomRevision: value.expectedBomRevision, bomId: value.bomId,
    warehouseIds: [...value.warehouseIds], workCenter: value.workCenter, enabled: value.enabled, adjustmentsConfirmed: value.adjustmentsConfirmed,
    items: value.items.map(row => ({ id: row.id ?? null, bomItemId: row.bomItemId, materialId: row.materialId,
      unitId: row.unitId, totalRequiredQty: row.totalRequiredQty, manuallyAdjusted: row.manuallyAdjusted })) }
}
const url = (id: string) => '/api/production/workorder/' + encodeURIComponent(id) + '/material'
export const workorderMaterial = {
  get: async(id: string) => {
    const value = await request<WorkorderMaterial>(url(id), { scope: 'factory' })
    if (!value || !Array.isArray(value.items)) throw new Error('工单用料接口版本尚未更新，请先加载新后端')
    return value
  },
  save: (id: string, body: MaterialDemandSave) => request<WorkorderMaterial>(url(id), { method: 'PUT', body: materialDemandBody(body), scope: 'factory' })
}
