export type StatusTone = 'running' | 'success' | 'warning' | 'error' | 'disabled'
// Resolve presentation from explicit business labels, never from a shared numeric code.
const labels: Record<string, StatusTone> = {
  正常:'running', 启用:'running', 运行中:'running', 执行中:'running', ENABLED:'running', RUNNING:'running',
  成功:'success', 完成:'success', 已完成:'success', SUCCEEDED:'success', COMPLETED:'success',
  待处理:'warning', 待执行:'warning', 风险:'warning', 警告:'warning', PENDING:'warning', UNKNOWN:'warning',
  失败:'error', 异常:'error', 错误:'error', REJECTED:'error', FAILED:'error', ERROR:'error',
  停用:'disabled', 禁用:'disabled', 暂停:'disabled', 关闭:'disabled', 已关闭:'disabled', DISABLED:'disabled', CLOSED:'disabled'
}
export function statusTone(label: string, fallback?: string): StatusTone {
  return labels[label] ?? ({primary:'running',success:'success',warning:'warning',danger:'error',info:'disabled'} as Record<string,StatusTone>)[fallback ?? ''] ?? 'disabled'
}
