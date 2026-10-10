import { reactive } from 'vue';import { request } from '@/lib/request'
export interface DictionaryOption { label: string;value: string;raw: { dictLabel: string;dictValue: string;cssClass?: string;listClass?: string;isDefault?: string }}
export const dictionaryState = reactive({ types: {} as Record<string, DictionaryOption[]>, errors: {} as Record<string, string> })
const loaded = new Set<string>(), pending = new Map<string, Promise<void>>();let epoch = 0
export function dictionary(code:string):DictionaryOption[] {
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,99}$/.test(code)) return []
  dictionaryState.types[code] ??= [];if (!loaded.has(code)) void load(code);return dictionaryState.types[code]
}
async function load(code:string):Promise<void> {
  if (pending.has(code)) return pending.get(code)
  const version = epoch
  const work = (async() => {
    try {
      const response = await request<{ data: DictionaryOption['raw'][] }>('/api/common/dict/' + encodeURIComponent(code), { scope: 'platform' });if (version !== epoch) return
      dictionaryState.types[code].splice(0, Infinity, ...response.data.map(raw => ({ label: raw.dictLabel, value: raw.dictValue, raw })));loaded.add(code);delete dictionaryState.errors[code]
    } catch(error) { if (version === epoch)dictionaryState.errors[code] = error instanceof Error ? error.message : '字典加载失败' } finally { if (version === epoch)pending.delete(code) }
  })()
  pending.set(code, work);return work
}
export function clearDictionaries() { epoch++;pending.clear();loaded.clear();for (const values of Object.values(dictionaryState.types))values.splice(0);for (const code of Object.keys(dictionaryState.errors)) delete dictionaryState.errors[code] }
export async function refreshDictionaries() { clearDictionaries();await Promise.all(Object.keys(dictionaryState.types).map(load)) }
