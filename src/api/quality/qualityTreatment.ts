import { request } from '@/lib/request'
export type Action = 'ASSESS' | 'ALLOCATE' | 'START' | 'RESULT' | 'CANCEL_ALLOC' | 'CANCEL_START' | 'CORRECT_RESULT'
export type Attribution = 'INDEPENDENT' | 'OVERLAP' | 'UNVERIFIED'
export interface Assessment { type: Attribution; relatedDeclarationId: string | null; basis: string }
export interface Command { requestId: string; expectedRevision: number; action: Action; parentId: string | null; scrapQty: string; reworkQty: string; processedQty: string; recoveredQty: string; failedQty: string; occurredAt: string; reason: string; assessment: Assessment | null }
export interface Event { id: string; declarationId: string; declarationRevision: number; executionId: string; routingNodeId: string; actionType: Action; parentId: string | null; attributionType: Attribution | null; relatedDeclarationId: string | null; basis: string | null; scrapQty: string; reworkQty: string; processedQty: string; recoveredQty: string; failedQty: string; operatorUserId: string; operatorName: string | null; confirmedBy: string; confirmedByName: string | null; occurredAt: string; recordedAt: string; reason: string }
export interface Treatment { declarationId: string; revision: number; executionId: string; routingNodeId: string; defectQty: string; attribution: Attribution; relatedDeclarationId: string | null; basis: string | null; allocatedScrapQty: string; allocatedReworkQty: string; startedQty: string; processedQty: string; recoveredQty: string; failedQty: string; pendingDispositionQty: string; pendingStartQty: string; inProgressQty: string; netDefectQty: string; state: string; recordAction: string; destinationType: string; events: Event[] }
const path = (id: string) => '/api/quality/defects/' + encodeURIComponent(id) + '/treatment'
export const qualityTreatment = {
 details: (id: string) => request<Treatment>(path(id), { scope: 'factory' }),
 execute: (id: string, body: Command) => request<Treatment>(path(id), { method: 'POST', body, scope: 'factory' })
}
