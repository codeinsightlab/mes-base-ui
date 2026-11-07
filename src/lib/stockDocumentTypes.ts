import type { StockDocumentDirection } from '@/api/wm/stockDocuments'
import { dictionary, dictionaryState } from '@/utils/dictionaries'

export const stockDocumentTypeDictionary = (direction: StockDocumentDirection) =>
  direction === 'IN' ? 'stock_document_in_type' : 'stock_document_out_type'

/** All frontend consumers read document types here; labels and order belong to the dictionary. */
export function getStockDocumentTypes(direction: StockDocumentDirection) {
  return dictionary(stockDocumentTypeDictionary(direction)).map(option => ({ ...option, direction }))
}
export function getStockDocumentTypesError(direction: StockDocumentDirection) {
  return dictionaryState.errors[stockDocumentTypeDictionary(direction)] || ''
}
