import { request } from '@/lib/request'
export interface ColumnPreference { key: string; visible: boolean }
export interface TablePreferenceResult { columns: ColumnPreference[] | null }
const path = '/api/factory/table-preferences'
export const tablePreferences = {
  get: (url: string, tableKey: string) => request<TablePreferenceResult>(path, { query: { url, tableKey }, scope: 'factory' }),
  save: (url: string, tableKey: string, columns: ColumnPreference[]) =>
    request<void>(path, { method: 'PUT', body: { url, tableKey, columns }, scope: 'factory' }),
  reset: (url: string, tableKey: string) => request<void>(path, { method: 'DELETE', query: { url, tableKey }, scope: 'factory' })
}
