// MES-CODEGEN: RuoYi API module pattern adapted to typed Base contracts.
import { request } from '@/lib/request'

export interface MdUnitMeasureVo {
  [key: string]: unknown;
  measureId: string;
  factoryId: string;
  measureCode: string;
  measureName: string;
  primaryFlag: string;
  primaryId: string | null;
  changeRate: string | null;
  enableFlag: string;
  remark: string | null;
  createBy: string | null;
  createTime: string | null;
  updateBy: string | null;
  updateTime: string | null;
}

export interface Page {
  items: MdUnitMeasureVo[];
  total: number;
  offset: number;
  limit: number;
}

export type CreateCommand = Pick<MdUnitMeasureVo, 'factoryId' | 'measureCode' | 'measureName' | 'primaryFlag' | 'primaryId' | 'changeRate' | 'enableFlag' | 'remark'>
export type UpdateCommand = Pick<MdUnitMeasureVo, 'factoryId' | 'measureCode' | 'measureName' | 'primaryFlag' | 'primaryId' | 'changeRate' | 'enableFlag' | 'remark'>

const removeIds = (ids: string[]) =>
  request<void>('/api/md/md-unit-measure', { method: 'DELETE', body: ids, scope: 'factory' })

export const api = {
  list: (query: Record<string, string | number>) =>
    request<Page>('/api/md/md-unit-measure', { query, scope: 'factory' }),

  detail: (id: string) =>
    request<MdUnitMeasureVo>('/api/md/md-unit-measure/' + encodeURIComponent(id), { scope: 'factory' }),

  create: (body: unknown) =>
    request<MdUnitMeasureVo>('/api/md/md-unit-measure', { method: 'POST', body, scope: 'factory' }),

  update: (id: string, body: unknown) =>
    request<MdUnitMeasureVo>('/api/md/md-unit-measure/' + encodeURIComponent(id), {
      method: 'PUT', body, scope: 'factory'
    }),

  remove: (id: string) => removeIds([id]),

  delids: removeIds
}

export interface SyncResult { fetched: number; created: number; updated: number; skipped: number }
export const sync = () => request<SyncResult>('/api/md/md-unit-measure/actions/sync', { method: 'POST', scope: 'factory' })
