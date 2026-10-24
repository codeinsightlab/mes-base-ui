import { beforeEach, expect, it, vi } from 'vitest'
import { readReportingRecovery, saveReportingRecovery, removeReportingRecovery, isDefiniteReportingRejection } from '../src/lib/production/reportingRecovery'
import { ApiError } from '../src/lib/request'
const owner = { userId: '7', factoryId: 'A' }
const command = { executionId: '1', routingNodeId: '2', reportQty: '2.00', workstationId: null, requestId: '12345678-abcd-1234-abcd-123456789abc' }
beforeEach(() => { vi.restoreAllMocks(); sessionStorage.clear() })
it('stores only the frozen command and identity binding, without TTL, token or cached profiles/grants', () => {
  saveReportingRecovery(owner, command)
  expect(JSON.parse(sessionStorage.getItem(sessionStorage.key(0)!)!)).toEqual({ version: 1, ...owner, command })
  const clock = vi.spyOn(Date, 'now').mockReturnValue(9999999999999)
  expect(readReportingRecovery(owner)).toEqual(command); clock.mockRestore()
  expect(readReportingRecovery({ ...owner, userId: '8' })).toBeNull()
  expect(readReportingRecovery({ ...owner, factoryId: 'B' })).toBeNull()
})
it('never overwrites or deletes another pending command', () => {
  saveReportingRecovery(owner, command)
  const other = { ...command, requestId: '22345678-abcd-1234-abcd-123456789abc' }
  expect(() => saveReportingRecovery(owner, other)).toThrow('已有待确认')
  expect(() => removeReportingRecovery(owner, other)).toThrow('已变化')
  expect(readReportingRecovery(owner)).toEqual(command)
  removeReportingRecovery(owner, command); expect(readReportingRecovery(owner)).toBeNull()
})
it.each(['{bad', JSON.stringify({ version: 2, ...owner, command }), JSON.stringify({ version: 1, ...owner, userId: '8', command }), JSON.stringify({ version: 1, ...owner, command: { ...command, reportQty: '0' }})])('retains invalid data and refuses to overwrite it', raw => {
  saveReportingRecovery(owner, command); const key = sessionStorage.key(0)!
  sessionStorage.setItem(key, raw)
  expect(() => readReportingRecovery(owner)).toThrow('损坏或版本不支持')
  expect(() => saveReportingRecovery(owner, command)).toThrow()
  expect(sessionStorage.getItem(key)).toBe(raw)
})
it('reports inaccessible storage instead of reading an empty recovery list', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
  expect(() => readReportingRecovery(owner)).toThrow('无法读取')
})
it('distinguishes definite domain rollback from access and idempotency conflicts', () => {
  expect(isDefiniteReportingRejection(new ApiError('REPORT_QUANTITY_CONFLICT', '', '', 409))).toBe(true)
  for (const [code, status] of [['RESOURCE_CONFLICT', 409], ['UNAUTHENTICATED', 401], ['FORBIDDEN', 403], ['EXECUTION_NOT_FOUND', 404], ['CONTEXT_CHANGED', 0], ['REPORT_QUANTITY_CONFLICT', 500], ['REPORT_QUANTITY_CONFLICT', 401], ['REPORT_QUANTITY_CONFLICT', 403], ['REPORT_QUANTITY_CONFLICT', 404], ['REPORT_QUANTITY_CONFLICT', 422]] as const) {
    expect(isDefiniteReportingRejection(new ApiError(code, '', '', status))).toBe(false)
  }
})
