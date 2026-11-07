import { readonly, shallowRef } from 'vue'
import { getConfigKey } from '@/api/system/config'

export const SEARCH_OPTION_LIMIT_KEY = 'sys.ui.searchSelect.limit'
const limit = shallowRef<number | null>(null)
export const searchOptionLimit = readonly(limit)
let pending: Promise<number> | undefined

// Coalesce concurrent selectors, but read again on the next search so a system
// parameter edit takes effect without reloading the page or rebuilding the app.
export function loadSearchOptionLimit(): Promise<number> {
  if (pending) return pending
  pending = getConfigKey(SEARCH_OPTION_LIMIT_KEY).then((response: { data?: unknown }) => {
    const value = String(response.data ?? '')
    if (!/^[1-9][0-9]{0,2}$/.test(value) || Number(value) > 100) {
      throw new Error('检索选择框候选数量未配置或无效，请在系统参数中设置1到100之间的整数')
    }
    limit.value = Number(value)
    return limit.value
  }).finally(() => {
    pending = undefined
  })
  return pending
}
