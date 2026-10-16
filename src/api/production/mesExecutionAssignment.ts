import { request } from '@/lib/request'

export interface MesExecutionAssignmentVo {
  [key: string]: unknown;
  id: string;
  executionId: string;
  routingNodeId: string;
  userId: string;
  assignedBy: string;
  assignedAt: string;
  remark: string | null;
}

export interface Page {
  items: MesExecutionAssignmentVo[];
  total: number;
  offset: number;
  limit: number;
}

export type CreateCommand = Pick<MesExecutionAssignmentVo, 'executionId' | 'routingNodeId' | 'userId' | 'remark'>
export type UpdateCommand = Pick<MesExecutionAssignmentVo, 'executionId' | 'routingNodeId' | 'userId' | 'remark'>

const removeIds = (ids: string[]) =>
  request<void>('/api/production/mes-execution-assignment', { method: 'DELETE', body: ids, scope: 'factory' })

export const api = {
  list: (query: Record<string, string | number>) =>
    request<Page>('/api/production/mes-execution-assignment', { query, scope: 'factory' }),

  detail: (id: string) =>
    request<MesExecutionAssignmentVo>('/api/production/mes-execution-assignment/' + encodeURIComponent(id), { scope: 'factory' }),

  create: (body: unknown) =>
    request<MesExecutionAssignmentVo>('/api/production/mes-execution-assignment', { method: 'POST', body, scope: 'factory' }),

  update: (id: string, body: unknown) =>
    request<MesExecutionAssignmentVo>('/api/production/mes-execution-assignment/' + encodeURIComponent(id), {
      method: 'PUT', body, scope: 'factory'
    }),

  remove: (id: string) => removeIds([id]),

  delids: removeIds
}

