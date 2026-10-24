import { request } from '@/lib/request'
import type { CrudApi, Row } from '@/lib/crud'
export const stockDocumentTypes = [
 {value:'PURCHASE_RECEIPT',label:'采购入库',origin:'供应商交货',basis:'采购订单、收货单',approvalAvailable:false},
 {value:'PRODUCTION_RECEIPT',label:'生产完工入库',origin:'工单生产完成',basis:'工单、Execution、报工、不良及入库审核记录',approvalAvailable:true},
 {value:'OUTSOURCE_RECEIPT',label:'委外加工入库',origin:'外协厂加工完成',basis:'委外单、委外发料记录',approvalAvailable:false},
 {value:'MATERIAL_RETURN_RECEIPT',label:'退料入库',origin:'生产领料后退回',basis:'原领料单、工单',approvalAvailable:false},
 {value:'REWORK_RECEIPT',label:'返工入库',origin:'返工完成并检验合格',basis:'原不良记录、返工任务及检验依据',approvalAvailable:false},
 {value:'SALES_RETURN_RECEIPT',label:'销售退货入库',origin:'客户退回产品',basis:'销售出库单、退货单',approvalAvailable:false},
 {value:'DEFECT_RECEIPT',label:'不良品入库',origin:'不良品转入不良品仓',basis:'原不良记录、处置流水',approvalAvailable:true},
 {value:'SCRAP_RECEIPT',label:'报废品入库',origin:'不良品转入报废品仓',basis:'原不良记录、处置流水',approvalAvailable:true},
 {value:'OTHER_RECEIPT',label:'其他入库',origin:'盘盈、期初等特殊业务',basis:'原因及实物、审批或调整依据',approvalAvailable:true},
 {value:'MATERIAL_ISSUE',label:'生产领料出库',origin:'工单BOM正式领料',basis:'工单、已发布BOM、实际路径及精确库存来源',approvalAvailable:true},
 {value:'OTHER_ISSUE',label:'其他出库',origin:'其他库存发出',basis:'原因及实物、审批或调整依据',approvalAvailable:true}
] as const
export type StockDocumentType = typeof stockDocumentTypes[number]['value']
export const stockDocumentPurpose = (value:unknown) => stockDocumentTypes.find(t=>t.value===value)
export const stockDocumentPermission = 'business:wm:stock:document'
export interface Header extends Row {
 id:string; documentNo:string; documentType:StockDocumentType; status:'DRAFT'|'POSTED'|'CANCELLED';
 reason:string; remark:string|null; revision:string; sourceWorkorderId:string|null; sourceExecutionId:string|null; postRequestId:string|null
}
export interface Line extends Row {id:string;documentId:string;lineNo:number;stockId:string;materialId:string;warehouseId:string;unitId:string;batchNo:string|null;binCode:string|null;quantity:string;remark:string|null;stockActionId:string|null}
export interface MaterialIssueBasis {requestId:string;code:string;workorderId:string;outputQty:string;routingId:string;routingNodeIds:string[]}
export interface Detail { materialIssueBasisError?:string|null; materialIssueBasis?:MaterialIssueBasis|null; document:Header; lines:Line[]; qualitySource?:{sourceDeclarationId:string;sourceTreatmentId:string;sourceQualityExecutionId:string}|null }
export interface ProductionReceiptCommand { requestId:string; stockId:string; quantity:string; reason:string }
export interface ApprovalIntent {requestId:string;expectedRevision:string}
export interface ProductionBasis {executionId:string;productId:string;effective:string;received:string;remaining:string;canReceive:boolean;blockedReason:string|null}
export interface CancellationBasis {workorderId:string;productId:string;status:string;handedOver:string;accepted:string;manuallyReceived:string;remaining:string}
const root='/api/wm/stock-documents'
const path=(id:string)=>root+'/'+encodeURIComponent(id)
export const stockDocuments={
 list:(query:Record<string,string|number>)=>request<{items:Header[];total:number;offset:number;limit:number}>(root,{query,scope:'factory'}),
 detail:(id:string)=>request<Detail>(path(id),{scope:'factory'}),
 create:(body:unknown)=>request<Detail>(root,{method:'POST',body,scope:'factory'}),
 edit:(id:string,body:unknown)=>request<Detail>(path(id),{method:'PUT',body,scope:'factory'}),
 approve:(id:string,body:ApprovalIntent)=>request<Detail>(path(id)+'/actions/approve',{method:'POST',body,scope:'factory'}),
 cancel:(id:string,expectedRevision:string)=>request<Detail>(path(id)+'/actions/cancel',{method:'POST',body:{expectedRevision},scope:'factory'}),
 putLine:(id:string,lineId:string|null,body:unknown)=>request<Line>(path(id)+'/lines'+(lineId?'/'+encodeURIComponent(lineId):''),{method:lineId?'PUT':'POST',body,scope:'factory'}),
 removeLine:(id:string,lineId:string,expectedRevision:string)=>request<void>(path(id)+'/lines/'+encodeURIComponent(lineId),{method:'DELETE',body:{expectedRevision},scope:'factory'}),
 receiveProduction:(id:string,body:ProductionReceiptCommand)=>request<Detail>('/api/production/executions/'+encodeURIComponent(id)+'/inbound',{method:'POST',body,scope:'factory'}),
 productionBasis:(id:string)=>request<ProductionBasis>(root+'/executions/'+encodeURIComponent(id)+'/basis',{scope:'factory'}),
 basis:(id:string)=>request<CancellationBasis>(root+'/cancelled-workorders/'+encodeURIComponent(id)+'/basis',{scope:'factory'}),
}
/** Adapts the existing shared master/detail component to this document's versioned commands. */
export function stockDocumentApis(changed:()=>Promise<void>){
 let header:Header|null=null
 const parents=new Map<string,string>()
 const store=(d:Detail)=>{header={...d.document,...d.qualitySource,materialIssueBasis:d.materialIssueBasis??null,materialIssueBasisError:d.materialIssueBasisError??null};d.lines.forEach(l=>parents.set(l.id,l.documentId));return d}
 const headerApi:CrudApi={
  list:stockDocuments.list,
  detail:async id=>{store(await stockDocuments.detail(id));return header!},
  create:async raw=>{const b=raw as Row;return store(await stockDocuments.create({documentType:b.documentType,reason:b.reason,remark:b.remark,sourceWorkorderId:b.sourceWorkorderId,sourceExecutionId:b.sourceExecutionId})).document},
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
