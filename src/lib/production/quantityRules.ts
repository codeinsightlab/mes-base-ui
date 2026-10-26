import { api as materialApi } from '@/api/basic/material'
import { api as unitMeasureApi } from '@/api/basic/unitMeasure'
import { quantityInput } from './quantity'
import { quantityRuleRevision } from './quantityRuleInvalidation'

export interface QuantityRule {
  mustBeWholeNumber: boolean
  quantityPrecision: number
}

export const QUANTITY_RULE_TTL_MS = 60_000
const ruleCache = new Map<string, { expiresAt: number; request: Promise<QuantityRule> }>()
let cacheRevision = -1

export function loadQuantityRule(materialId: string, factoryId: string, revision: number): Promise<QuantityRule> {
  if (cacheRevision !== quantityRuleRevision.value) {
    ruleCache.clear()
    cacheRevision = quantityRuleRevision.value
  }
  const now = Date.now()
  for (const [key, entry] of ruleCache) if (entry.expiresAt <= now) ruleCache.delete(key)
  const key = JSON.stringify([factoryId, revision, materialId])
  const existing = ruleCache.get(key)
  if (existing) return existing.request
  const request = (async () => {
    const material = await materialApi.detail(materialId)
    if (typeof material.unitId !== 'string' || !material.unitId) throw new Error('物料未配置有效的计量单位')
    const unit = await unitMeasureApi.detail(material.unitId)
    const precision = unit.quantityPrecision
    const whole = unit.mustBeWholeNumber
    if (!Number.isInteger(precision) || precision < 0 || precision > 6 || (whole !== 0 && whole !== 1)) {
      throw new Error('计量单位数量精度配置无效')
    }
    return { mustBeWholeNumber: whole === 1, quantityPrecision: precision }
  })()
  if (ruleCache.size >= 256) ruleCache.delete(ruleCache.keys().next().value!)
  const entry = { expiresAt: now + QUANTITY_RULE_TTL_MS, request }
  ruleCache.set(key, entry)
  void request.catch(() => { if (ruleCache.get(key) === entry) ruleCache.delete(key) })
  return request
}

export function quantityInputError(value: string, rule: QuantityRule | null): string | null {
  if (!rule) return '正在读取物料单位规则，请稍候'
  if (!/^-?\d{1,14}(?:\.\d*)?$/.test(value)) return '请输入有效的十进制数量'
  const fraction = quantityInput(value).split('.')[1] ?? ''
  if (fraction.length > 6) return '数量最多支持六位小数'
  if (rule.mustBeWholeNumber && /[1-9]/.test(fraction)) return '该计量单位只允许整数数量'
  if (fraction.length > rule.quantityPrecision && /[1-9]/.test(fraction.slice(rule.quantityPrecision))) {
    return `该计量单位最多允许${rule.quantityPrecision}位小数`
  }
  return null
}

export { quantityInput as normalizedQuantityInput } from './quantity'

export function positiveQuantity(value: string): boolean {
  if (!/^\d{1,14}(?:\.\d+)?$/.test(value)) return false
  const [integer = '0', fraction = ''] = value.split('.')
  return BigInt(integer + fraction) > 0n
}
