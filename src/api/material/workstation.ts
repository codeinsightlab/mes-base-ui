// MES-CODEGEN: RuoYi API module pattern adapted to typed Base contracts.
import { request } from '@/lib/request'

export interface WorkstationVo {
  [key: string]: unknown;
  id: string;
  factoryId: string;
  code: string;
  name: string;
  workshopId: string | null;
  status: string;
  remark: string | null;
}

export interface Page {
  items: WorkstationVo[];
  total: number;
  offset: number;
  limit: number;
}

export type CreateCommand = Pick<WorkstationVo, 'code' | 'name' | 'workshopId' | 'status' | 'remark'>
export type UpdateCommand = Pick<WorkstationVo, 'code' | 'name' | 'workshopId' | 'status' | 'remark'>

const removeIds = (ids: string[]) =>
  request<void>('/api/material/workstation', { method: 'DELETE', body: ids, scope: 'factory' })

export const api = {
  list: (query: Record<string, string | number>) =>
    request<Page>('/api/material/workstation', { query, scope: 'factory' }),

  detail: (id: string) =>
    request<WorkstationVo>('/api/material/workstation/' + encodeURIComponent(id), { scope: 'factory' }),

  create: (body: unknown) =>
    request<WorkstationVo>('/api/material/workstation', { method: 'POST', body, scope: 'factory' }),

  update: (id: string, body: unknown) =>
    request<WorkstationVo>('/api/material/workstation/' + encodeURIComponent(id), {
      method: 'PUT', body, scope: 'factory'
    }),

  remove: (id: string) => removeIds([id]),

  delids: removeIds
}

export interface SyncResult { fetched: number; created: number; updated: number; skipped: number }
export const sync = () => request<SyncResult>('/api/material/workstation/actions/sync', { method: 'POST', scope: 'factory' })
