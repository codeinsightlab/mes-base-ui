// MES-CODEGEN: API 与生成的 Controller 使用同一请求契约。
import { request } from '@/lib/request'

export interface MesOperationUserVo {
  [key: string]: unknown;
  id: string;
  operationId: string;
  userId: string;
  remark: string | null;
  createBy: string | null;
  createTime: string | null;
}

export interface Page {
  items: MesOperationUserVo[];
  total: number;
  offset: number;
  limit: number;
}

export type CreateCommand = Pick<MesOperationUserVo, 'operationId' | 'userId' | 'remark'>
export type UpdateCommand = Pick<MesOperationUserVo, 'operationId' | 'userId' | 'remark'>

const removeIds = (ids: string[]) =>
  request<void>('/api/production/mes-operation-user', { method: 'DELETE', body: ids, scope: 'factory' })

export const api = {
  list: (query: Record<string, string | number>) =>
    request<Page>('/api/production/mes-operation-user', { query, scope: 'factory' }),

  detail: (id: string) =>
    request<MesOperationUserVo>('/api/production/mes-operation-user/' + encodeURIComponent(id), { scope: 'factory' }),

  create: (body: unknown) =>
    request<MesOperationUserVo>('/api/production/mes-operation-user', { method: 'POST', body, scope: 'factory' }),

  update: (id: string, body: unknown) =>
    request<MesOperationUserVo>('/api/production/mes-operation-user/' + encodeURIComponent(id), {
      method: 'PUT', body, scope: 'factory'
    }),

  remove: (id: string) => removeIds([id]),

  delids: removeIds
}

