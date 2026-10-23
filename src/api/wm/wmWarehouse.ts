import { request } from '@/lib/request'

export const warehouseTypeOptions = [
  { value: 'RAW_MATERIAL', label: '原材料仓' },
  { value: 'WIP', label: '在制品仓 / 半成品仓' },
  { value: 'FINISHED_GOODS', label: '成品仓' },
  { value: 'INSPECTION', label: '待检仓' },
  { value: 'DEFECTIVE', label: '不良品仓' },
  { value: 'SCRAP', label: '报废品仓' },
  { value: 'OUTSOURCING', label: '委外仓' }
] as const
export type WarehouseType = typeof warehouseTypeOptions[number]['value']

export function warehouseTypeText(value: unknown): string {
  if (value === null) return '待补录'
  if (value === undefined) return '类型信息未返回'
  return warehouseTypeOptions.find(option => option.value === value)?.label ?? '未知类型'
}

export interface WmWarehouseVo {
  [key: string]: unknown;
  id: string;
  source?: 'LOCAL' | 'EXTERNAL' | null;

  code: string;
  name: string;
  warehouseType: WarehouseType | null;
  warehouseTypeLabel: string;
  status: string;
  remark: string | null;
  createBy: string | null;
  createByName: string | null;
  createTime: string | null;
  updateBy: string | null;
  updateByName: string | null;
  updateTime: string | null;
}

export interface Page {
  items: WmWarehouseVo[];
  total: number;
  offset: number;
  limit: number;
}

export type CreateCommand = Pick<WmWarehouseVo, 'code' | 'name' | 'status' | 'remark'> & { warehouseType: WarehouseType }
export type UpdateCommand = Pick<WmWarehouseVo, 'code' | 'name' | 'status' | 'remark'> & { warehouseType: WarehouseType }

const removeIds = (ids: string[]) =>
  request<void>('/api/wm/wm-warehouse', { method: 'DELETE', body: ids, scope: 'factory' })

export const api = {
  list: (query: Record<string, string | number>) =>
    request<Page>('/api/wm/wm-warehouse', { query, scope: 'factory' }),

  detail: (id: string) =>
    request<WmWarehouseVo>('/api/wm/wm-warehouse/' + encodeURIComponent(id), { scope: 'factory' }),

  create: (body: unknown) =>
    request<WmWarehouseVo>('/api/wm/wm-warehouse', { method: 'POST', body, scope: 'factory' }),

  update: (id: string, body: unknown) =>
    request<WmWarehouseVo>('/api/wm/wm-warehouse/' + encodeURIComponent(id), {
      method: 'PUT', body, scope: 'factory'
    }),

  remove: (id: string) => removeIds([id]),

  delids: removeIds
}

export interface SyncResult { fetched: number; created: number; updated: number; skipped: number }
export const sync = () => request<SyncResult>('/api/wm/wm-warehouse/actions/sync', { method: 'POST', scope: 'factory' })
