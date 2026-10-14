import { request } from '@/lib/request'

export interface EquipmentVo {
  [key: string]: unknown;
  id: string;

  code: string;
  name: string;
  model: string | null;
  workstationId: string | null;
  status: string;
  remark: string | null;
}

export interface Page {
  items: EquipmentVo[];
  total: number;
  offset: number;
  limit: number;
}

export type CreateCommand = Pick<EquipmentVo, 'code' | 'name' | 'model' | 'workstationId' | 'status' | 'remark'>
export type UpdateCommand = Pick<EquipmentVo, 'code' | 'name' | 'model' | 'workstationId' | 'status' | 'remark'>

const removeIds = (ids: string[]) =>
  request<void>('/api/basic/equipment', { method: 'DELETE', body: ids, scope: 'factory' })

export const api = {
  list: (query: Record<string, string | number>) =>
    request<Page>('/api/basic/equipment', { query, scope: 'factory' }),

  detail: (id: string) =>
    request<EquipmentVo>('/api/basic/equipment/' + encodeURIComponent(id), { scope: 'factory' }),

  create: (body: unknown) =>
    request<EquipmentVo>('/api/basic/equipment', { method: 'POST', body, scope: 'factory' }),

  update: (id: string, body: unknown) =>
    request<EquipmentVo>('/api/basic/equipment/' + encodeURIComponent(id), {
      method: 'PUT', body, scope: 'factory'
    }),

  remove: (id: string) => removeIds([id]),

  delids: removeIds
}

