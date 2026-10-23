import { request } from '@/lib/request'

export interface MesProductionExecutionVo {
  [key: string]: unknown;
  id: string;
  routingCode?: string | null; routingName?: string | null; routingVersion?: number | null; createByName?: string | null; updateByName?: string | null;
  workorderId: string;
  productId: string;
  productCode?: string | null;
  productName?: string | null;
  routingId: string;
  targetQty: string;
  status: string;
  startTime: string | null;
  endTime: string | null;
  remark: string | null;
  createBy: string | null;
  createTime: string | null;
  updateBy: string | null;
  updateTime: string | null;
}

export interface Page {
  items: MesProductionExecutionVo[];
  total: number;
  offset: number;
  limit: number;
}

export type CreateCommand = Pick<MesProductionExecutionVo, 'workorderId' | 'routingId' | 'targetQty' | 'status' | 'startTime' | 'endTime' | 'remark'>
export type UpdateCommand = Pick<MesProductionExecutionVo, 'workorderId' | 'routingId' | 'targetQty' | 'status' | 'startTime' | 'endTime' | 'remark'>

const removeIds = (ids: string[]) =>
  request<void>('/api/production/mes-production-execution', { method: 'DELETE', body: ids, scope: 'factory' })

export const api = {
  list: (query: Record<string, string | number>) =>
    request<Page>('/api/production/mes-production-execution', { query, scope: 'factory' }),

  detail: (id: string) =>
    request<MesProductionExecutionVo>('/api/production/mes-production-execution/' + encodeURIComponent(id), { scope: 'factory' }),

  create: (body: unknown) =>
    request<MesProductionExecutionVo>('/api/production/mes-production-execution', { method: 'POST', body: { ...(body as object), status: 'READY', startTime: null, endTime: null }, scope: 'factory' }),

  update: async (id: string, body: unknown) => {
    const previous = await api.detail(id)
    return request<MesProductionExecutionVo>('/api/production/mes-production-execution/' + encodeURIComponent(id), {
      method: 'PUT', body: { ...(body as object), status: previous.status, startTime: previous.startTime, endTime: previous.endTime }, scope: 'factory'
    })
  },

  remove: (id: string) => removeIds([id]),

  delids: removeIds
}

