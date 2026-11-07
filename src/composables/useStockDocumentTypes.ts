import { computed, ref } from 'vue'
import type { StockDocumentDirection } from '@/api/wm/stockDocuments'
import { getStockDocumentTypes, getStockDocumentTypesError } from '@/lib/stockDocumentTypes'

/** Reactive view of the common dictionary reader, without a second cache or request path. */
export function useStockDocumentTypes() {
  const directions = ref<StockDocumentDirection[]>([])
  const types = computed(() => directions.value.flatMap(getStockDocumentTypes))
  const error = computed(() => directions.value.map(getStockDocumentTypesError).filter(Boolean).join('；'))

  function clear() {
    directions.value = []
  }

  function load(value: StockDocumentDirection | StockDocumentDirection[]) {
    directions.value = Array.isArray(value) ? [...new Set(value)] : [value]
    directions.value.forEach(getStockDocumentTypes)
    return Promise.resolve()
  }

  function label(value: unknown) {
    return types.value.find(type => type.value === value)?.label || '类型待确认'
  }

  return { types, error, load, clear, label }
}
