import { request } from '@/lib/request'
import type { ProductionIdentity } from './productionIdentity'

export type ProductionScanType = 'EXECUTION_LOOKUP' | 'REPORTING' | 'DEFECT_DECLARATION'
export type ScanInputMethod = 'TEXT' | 'IMAGE'

export function scanExecution(type: ProductionScanType, code: string, inputMethod: ScanInputMethod = 'TEXT'): Promise<ProductionIdentity> {
  return request<ProductionIdentity>('/api/production/scan', { method: 'POST', body: { type, code, inputMethod }, scope: 'factory' })
}
