import type { ReportCommand } from '@/api/production/productionReporting'
import { ApiError } from '@/lib/request'

export interface ReportingOwner { userId: string; factoryId: string }
interface RecoveryRecord extends ReportingOwner { version: 1; command: ReportCommand }
const fields = ['executionId', 'reportQty', 'requestId', 'routingNodeId', 'workstationId']
const id = (value: unknown): value is string => typeof value === 'string' && /^[1-9]\d*$/.test(value)
function key(owner: ReportingOwner) {
  if (!id(owner.userId) || !owner.factoryId) throw new Error('身份或工厂尚未校验，不能恢复报工请求')
  return 'mes.reporting.pending.v1:' + encodeURIComponent(JSON.stringify([owner.userId, owner.factoryId]))
}
function validCommand(value: unknown): value is ReportCommand {
  if (!value || typeof value !== 'object') return false
  const c = value as ReportCommand
  return Object.keys(c).sort().join(',') === fields.join(',') && id(c.executionId) && id(c.routingNodeId)
    && typeof c.reportQty === 'string' && /^\d{1,14}(\.\d{1,2})?$/.test(c.reportQty) && /[1-9]/.test(c.reportQty)
    && (c.workstationId === null || id(c.workstationId)) && typeof c.requestId === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(c.requestId)
}
function sameCommand(left: ReportCommand, right: ReportCommand) {
  return fields.every(field => left[field as keyof ReportCommand] === right[field as keyof ReportCommand])
}
export function readReportingRecovery(owner: ReportingOwner): ReportCommand | null {
  let raw: string | null
  try { raw = sessionStorage.getItem(key(owner)) } catch { throw new Error('待确认报工请求无法读取，请恢复会话存储并核对原请求，暂不能新报工') }
  if (raw === null) return null
  try {
    const saved = JSON.parse(raw) as RecoveryRecord
    if (!saved || Object.keys(saved).sort().join(',') !== 'command,factoryId,userId,version'
      || saved.version !== 1 || saved.userId !== owner.userId || saved.factoryId !== owner.factoryId || !validCommand(saved.command)) throw new Error('invalid')
    return { ...saved.command }
  } catch { throw new Error('待确认报工记录损坏或版本不支持，请联系管理员核对；原记录保留，暂不能新报工') }
}
export function saveReportingRecovery(owner: ReportingOwner, command: ReportCommand) {
  if (!validCommand(command)) throw new Error('报工请求不完整，尚未发送')
  const existing = readReportingRecovery(owner)
  if (existing && !sameCommand(existing, command)) throw new Error('当前工厂已有待确认报工，请先使用原请求核实，不能新报工')
  try { sessionStorage.setItem(key(owner), JSON.stringify({ version: 1, ...owner, command })) } catch { throw new Error('无法保存原报工请求，尚未发送，请恢复会话存储后重试') }
}
export function removeReportingRecovery(owner: ReportingOwner, command: ReportCommand) {
  const existing = readReportingRecovery(owner)
  if (existing && !sameCommand(existing, command)) throw new Error('恢复记录已变化，请核对原请求；未删除现有记录')
  try { sessionStorage.removeItem(key(owner)) } catch { throw new Error('原报工结果已确定，但恢复记录无法清理，暂不能新报工；请恢复会话存储后核对原请求') }
}

// Only a rejection of the first, uninterrupted call proves this new intent rolled back.
// Restored/in-flight-on-refresh requests are always uncertain, regardless of the later HTTP status.
export function isDefiniteReportingRejection(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false
  const statuses: Record<string, number> = {
    REPORT_QUANTITY_CONFLICT: 409, REPORT_PATH_REQUIRED: 409, QUALITY_ATTRIBUTION_REQUIRED: 409,
    REPORT_REFERENCE_INVALID: 422, OPERATOR_CAPABILITY_REQUIRED: 422, OPERATOR_NOT_ASSIGNED: 422,
    EXECUTION_INVALID: 422, WORKORDER_NOT_RELEASED: 422
  }
  return statuses[error.code] === error.status
}
