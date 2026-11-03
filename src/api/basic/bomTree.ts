import { request } from '@/lib/request'

export type Line = { material: string;quantity: string;sort: number;child: string | null }
export type Node = { key: string;source: string | null;revision: string | null;product: string;code: string;version: string;base: string;remark: string | null;lines: Line[] }
export type Plan = { root: string;nodes: Node[] }
export type Open = { plan: Plan;materials: Record<string, string>;statuses: Record<string, string> }
export type Change = { key: string;action: string;ancestor: boolean;version: string;before: Line[];after: Line[] }
export type Preview = { hash: string;changes: Change[];original: Plan;proposed: Plan;createdVersions: number;editedVersions: number;insertedLines: number;updatedLines: number;removedLines: number }
const api = '/api/basic/material-bom/tree'

export function readBomTree(id:string) {
  return request<Open>(api + '/' + encodeURIComponent(id), { scope: 'factory' })
}
export function previewBomTree(plan:Plan) {
  return request<Preview>(api + '/preview', { method: 'POST', scope: 'factory', body: plan })
}
export function confirmBomTree(plan:Plan, hash:string, requestId:string) {
  return request<{ root: string }>(api + '/confirm', { method: 'POST', scope: 'factory', body: { plan, hash, requestId }})
}
