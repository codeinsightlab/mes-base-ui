import { request } from '@/lib/request'

export interface ProductionIdentity {
  executionCode: string;
  qrCode: string | null;
  workorderId: string;
  workorderCode: string;
  productId: string;
  productCode: string;
  productName: string;
  batchNo: string | null;
  routingId: string | null;
  routingCode: string | null;
  routingVersion: number | null;
  status: string;
  targetQty: string;
}

export const readProductionIdentity = (executionCode: string) =>
  request<ProductionIdentity>('/api/production/identity/' + encodeURIComponent(executionCode), { scope: 'factory' })
