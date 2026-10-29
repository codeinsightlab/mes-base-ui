import { request } from '@/lib/request'
import type { CrudApi, Row } from '@/lib/crud'
export type StockDocumentDirection = 'IN' | 'OUT'
export type StockDocumentType = 'PURCHASE_RECEIPT' | 'PRODUCTION_RECEIPT' | 'OUTSOURCE_RECEIPT' | 'MATERIAL_RETURN_RECEIPT' | 'REWORK_RECEIPT' | 'SALES_RETURN_RECEIPT' | 'DEFECT_RECEIPT' | 'SCRAP_RECEIPT' | 'OTHER_RECEIPT' | 'MATERIAL_ISSUE' | 'OTHER_ISSUE' | 'TRANSFER_RECEIPT' | 'TRANSFER_ISSUE'
export interface StockDocumentTypeOption { value: StockDocumentType; direction: StockDocumentDirection; label: string; origin: string; requiredDocuments: string; approvalAvailable: boolean; qualityReceipt: boolean; enabled: boolean }
export interface NumberingRuleOption { typeKey: StockDocumentType; ruleCode: string; ruleName: string | null; prefix: string | null; preview: string | null; available: boolean; issue: string | null }
const semantics: Partial<Record<StockDocumentType, { origin: string;basis: string;approvalAvailable: boolean }>> = {
  PURCHASE_RECEIPT: { origin: '供应商交货', basis: '采购订单、收货单', approvalAvailable: false }, PRODUCTION_RECEIPT: { origin: '工单生产完成', basis: '工单、Execution、报工及质量数量依据', approvalAvailable: true },
  OUTSOURCE_RECEIPT: { origin: '外协厂加工完成', basis: '委外单、委外发料记录', approvalAvailable: false }, MATERIAL_RETURN_RECEIPT: { origin: '生产领料后退回', basis: '原领料单、工单', approvalAvailable: false },
  REWORK_RECEIPT: { origin: '返工完成并检验合格', basis: '原不良记录、返工任务及检验依据', approvalAvailable: false }, SALES_RETURN_RECEIPT: { origin: '客户退回产品', basis: '销售出库单、退货单', approvalAvailable: false },
  DEFECT_RECEIPT: { origin: '不良品转入不良品仓', basis: '原不良记录、处置流水', approvalAvailable: true }, SCRAP_RECEIPT: { origin: '不良品转入报废品仓', basis: '原不良记录、处置流水', approvalAvailable: true },
  OTHER_RECEIPT: { origin: '盘盈、期初等特殊业务', basis: '原因及实物、审批或调整依据', approvalAvailable: true }, MATERIAL_ISSUE: { origin: '工单生产投入', basis: '工单、已发布BOM、实际路径及精确库存来源', approvalAvailable: true },
  OTHER_ISSUE: { origin: '其他库存发出', basis: '原因及实物、审批或调整依据', approvalAvailable: true }
}
export const stockDocumentPurpose = (value:unknown) => typeof value === 'string' && Object.hasOwn(semantics, value)
  ? { value, ...semantics[value as StockDocumentType] } : undefined
