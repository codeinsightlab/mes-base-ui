import { request } from '@/lib/request'

export interface MesMaterialIssueItemVo {
  [key: string]: unknown;
  id: string;

  issueId: string;
  materialId: string;
  materialCode: string | null;
  batchNo: string | null;
  quantity: string;
  unitId: string | null;
  unitCode: string | null;
  warehouseId: string | null;
  warehouseCode: string | null;
  remark: string | null;
  createBy: string | null;
  createTime: string | null;
  updateBy: string | null;
  updateTime: string | null;
}

export interface Page {
  items: MesMaterialIssueItemVo[];
  total: number;
  offset: number;
  limit: number;
}

export type CreateCommand = Pick<MesMaterialIssueItemVo, 'issueId' | 'materialId' | 'batchNo' | 'quantity' | 'unitId' | 'warehouseId' | 'remark'>
export type UpdateCommand = Pick<MesMaterialIssueItemVo, 'issueId' | 'materialId' | 'batchNo' | 'quantity' | 'unitId' | 'warehouseId' | 'remark'>

const removeIds = (ids: string[]) =>
  request<void>('/api/issue/mes-material-issue-item', { method: 'DELETE', body: ids, scope: 'factory' })

export const api = {
  list: (query: Record<string, string | number>) =>
    request<Page>('/api/issue/mes-material-issue-item', { query, scope: 'factory' }),

  detail: (id: string) =>
    request<MesMaterialIssueItemVo>('/api/issue/mes-material-issue-item/' + encodeURIComponent(id), { scope: 'factory' }),

  create: (body: unknown) =>
    request<MesMaterialIssueItemVo>('/api/issue/mes-material-issue-item', { method: 'POST', body, scope: 'factory' }),

  update: (id: string, body: unknown) =>
    request<MesMaterialIssueItemVo>('/api/issue/mes-material-issue-item/' + encodeURIComponent(id), {
      method: 'PUT', body, scope: 'factory'
    }),

  remove: (id: string) => removeIds([id]),

  delids: removeIds
}

