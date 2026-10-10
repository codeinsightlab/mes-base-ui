// MES-CODEGEN: RuoYi API module pattern adapted to typed Base contracts.
import { request } from '@/lib/request'

export interface ProWorkorderVo {
  [key: string]: unknown;
  workorderId: string;
  workorderCode: string;
  workorderName: string;
  orderSource: string;
  sourceCode: string | null;
  productId: string;
  productCode: string;
  productName: string;
  productSpc: string | null;
  unitOfMeasure: string;
  quantity: number;
  quantityProduced: number | null;
  quantityChanged: number | null;
  quantityScheduled: number | null;
  clientId: string | null;
  clientCode: string | null;
  clientName: string | null;
  batchCode: string | null;
  requestDate: string;
  parentId: string;
  ancestors: string;
  finishDate: string | null;
  status: string | null;
  remark: string | null;
  attr1: string | null;
  attr2: string | null;
  attr3: number | null;
  attr4: number | null;
  createBy: string | null;
  createTime: string | null;
  updateBy: string | null;
  updateTime: string | null;
  transactionDate: string | null;
  moId: string;
}

export interface Page {
  items: ProWorkorderVo[];
  total: number;
  offset: number;
  limit: number;
}

export type CreateCommand = Pick<ProWorkorderVo, 'workorderCode' | 'workorderName' | 'orderSource' | 'sourceCode' | 'productId' | 'productCode' | 'productName' | 'productSpc' | 'unitOfMeasure' | 'quantity' | 'quantityProduced' | 'quantityChanged' | 'quantityScheduled' | 'clientId' | 'clientCode' | 'clientName' | 'batchCode' | 'requestDate' | 'parentId' | 'ancestors' | 'finishDate' | 'status' | 'remark' | 'attr1' | 'attr2' | 'attr3' | 'attr4' | 'transactionDate' | 'moId'>
export type UpdateCommand = Pick<ProWorkorderVo, 'workorderCode' | 'workorderName' | 'orderSource' | 'sourceCode' | 'productId' | 'productCode' | 'productName' | 'productSpc' | 'unitOfMeasure' | 'quantity' | 'quantityProduced' | 'quantityChanged' | 'quantityScheduled' | 'clientId' | 'clientCode' | 'clientName' | 'batchCode' | 'requestDate' | 'parentId' | 'ancestors' | 'finishDate' | 'status' | 'remark' | 'attr1' | 'attr2' | 'attr3' | 'attr4' | 'transactionDate' | 'moId'>

const removeIds = (ids: string[]) =>
  request<void>('/api/pro/pro-workorder', { method: 'DELETE', body: ids, scope: 'factory' })

export const api = {
  list: (query: Record<string, string | number>) =>
    request<Page>('/api/pro/pro-workorder', { query, scope: 'factory' }),

  detail: (id: string) =>
    request<ProWorkorderVo>('/api/pro/pro-workorder/' + encodeURIComponent(id), { scope: 'factory' }),

  create: (body: unknown) =>
    request<ProWorkorderVo>('/api/pro/pro-workorder', { method: 'POST', body, scope: 'factory' }),

  update: (id: string, body: unknown) =>
    request<ProWorkorderVo>('/api/pro/pro-workorder/' + encodeURIComponent(id), {
      method: 'PUT', body, scope: 'factory'
    }),

  remove: (id: string) => removeIds([id]),

  delids: removeIds
}
