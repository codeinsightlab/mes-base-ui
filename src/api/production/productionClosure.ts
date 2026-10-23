import { request } from '@/lib/request'
export interface Completion {id:string;executionId:string;effectiveQty:string;releasedQty:string;inboundQty:string;operatorUserId:string;recordedAt:string;reason:string}
export interface ClosureSummary {executionId:string;status:string;targetQty:string;effective:string;released:string;historicalReleased:string;basisHash:string;receivedQty:string;defectQty:string;receiptState:'PENDING'|'PARTIAL'|'FULLY_RECEIVED';orderBlockedReason:string|null;canComplete:boolean;blockedReason:string|null;completion:Completion|null}
export interface ReleaseFact {id:string;executionId:string;sequenceNo:string;actionType:string;quantity:string;basisHash:string;referenceId:string|null;operatorUserId:string;recordedAt:string;reason:string}
export interface ReleaseState {executionId:string;effective:string;released:string;historicalReleased:string;currentReleaseId:string|null;basisHash:string;basisValid:boolean;safe:boolean;blockedReason:string|null}
export type ClosureAction='release'|'revoke'
export interface ClosureIntent {action:ClosureAction;body:{requestId:string;quantity?:string;expectedReleaseId?:string|null;reason:string}}
const execution=(id:string)=>'/api/production/executions/'+encodeURIComponent(id)
const release=(id:string)=>'/api/quality/releases/executions/'+encodeURIComponent(id)
export const productionClosure={
 summary:(id:string)=>request<ClosureSummary>(execution(id)+'/closure',{scope:'factory'}),
 recheckReceipt:(id:string)=>request<ClosureSummary>(execution(id)+'/actions/recheck-receipt',{method:'POST',scope:'factory'}),
 release:(id:string)=>request<ReleaseState>(release(id),{scope:'factory'}),
 history:(id:string,offset=0)=>request<{items:ReleaseFact[];total:number}>(release(id)+'/history',{query:{offset,limit:20},scope:'factory'}),
 execute:(id:string,c:ClosureIntent)=>{
  if(!['release','revoke'].includes(c.action))throw new Error('手动完工已停用，请查询入库收尾状态')
  return request<ReleaseFact>(release(id)+(c.action==='revoke'?'/revoke':''),{method:'POST',body:c.body,scope:'factory'})
 }
}
