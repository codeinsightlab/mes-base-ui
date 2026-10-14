import { request } from '@/lib/request'

export interface OperationVo {
  [key: string]: unknown;
  id: string;

  code: string;
  name: string;
  description: string | null;
  status: string;
  sort: number;
  externalId: string | null;
  revision: number;
}

export interface Page {
  items: OperationVo[];
  total: number;
  offset: number;
  limit: number;
}

export type CreateCommand = Pick<OperationVo, 'code' | 'name' | 'description' | 'status' | 'sort' | 'externalId'>
export type UpdateCommand = Pick<OperationVo, 'code' | 'name' | 'description' | 'status' | 'sort' | 'externalId' | 'revision'>

const removeIds = (ids: string[]) =>
  request<void>('/api/production/operation', { method: 'DELETE', body: ids, scope: 'factory' })

export const api = {
  list: (query: Record<string, string | number>) =>
    request<Page>('/api/production/operation', { query, scope: 'factory' }),

  detail: (id: string) =>
    request<OperationVo>('/api/production/operation/' + encodeURIComponent(id), { scope: 'factory' }),

  create: (body: unknown) =>
    request<OperationVo>('/api/production/operation', { method: 'POST', body, scope: 'factory' }),

  update: (id: string, body: unknown) =>
    request<OperationVo>('/api/production/operation/' + encodeURIComponent(id), {
      method: 'PUT', body, scope: 'factory'
    }),

  remove: (id: string) => removeIds([id]),

  delids: removeIds
}

