import { request } from '@/lib/request'
export interface Completion {id:string;executionId:string;effectiveQty:string;releasedQty:string;receiptQty:string;acceptedQty:string;operatorUserId:string;recordedAt:string;reason:string}
export interface ClosureSummary {executionId:string;executionNo:string;status:string;targetQty:string;effective:string;released:string;historicalReleased:string;received:string;accepted:string;remainingHandover:string;pendingAcceptance:string;outputExcess:string;releaseExcess:string;basisHash:string;canComplete:boolean;blockedReason:string|null;completion:Completion|null}
export interface ReleaseFact {id:string;executionId:string;sequenceNo:string;actionType:string;quantity:string;basisHash:string;referenceId:string|null;operatorUserId:string;recordedAt:string;reason:string}
export interface ReleaseState {executionId:string;effective:string;released:string;historicalReleased:string;currentReleaseId:string|null;basisHash:string;basisValid:boolean;safe:boolean;blockedReason:string|null}
export type ClosureAction='release'|'revoke'|'complete'
export interface ClosureIntent {action:ClosureAction;body:{requestId:string;quantity?:string;expectedReleaseId?:string|null;expectedBasisHash?:string;reason:string}}
const execution=(id:string)=>'/api/production/executions/'+encodeURIComponent(id)
const release=(id:string)=>'/api/quality/releases/executions/'+encodeURIComponent(id)
export const productionClosure={
 summary:(id:string)=>request<ClosureSummary>(execution(id)+'/closure',{scope:'factory'}),
 release:(id:string)=>request<ReleaseState>(release(id),{scope:'factory'}),
 history:(id:string,offset=0)=>request<{items:ReleaseFact[];total:number}>(release(id)+'/history',{query:{offset,limit:20},scope:'factory'}),
 execute:(id:string,c:ClosureIntent)=>request<ReleaseFact|Completion>(c.action==='complete'?execution(id)+'/actions/complete':release(id)+(c.action==='revoke'?'/revoke':''),{method:'POST',body:c.body,scope:'factory'})
}
