import { request } from '@/lib/request'
import type { RoutingDetail } from './routing'
export interface Order {
  id: string; code: string; productId: string; routingId: string; plannedQty: string | number
  status: 'DRAFT' | 'RELEASED'; plannedStartAt: string | null; plannedEndAt: string | null
  externalId: string | null; externalCode: string | null; remark: string | null; revision: number
}
export interface Batch {
  id: string; workorderId: string; batchNo: string; plannedQty: string | number; status: 'PLANNED' | 'ISSUED'
  routeStatus: 'UNSELECTED' | 'SELECTED' | 'PENDING' | 'UNKNOWN' | 'LOCKED'; lockedAt: string | null
  revision: number; remark: string | null; path: { routingNodeId: string; executionOrder: number }[]
}
export interface RoutingOption { id: string; code: string; name: string; version: number; status: string }
export interface Allocation { workorderId: string; plannedQty: string; allocatedTargetQty: string; remainingTargetQty: string; excessTargetQty: string; executionCount: number }
export interface Detail { workorder: Order; productCode: string; productName: string; routing: RoutingOption; batches: Batch[]; allocation: Allocation }
export interface Save {
  code: string; productId: string; routingId: string; plannedQty: string; revision?: number
  plannedStartAt: string | null; plannedEndAt: string | null; externalId: string | null
  externalCode: string | null; remark: string | null
}
export function saveBody(input: Save): Save {
  if ('batches' in input) throw new Error('旧分批写入已停用，请创建生产执行单元')
  return {
    code: input.code, productId: input.productId, routingId: input.routingId, plannedQty: input.plannedQty,
    plannedStartAt: input.plannedStartAt, plannedEndAt: input.plannedEndAt, externalId: input.externalId,
    externalCode: input.externalCode, remark: input.remark, revision: input.revision
  }
}
// Preserve this contract's DECIMAL quantity lexemes before JavaScript can round them.
// Quoted JSON tokens are consumed whole, so text embedded in remarks is never rewritten.
export function parseWorkOrderResponse(text: string): unknown {
  let key: string | null = null
  const decoded = text.replace(/"(?:\\[\s\S]|[^"\\])*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/g, (token, offset: number) => {
    if (token.startsWith('"')) {
      key = /^\s*:/.test(text.slice(offset + token.length)) ? JSON.parse(token) as string : null
      return token
    }
    const value = key === 'plannedQty' ? JSON.stringify(token) : token
    key = null
    return value
  })
  return JSON.parse(decoded)
}
const base = '/api/production/workorder'
const path = (id: string) => base + '/' + encodeURIComponent(id)
export const api = {
  list: (query: Record<string, string | number>) => request<{ items: { workorder: Order; batchCount: number; productCode: string; productName: string; routingCode: string; routingVersion: number; allocation: Allocation }[]; total: number }>(base, { query, scope: 'factory', parseResponse: parseWorkOrderResponse }),
  detail: (id: string) => request<Detail>(path(id), { scope: 'factory', parseResponse: parseWorkOrderResponse }),
  create: (body: Save) => request<Detail>(base, { method: 'POST', body: saveBody(body), scope: 'factory', parseResponse: parseWorkOrderResponse }),
  update: (id: string, body: Save) => request<Detail>(path(id), { method: 'PUT', body: saveBody(body), scope: 'factory', parseResponse: parseWorkOrderResponse }),
  release: (id: string, revision: number) => request<Detail>(path(id) + '/actions/release', { method: 'POST', body: { revision }, scope: 'factory', parseResponse: parseWorkOrderResponse }),
  remove: (id: string, revision: number) => request<void>(path(id), { method: 'DELETE', body: { revision }, scope: 'factory', parseResponse: parseWorkOrderResponse }),
  routings: (productId: string, search = '') => request<RoutingOption[]>(base + '/references/routings', { query: { productId, search }, scope: 'factory', parseResponse: parseWorkOrderResponse }),
  graph: (id: string) => request<RoutingDetail>(path(id) + '/graph', { scope: 'factory', parseResponse: parseWorkOrderResponse }),
  allocation: (id: string) => request<Allocation>(path(id) + '/allocation', { scope: 'factory' })
}
