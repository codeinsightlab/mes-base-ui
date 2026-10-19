import { request } from '@/lib/request'
import type { CrudApi, Row } from '@/lib/crud'
export const stockDocumentPermission = 'business:wm:stock:document'
export interface Header extends Row {
 id:string; documentNo:string; documentType:'OTHER_RECEIPT'|'OTHER_ISSUE'; status:'DRAFT'|'POSTED'|'CANCELLED';
 reason:string; remark:string|null; revision:string; sourceWorkorderId:string|null; postRequestId:string|null
}
export interface Line extends Row {id:string;documentId:string;lineNo:number;stockId:string;materialId:string;warehouseId:string;unitId:string;batchNo:string|null;binCode:string|null;quantity:string;remark:string|null;stockActionId:string|null}
export interface Detail { document:Header; lines:Line[] }
export interface PostIntent {requestId:string;expectedRevision:string}
export interface CancellationBasis {workorderId:string;productId:string;status:string;handedOver:string;accepted:string;manuallyReceived:string;remaining:string}
const root='/api/wm/stock-documents'
const path=(id:string)=>root+'/'+encodeURIComponent(id)
export const stockDocuments={
 list:(query:Record<string,string|number>)=>request<{items:Header[];total:number;offset:number;limit:number}>(root,{query,scope:'factory'}),
 detail:(id:string)=>request<Detail>(path(id),{scope:'factory'}),
 create:(body:unknown)=>request<Detail>(root,{method:'POST',body,scope:'factory'}),
 edit:(id:string,body:unknown)=>request<Detail>(path(id),{method:'PUT',body,scope:'factory'}),
 post:(id:string,body:PostIntent)=>request<Detail>(path(id)+'/actions/post',{method:'POST',body,scope:'factory'}),
 cancel:(id:string,expectedRevision:string)=>request<Detail>(path(id)+'/actions/cancel',{method:'POST',body:{expectedRevision},scope:'factory'}),
 putLine:(id:string,lineId:string|null,body:unknown)=>request<Line>(path(id)+'/lines'+(lineId?'/'+encodeURIComponent(lineId):''),{method:lineId?'PUT':'POST',body,scope:'factory'}),
 removeLine:(id:string,lineId:string,expectedRevision:string)=>request<void>(path(id)+'/lines/'+encodeURIComponent(lineId),{method:'DELETE',body:{expectedRevision},scope:'factory'}),
 basis:(id:string)=>request<CancellationBasis>(root+'/cancelled-workorders/'+encodeURIComponent(id)+'/basis',{scope:'factory'}),
}
/** Adapts the existing shared master/detail component to this document's versioned commands. */
export function stockDocumentApis(changed:()=>Promise<void>){
 let header:Header|null=null
 const parents=new Map<string,string>()
 const store=(d:Detail)=>{header=d.document;d.lines.forEach(l=>parents.set(l.id,l.documentId));return d}
 const headerApi:CrudApi={
  list:stockDocuments.list,
  detail:async id=>store(await stockDocuments.detail(id)).document,
  create:async raw=>{const b=raw as Row;return store(await stockDocuments.create({documentType:b.documentType,reason:b.reason,remark:b.remark,sourceWorkorderId:b.sourceWorkorderId})).document},
  update:async(id,raw)=>{const b=raw as Row;if(!header||header.id!==id)throw Error('请重新打开单据');return store(await stockDocuments.edit(id,{expectedRevision:header.revision,reason:b.reason,remark:b.remark})).document},
  remove:async()=>{throw Error('正式仓储单据仅允许作废草稿')}
 }
 const itemApi:CrudApi={
  list:async q=>{const id=String(q.documentId);const d=store(await stockDocuments.detail(id));const offset=Number(q.offset??0),limit=Number(q.limit??20);return {items:d.lines.slice(offset,offset+limit),total:d.lines.length,offset,limit}},
  detail:async id=>{const parent=parents.get(id);if(!parent)throw Error('请刷新明细');const d=store(await stockDocuments.detail(parent));const line=d.lines.find(l=>l.id===id);if(!line)throw Error('明细已不存在');return line},
  create:async raw=>save(null,raw), update:async(id,raw)=>save(id,raw),
  remove:async id=>{const parent=parents.get(id);if(!header||header.id!==parent)throw Error('请刷新主单');await stockDocuments.removeLine(parent!,id,header.revision);await changed()}
 }
 async function save(lineId:string|null,raw:unknown){
  const b=raw as Row,id=String(b.documentId ?? (lineId?parents.get(lineId):''));if(!header||header.id!==id)throw Error('请刷新主单')
  const result=await stockDocuments.putLine(id,lineId,{expectedRevision:header.revision,stockId:b.stockId,materialId:b.materialId,warehouseId:b.warehouseId,unitId:b.unitId,batchNo:b.batchNo,binCode:b.binCode,quantity:b.quantity,remark:b.remark})
  parents.set(result.id,id);await changed();return result
 }
 return {headerApi,itemApi,clear:()=>{header=null;parents.clear()}}
}
