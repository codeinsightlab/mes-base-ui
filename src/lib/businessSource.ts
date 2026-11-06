/** Display labels only. Persisted sources and business admission rules remain server-owned. */
export function businessSourceLabel(source?: string | null): string {
  if (source === 'LOCAL') return '本地'
  if (source === 'EXTERNAL') return '外部ERP'
  if (!source) return '来源待核实'
  return source
}
