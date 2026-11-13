import { request } from '@/lib/request'
export interface OperatorQualification {
  userId: string
  allOperations: boolean
  revision: number
  validUser: boolean
  explicitTotal: number
  enabledExplicitTotal: number
  operations: { operationId: string; code: string | null; name: string | null; status: string | null }[]
  offset: number
  limit: number
}
const path = (userId: string) => '/api/production/operator-qualifications/' + encodeURIComponent(userId)
export const operatorQualification = {
  summary: (userId: string, offset = 0) => request<OperatorQualification>(path(userId), { query: { offset, limit: 20 }, scope: 'factory' }),
  grant: (userId: string, revision: number) => request<void>(path(userId) + '/all', { method: 'POST', body: { revision }, scope: 'factory' }),
  revoke: (userId: string, revision: number) => request<void>(path(userId) + '/all', { method: 'DELETE', body: { revision }, scope: 'factory' })
}
