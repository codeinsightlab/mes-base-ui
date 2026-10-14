import { request } from '@/lib/request'

export interface ProductionIdentity {
  executionId: string;
  executionNo: string;
  qrCode: string;
  workorderId: string;
  workorderCode: string;
  productId: string;
  productCode: string;
  productName: string;
  routingId: string;
  routingCode: string;
  routingVersion: number;
  status: string;
  targetQty: string;
}

export const resolveProductionIdentity = (code: string) =>
  request<ProductionIdentity>('/api/production/identity', { query: { code }, scope: 'factory' })
