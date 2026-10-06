import type { StatusTone } from '@/lib/status'

export type LatencyTone = 'normal' | 'attention' | 'warning' | 'error' | 'unknown'
export function latencyTone(value: number | string | null | undefined): LatencyTone {
  if (value == null || value === '' || !Number.isFinite(Number(value)) || Number(value) < 0) return 'unknown'
  const duration = Number(value)
  return duration > 5000 ? 'error' : duration > 3000 ? 'warning' : duration >= 1000 ? 'attention' : 'normal'
}
export const latencyLabels: Record<LatencyTone, string> = { normal: '正常耗时', attention: '耗时需关注', warning: '较慢请求', error: '高耗时请求', unknown: '耗时未记录' }

/** Source monitoring result codes are explicitly 0=success, 1=failure. */
export function operationStatus(value: number | string | null | undefined): { label: string; tone: StatusTone } {
  return String(value) === '0' ? { label: '成功', tone: 'success' } : String(value) === '1' ? { label: '失败', tone: 'error' } : { label: value == null ? '未记录' : String(value), tone: 'disabled' }
}
