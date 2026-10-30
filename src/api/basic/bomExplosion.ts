import { request } from '@/lib/request'
export interface ExplosionVersion { id: string; code: string; version: string; status: string; baseQty: string | null; unitId: string; defaultVersion: boolean | null }
export interface ExplosionNode {
  path: string; level: number; lineId: string; parentBomId: string; parentBomVersion: string
  materialId: string; code: string | null; name: string | null; unitId: string; unitName: string | null
  componentQty: string | null; baseQty: string | null; quantity: string | null; childBomId: string | null; leaf: boolean; children: ExplosionNode[]
}
export interface Explosion {
  material: { id: string; code: string; name: string; unitId: string; status: string }
  outputQty: string; selectedVersion: ExplosionVersion | null
  versions: { items: ExplosionVersion[]; total: number; offset: number; limit: number }
  selectionRequired: boolean; complete: boolean; items: ExplosionNode[]
  totals: { materialId: string; code: string; name: string; unitId: string; unitName: string; quantity: string; paths: string[] }[]
  problems: { path: string; bomId: string | null; lineId: string | null; errorCode: string; message: string }[]
}
export interface ExplosionQuery { materialCode: string; quantity: string; bomId?: string; versionOffset?: number; versionLimit?: number }
export const explodeBom = (query: ExplosionQuery) => request<Explosion>('/api/basic/material-bom/explode', { query: { ...query }, scope: 'factory' })
