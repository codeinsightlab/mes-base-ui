// MES-CODEGEN: RuoYi API module pattern adapted to typed Base contracts.
import { request } from '@/lib/request'

export interface PersonVo {
  [key: string]: unknown;
  id: string;
  name: string;
}

export interface Page {
  items: PersonVo[];
  total: number;
  offset: number;
  limit: number;
}

export type CreateCommand = Pick<PersonVo, 'name'>
export type UpdateCommand = Pick<PersonVo, 'name'>

const removeIds = (ids: string[]) =>
  request<void>('/api/acceptance/person', { method: 'DELETE', body: ids, scope: 'factory' })

export const api = {
  list: (query: Record<string, string | number>) =>
    request<Page>('/api/acceptance/person', { query, scope: 'factory' }),

  detail: (id: string) =>
    request<PersonVo>('/api/acceptance/person/' + encodeURIComponent(id), { scope: 'factory' }),

  create: (body: unknown) =>
    request<PersonVo>('/api/acceptance/person', { method: 'POST', body, scope: 'factory' }),

  update: (id: string, body: unknown) =>
    request<PersonVo>('/api/acceptance/person/' + encodeURIComponent(id), {
      method: 'PUT', body, scope: 'factory'
    }),

  remove: (id: string) => removeIds([id]),

  delids: removeIds
}
