import { request } from '@/lib/request'

export type PreviewKind = 'workorder' | 'warehouse'
export interface Capability { supported: boolean; writeEnabled: boolean; blockers: string[] }
export interface Candidate {
  code: string | null; name: string | null; site: string | null; ownerOrg: string | null
  productCode: string | null; unitCode: string | null; processCode: string | null
  externalStatus: string | null; plannedQty: string | null
}
export interface Preview {
  status: 'PREVIEW_ONLY'; runToken: string; provider: string; binding: string; configurationVersion: string
  pageNo: number; pageSize: number; fetched: number; created: number; updated: number; skipped: number
  possiblyMore: boolean; candidates: Candidate[]; blockers: string[]
}
const path = (kind: PreviewKind) => kind === 'workorder'
  ? '/api/production/workorder/erp-preview' : '/api/wm/wm-warehouse/erp-preview'
export const capability = (kind: PreviewKind) => request<Capability>(path(kind), { scope: 'factory' })
export const preview = (kind: PreviewKind, pageNo: number) => request<Preview>(path(kind), {
  method: 'POST', query: { pageNo, pageSize: 20 }, scope: 'factory'
})

export interface SyncItem {
  code: string | null; externalId: string | null; action: string; reasons: string[]
  productId: string | null; routingId: string | null; quantity: string | null; unit: string | null
}
export interface SyncResult {
  status: 'DRY_RUN' | 'COMMITTED' | 'PARTIAL_SUCCESS' | 'FAILED'; factoryId: string
  provider: string; binding: string; configurationVersion: string; runToken: string
  fetched: number; duplicates: number; creatable: number; updatable: number; unchanged: number
  conflicts: number; blocked: number; created: number; updated: number; items: SyncItem[]; failureReason?: string | null
}
export const sync = (kind: PreviewKind, commit: boolean) => request<SyncResult>(path(kind) + (commit ? '/commit' : '/dry-run'), {
  method: 'POST', query: { pageSize: 20, maxPages: 5 }, scope: 'factory', timeoutMs: 120000
})
