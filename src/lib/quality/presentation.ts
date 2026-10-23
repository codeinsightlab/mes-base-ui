export const qualityStateLabel = (state: string) => ({UNRESOLVED:'处置待确认',UNVERIFIED:'待核实',OVERLAP:'重复申报',PENDING:'待处理',RETURNED:'历史已返回',TRANSFERRED:'已转仓',DISPOSED:'已处理',VOIDED:'已作废'}[state] ?? '状态待确认')
export const qualityReceiptLabel = (state: string | null | undefined) => ({PENDING:'待入仓',PARTIAL:'部分入仓',RECEIVED:'已入仓'}[state ?? ''] ?? '入仓状态待确认')
export const qualityStateTone = (state: string): 'warning' | 'success' | 'info' => ['UNRESOLVED','UNVERIFIED','PENDING'].includes(state) ? 'warning' : ['RETURNED','TRANSFERRED','DISPOSED'].includes(state) ? 'success' : 'info'
export function positiveQuantity(value: string | null | undefined): boolean {
  return !!value && /^\d+(?:\.\d+)?$/.test(value) && /[1-9]/.test(value)
}
export function exceedsQuantity(value: string, balance: string): boolean {
  const scale = Math.max(value.split('.')[1]?.length ?? 0, balance.split('.')[1]?.length ?? 0)
  const units = (v: string) => { const [whole, fraction=''] = v.split('.'); return BigInt(whole!) * 10n ** BigInt(scale) + BigInt(fraction.padEnd(scale,'0') || '0') }
  return units(value) > units(balance)
}
