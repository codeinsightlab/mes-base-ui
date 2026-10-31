import { request } from '@/lib/request'

export interface ProductionIdentity {
  executionId: string;
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

export const readProductionIdentity = (executionId: string) =>
  request<ProductionIdentity>('/api/production/identity/' + encodeURIComponent(executionId), { scope: 'factory' })
