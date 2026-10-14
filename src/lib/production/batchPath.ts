import type { RoutingDetail, RoutingNode } from '@/api/production/routing'
export function nextNodes(graph: RoutingDetail, selected: string[]): RoutingNode[] {
  if (!selected.length) return graph.nodes.filter(n => !graph.edges.some(e => e.toNodeCode === n.nodeCode))
  const last = graph.nodes.find(n => n.id === selected.at(-1))
  return graph.nodes.filter(n => !!n.id && !selected.includes(n.id) && graph.edges.some(e => e.fromNodeCode === last?.nodeCode && e.toNodeCode === n.nodeCode))
}
export function completePath(graph: RoutingDetail, selected: string[]): boolean {
  if (!selected.length || selected.length > 100 || new Set(selected).size !== selected.length) return false
  for (let i = 0; i < selected.length; i++) if (!nextNodes(graph, selected.slice(0, i)).some(n => n.id === selected[i])) return false
  return !nextNodes(graph, selected).length
}
export function exactQuantity(value: string): bigint | null {
  if (!/^\d{1,14}(\.\d{1,6})?$/.test(value)) return null
  const [integer, fraction = ''] = value.split('.')
  const scaled = BigInt(integer!) * 1000000n + BigInt(fraction.padEnd(6, '0'))
  return scaled > 0n ? scaled : null
}
export function validAllocation(planned: string, batches: { plannedQty: string }[]): boolean {
  const target = exactQuantity(planned), amounts = batches.map(b => exactQuantity(b.plannedQty))
  return target !== null && batches.length > 0 && batches.length <= 100 && amounts.every(q => q !== null)
    && amounts.reduce<bigint>((sum, q) => sum + (q ?? 0n), 0n) === target
}
