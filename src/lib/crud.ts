export interface Row { [key: string]: unknown }
export interface Page { items: Row[]; total: number; offset: number; limit: number }
export interface CrudApi { list(query: Record<string, string | number>): Promise<Page>; detail?(id:string):Promise<Row>; create(body:unknown):Promise<Row>; update(id:string, body:unknown):Promise<Row>; remove(id:string):Promise<void> }
export interface Field { key: string; label: string; kind: 'text' | 'number' | 'decimal' | 'datetime' | 'date' | 'boolean' | 'select' | 'textarea' | 'password'; readonly?: boolean; required?: boolean; maxLength?: number; options?: { label: string;value: string | number;tone?: 'success' | 'info' | 'warning' | 'danger' }[]; showWhen?: { key: string;value: string }; hidden?: boolean }
export function formatValue(value: unknown, kind: Field['kind']) {
  if (value === null || value === undefined || value === '') return '—'
  if (kind === 'datetime') return String(value).replace('T', ' ')
  if (kind === 'decimal') { const [integer, fraction] = String(value).split('.'); return integer!.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction === undefined ? '' : '.' + fraction) }
  if (kind === 'boolean') return value ? '是' : '否'
  return String(value)
}
export function commandFromDraft(fields:Field[], draft:Row, editing:boolean, idKey:string):Row {
  const result:Row = {}
  for (const field of fields) {
    if (field.readonly || editing && field.key === idKey || field.showWhen && draft[field.showWhen.key] !== field.showWhen.value) continue
    const value = draft[field.key]
    result[field.key] = value === '' || value === undefined ? null : field.kind === 'number' ? Number(value) : value
  }
  return result
}