export const stockDocumentPermission = 'business:wm:stock:document'
export interface Header extends Row {
  id: string; documentNo: string; direction: StockDocumentDirection; documentType: StockDocumentType; status: 'DRAFT' | 'POSTED' | 'CANCELLED';
  reason: string; remark: string | null; revision: string; sourceWorkorderId: string | null; sourceExecutionId: string | null; postRequestId: string | null; createRequestId?: string | null
}
export interface Line extends Row { id: string;documentId: string;lineNo: number;stockId: string | null;materialId: string;warehouseId: string | null;unitId: string | null;batchNo: string | null;binCode: string | null;quantity: string;remark: string | null;stockActionId: string | null }
export interface MaterialIssueBasis { requestId: string;code: string;workorderId: string;outputQty: string;routingId: string;routingNodeIds: string[] }
export interface ProductionInputBasis {
  requestId: string;inputKind: string;sourceMode: string;executionId: string;workorderId: string;workorderCode: string;
  outputQty: string;issueQty: string;materialId: string;materialCode: string;warehouseId: string;unitId: string;batchNo: string;
  bomId: string | null;bomBaseQty: string | null;bomComponentQty: string | null;pathRevision: string | null;
  routingNodeIds: string[];businessOccurredAt: string | null;confirmedAt: string | null;stockApplied: boolean | null;voidOperationId: string | null;
  voidResultStatus: string | null;pathError: string | null
}
export interface Detail { materialIssueBasisError?: string | null; materialIssueBasis?: MaterialIssueBasis | null; document: Header; lines: Line[]; qualitySource?: { sourceDeclarationId: string;sourceTreatmentId: string;sourceQualityExecutionId: string } | null }
export interface ProductionReceiptCommand { requestId: string; stockId: string; quantity: string; reason: string }
export interface ApprovalIntent { requestId: string;expectedRevision: string }
export interface MaterialIssueVoidResult {
  documentId: string;documentStatus: string;productionInputStatus: string | null;voidOperationId: string | null;
  voidResultStatus: string | null;voidRequestedAt: string | null;voidFinishedAt: string | null;message: string | null
}
export interface ProductionBasis { executionId: string;productId: string;effective: string;received: string;remaining: string;canReceive: boolean;blockedReason: string | null }
export interface CancellationBasis { workorderId: string;productId: string;status: string;handedOver: string;accepted: string;manuallyReceived: string;remaining: string }
const root = (direction: StockDocumentDirection = 'OUT') => '/api/wm/' + (direction === 'IN' ? 'inbound-documents' : 'outbound-documents')
const path = (id:string, direction: StockDocumentDirection = 'OUT') => root(direction) + '/' + encodeURIComponent(id)
export const stockDocuments = {
  types: (direction: StockDocumentDirection) => request<StockDocumentTypeOption[]>(root(direction) + '/types', { scope: 'factory' }),
  list: (query:Record<string, string | number>, direction:StockDocumentDirection = 'OUT') => request<{ items: Header[];total: number;offset: number;limit: number }>(root(direction), { query, scope: 'factory' }),
  detail: (id:string, direction: StockDocumentDirection = 'OUT', materialIssueOnly = false) => request<Detail>(path(id, direction), { query: { ...(materialIssueOnly ? { documentType: 'MATERIAL_ISSUE' } : {}) }, scope: 'factory' }),
  byRequest: (requestId:string) => request<Detail>(root('OUT') + '/by-request/' + encodeURIComponent(requestId), { scope: 'factory' }),
  productionInputBasis: (id:string, materialIssueOnly = false) => request<ProductionInputBasis | null>(path(id) + '/production-input-basis', { query: { ...(materialIssueOnly ? { documentType: 'MATERIAL_ISSUE' } : {}) }, scope: 'factory' }),
  materialIssueLines: (id:string) => request<Line[]>(path(id) + '/lines', { query: { documentType: 'MATERIAL_ISSUE' }, scope: 'factory' }),
  materialIssueLine: (id:string, lineId:string) => request<Line>(path(id) + '/lines/' + encodeURIComponent(lineId), { query: { documentType: 'MATERIAL_ISSUE' }, scope: 'factory' }),
  createAggregate: (body:unknown, direction:StockDocumentDirection = 'OUT') => request<Detail>(root(direction) + '/aggregate', { method: 'POST', body, scope: 'factory' }),
  numberingRules: (direction: StockDocumentDirection) => request<NumberingRuleOption[]>(root(direction) + '/numbering-rules', { scope: 'factory' }),
  numberPreview: (typeKey: StockDocumentType, direction: StockDocumentDirection) => request<NumberingRuleOption>(root(direction) + '/numbering-rules/preview', { query: { typeKey }, scope: 'factory' }),
  editAggregate: (id:string, body:unknown, direction:StockDocumentDirection = 'OUT') => request<Detail>(path(id, direction) + '/aggregate', { method: 'PUT', body, scope: 'factory' }),
  approve: (id:string, body:ApprovalIntent, direction:StockDocumentDirection = 'OUT') => request<Detail>(path(id, direction) + '/actions/approve', { method: 'POST', body, scope: 'factory' }),
  cancel: (id:string, expectedRevision:string, direction:StockDocumentDirection = 'OUT') => request<Detail>(path(id, direction) + '/actions/cancel', { method: 'POST', body: { expectedRevision }, scope: 'factory' }),
  voidMaterialIssue: (id:string, reconcile = false) => request<MaterialIssueVoidResult>(path(id) + '/actions/' + (reconcile ? 'reconcile-void' : 'void'), { method: 'POST', scope: 'factory' }),
  receiveProduction: (id:string, body:ProductionReceiptCommand) => request<Detail>('/api/production/executions/' + encodeURIComponent(id) + '/inbound', { method: 'POST', body, scope: 'factory' }),
  productionBasis: (id:string) => request<ProductionBasis>(root('IN') + '/executions/' + encodeURIComponent(id) + '/basis', { scope: 'factory' }),
  basis: (id:string) => request<CancellationBasis>(root('IN') + '/cancelled-workorders/' + encodeURIComponent(id) + '/basis', { scope: 'factory' })
}
/** The document and its complete set of lines are saved by one business command. */
export function stockDocumentApis(access: { issueListOnly: () => boolean; issueQueryOnly: () => boolean } = { issueListOnly: () => false, issueQueryOnly: () => false }, direction: () => StockDocumentDirection = () => 'OUT') {
  const unsupported = async(): Promise<never> => { throw Error('请使用整单保存') }
  const headerApi: CrudApi = {
    list: query => stockDocuments.list({ ...query, ...(access.issueListOnly() ? { documentType: 'MATERIAL_ISSUE' } : {}) }, direction()),
    detail: async id => (await stockDocuments.detail(id, direction(), access.issueQueryOnly())).document,
    create: unsupported, update: unsupported,
    remove: async() => { throw Error('正式仓储单据仅允许作废草稿') }
  }
  const itemApi: CrudApi = { list: unsupported, detail: unsupported, create: unsupported, update: unsupported, remove: unsupported }
  const view = (detail:Detail) => ({
    header: { ...detail.document, ...detail.qualitySource, isNew: '', materialIssueBasis: detail.materialIssueBasis ?? null,
      materialIssueBasisError: detail.materialIssueBasisError ?? null },
    items: detail.lines
  })
  const command = (raw:unknown) => {
    const b = raw as Row
    if (!Array.isArray(b.items)) throw Error('请填写单据明细')
    return { header: { documentType: b.documentType, reason: b.reason, remark: b.remark,
      sourceWorkorderId: b.sourceWorkorderId, sourceExecutionId: b.sourceExecutionId,
      ruleCode: b.ruleCode, expectedRevision: b.revision }, productionIssue: b.productionIssue, items: b.items.map((value:unknown) => {
      const line = value as Row
      return { id: line.id ?? null, stockId: line.stockId, materialId: line.materialId, warehouseId: line.warehouseId,
        unitId: line.unitId, batchNo: line.batchNo, binCode: line.binCode, quantity: line.quantity, remark: line.remark }
    }) }
  }
  const aggregateApi = {
    detail: async(id:string) => view(await stockDocuments.detail(id, direction(), access.issueQueryOnly())),
    create: async(raw:unknown) => {
      const b = raw as Row
      if (typeof b.ruleCode !== 'string' || !b.ruleCode) throw Error('请选择出入库单编码规则')
      return view(await stockDocuments.createAggregate(command(raw), direction()))
    },
    update: async(id:string, raw:unknown) => view(await stockDocuments.editAggregate(id, command(raw), direction()))
  }
  return { headerApi, itemApi, aggregateApi }
}
