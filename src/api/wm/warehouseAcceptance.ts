import { request } from '@/lib/request'
export interface AcceptanceState {receiptId:string;executionId:string;productId:string;warehouseId:string;productLotCode:string|null;netHandover:string;accepted:string;pending:string}
export interface AcceptanceFact {id:string;receiptId:string;executionId:string;productId:string;stockId:string;quantityDelta:string;referenceId:string|null;stockActionId:string;operatorUserId:string;recordedAt:string;reason:string}
export interface AcceptanceIntent {action:'accept'|'reverse';referenceId:string|null;body:{requestId:string;stockId?:string;quantity:string;reason:string}}
const url='/api/wm/production-acceptances'
export const warehouseAcceptance={
 state:(id:string)=>request<AcceptanceState>(url+'/receipts/'+encodeURIComponent(id),{scope:'factory'}),
 history:(id:string,offset=0)=>request<{items:AcceptanceFact[];total:number}>(url+'/receipts/'+encodeURIComponent(id)+'/history',{query:{offset,limit:20},scope:'factory'}),
 execute:(id:string,c:AcceptanceIntent)=>request<AcceptanceFact>(c.action==='accept'?url+'/receipts/'+encodeURIComponent(id):url+'/'+encodeURIComponent(c.referenceId??'')+'/reverse',{method:'POST',body:c.body,scope:'factory'})
}
