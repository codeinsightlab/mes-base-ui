import { request } from '@/lib/request'
export interface UserOption { id: string; name: string }
export interface AssignmentNode { id: string; operationId: string; code: string; name: string | null }
export const operatorConfiguration = {
  users: (keyword: string, offset: number) => request<{ items: UserOption[]; total: number }>('/api/production/operator-users', { query: { keyword, offset, limit: 20 }, scope: 'factory' }),
  candidates: (operationId: string, offset: number) => request<{ items: UserOption[]; nextOffset: number; hasMore: boolean }>('/api/production/operator-candidates', { query: { operationId, offset }, scope: 'factory' }),
  nodes: (id: string) => request<{ status: string; nodes: AssignmentNode[] }>(`/api/production/executions/${encodeURIComponent(id)}/assignment-nodes`, { scope: 'factory' }),
  bind: (operationId: string, userIds: string[]) => request<void>('/api/production/mes-operation-user/bind-users', { method: 'POST', body: { operationId, userIds }, scope: 'factory' })
}
