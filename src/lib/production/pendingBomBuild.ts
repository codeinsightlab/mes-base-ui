import type { BomBuildChoice } from '@/api/production/workorder'

export interface BomBuildSource {
  productId: string
  bomId: string
  plannedQty: string
}

export interface PendingBomBuild {
  version: 1
  source: BomBuildSource
  confirmation: { requestId: string; fingerprint: string; orders: BomBuildChoice[] }
}

export function pendingBomBuildKey(userId: string, factoryId: string): string {
  return `mes-admin-workorder-bom-build-pending:v1:${encodeURIComponent(userId)}:${encodeURIComponent(factoryId)}`
}

export function restorePendingBomBuild(storage: Storage, key: string): { pending: PendingBomBuild | null; invalid: boolean } {
  const value = storage.getItem(key)
  if (value === null) return { pending: null, invalid: false }
  try {
    const parsed = JSON.parse(value) as PendingBomBuild
    if (parsed.version !== 1 || !parsed.source?.productId || !parsed.source.bomId
        || !parsed.source.plannedQty || !parsed.confirmation?.requestId
        || !parsed.confirmation.fingerprint || !Array.isArray(parsed.confirmation.orders))
      return { pending: null, invalid: true }
    return { pending: parsed, invalid: false }
  } catch {
    return { pending: null, invalid: true }
  }
}

export async function executePendingBomBuild<T>(storage: Storage, key: string,
  pending: PendingBomBuild, send: (source: BomBuildSource, confirmation: PendingBomBuild['confirmation']) => Promise<T>): Promise<T> {
  const current = restorePendingBomBuild(storage, key)
  if (current.invalid) throw new Error('原待确认请求无法读取，请先核实工单记录')
  if (current.pending && JSON.stringify(current.pending) !== JSON.stringify(pending))
    throw new Error('当前工厂已有结果未确认的展阶请求，请先恢复原请求')
  storage.setItem(key, JSON.stringify(pending))
  const result = await send(pending.source, pending.confirmation)
  const saved = restorePendingBomBuild(storage, key)
  if (saved.pending?.confirmation.requestId === pending.confirmation.requestId) storage.removeItem(key)
  return result
}
