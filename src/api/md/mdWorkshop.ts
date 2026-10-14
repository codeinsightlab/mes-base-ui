import { request } from '@/lib/request'

export interface MdWorkshopVo {
  [key: string]: unknown;
  workshopId: string;

  workshopCode: string;
  workshopName: string;
  area: string | null;
  charge: string | null;
  deptId: string | null;
  enableFlag: string;
  remark: string | null;
  createBy: string | null;
  createTime: string | null;
  updateBy: string | null;
  updateTime: string | null;
}

export interface Page {
  items: MdWorkshopVo[];
  total: number;
  offset: number;
  limit: number;
}

export type CreateCommand = Pick<MdWorkshopVo, 'workshopCode' | 'workshopName' | 'area' | 'charge' | 'deptId' | 'enableFlag' | 'remark'>
export type UpdateCommand = Pick<MdWorkshopVo, 'workshopCode' | 'workshopName' | 'area' | 'charge' | 'deptId' | 'enableFlag' | 'remark'>

const removeIds = (ids: string[]) =>
  request<void>('/api/md/md-workshop', { method: 'DELETE', body: ids, scope: 'factory' })

export const api = {
  list: (query: Record<string, string | number>) =>
    request<Page>('/api/md/md-workshop', { query, scope: 'factory' }),

  detail: (id: string) =>
    request<MdWorkshopVo>('/api/md/md-workshop/' + encodeURIComponent(id), { scope: 'factory' }),

  create: (body: unknown) =>
    request<MdWorkshopVo>('/api/md/md-workshop', { method: 'POST', body, scope: 'factory' }),

  update: (id: string, body: unknown) =>
    request<MdWorkshopVo>('/api/md/md-workshop/' + encodeURIComponent(id), {
      method: 'PUT', body, scope: 'factory'
    }),

  remove: (id: string) => removeIds([id]),

  delids: removeIds
}

export interface SyncResult { fetched: number; created: number; updated: number; skipped: number }
export const sync = () => request<SyncResult>('/api/md/md-workshop/actions/sync', { method: 'POST', scope: 'factory' })
