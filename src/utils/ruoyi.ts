import { formatDateTime } from '@/lib/dateTime'

export function parseStrEmpty(value:unknown) {
  return value == null ? '' : String(value)
}
export function parseTime(value:unknown) {
  return formatDateTime(value)
}
export function handleTree<T extends Record<string, any>>(data:T[], id = 'id', parentId = 'parentId', children = 'children'):T[] {
  const rows = data.map(item => ({ ...item, [children]: [] as T[] }))
  const index = new Map(rows.map(item => [String(item[id]), item]))
  const roots:T[] = []
  for (const item of rows) {
    const parent = index.get(String(item[parentId]))
    if (parent && parent !== item)(parent[children] as T[]).push(item as T)
    else roots.push(item as T)
  }
  return roots
}
export function addDateRange(query:Record<string, any>, range:string[]) {
  const result = { ...query, params: { ...query.params }}
  if (range?.length === 2) {
    result.params.beginTime = range[0]
    result.params.endTime = range[1]
  } else {
    delete result.params.beginTime
    delete result.params.endTime
  }
  return result
}
