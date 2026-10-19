import { request } from '@/lib/request'

export interface WmInventoryVo {
  [key: string]: unknown;
  id: string;

  batchNo: string | null;
  binCode: string | null;
  materialId: string;
  warehouseId: string;
  materialName: string | null;
  warehouseSource?: 'LOCAL' | 'EXTERNAL' | null;
  warehouseName: string | null;
  quantity: string;
  availableQuantity: string | null;
  status: string;
  remark: string | null;
  createBy: string | null;
  createTime: string | null;
  updateBy: string | null;
  updateTime: string | null;
}

export interface Page {
  items: WmInventoryVo[];
  total: number;
  offset: number;
  limit: number;
}

export type CreateCommand = Pick<WmInventoryVo, 'materialId' | 'warehouseId' | 'quantity' | 'availableQuantity' | 'status' | 'remark' | 'batchNo' | 'binCode'>
export type UpdateCommand = Pick<WmInventoryVo, 'materialId' | 'warehouseId' | 'quantity' | 'availableQuantity' | 'status' | 'remark' | 'batchNo' | 'binCode'>

const removeIds = (ids: string[]) =>
  request<void>('/api/wm/wm-inventory', { method: 'DELETE', body: ids, scope: 'factory' })

export const api = {
  list: (query: Record<string, string | number>) =>
    request<Page>('/api/wm/wm-inventory', { query, scope: 'factory' }),

  detail: (id: string) =>
    request<WmInventoryVo>('/api/wm/wm-inventory/' + encodeURIComponent(id), { scope: 'factory' }),

  create: (body: unknown) =>
    request<WmInventoryVo>('/api/wm/wm-inventory', { method: 'POST', body: { ...(body as Record<string, unknown>), quantity: '0', availableQuantity: '0' }, scope: 'factory' }),

  update: async (id: string, body: unknown) => {
    const stock = await api.detail(id)
    return request<WmInventoryVo>('/api/wm/wm-inventory/' + encodeURIComponent(id), {
      method: 'PUT', body: { ...(body as Record<string, unknown>), quantity: stock.quantity, availableQuantity: stock.availableQuantity }, scope: 'factory'
    })
  },

  remove: (id: string) => removeIds([id]),

  delids: removeIds
}

export interface SyncResult { fetched: number; created: number; updated: number; skipped: number }
export const sync = () => request<SyncResult>('/api/wm/wm-inventory/actions/sync', { method: 'POST', scope: 'factory' })
