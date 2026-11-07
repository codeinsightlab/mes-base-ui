import type { RoutingDetail, RoutingNode } from '@/api/production/routing'

// Follow only forced transitions. A fork (including multiple starts) requires an explicit choice.
export function inputPathCandidates(graph: RoutingDetail, selected: string[]): RoutingNode[] {
  const last = graph.nodes.find(node => node.id === selected.at(-1))
  if (selected.length && !last) return []
  return graph.nodes.filter(node => node.id && !selected.includes(node.id)
    && (last
      ? graph.edges.some(edge => edge.fromNodeCode === last.nodeCode && edge.toNodeCode === node.nodeCode)
      : !graph.edges.some(edge => edge.toNodeCode === node.nodeCode)))
}

export function extendInputPath(graph: RoutingDetail, selected: string[] = []): string[] {
  const path = [...selected]
  let candidates = inputPathCandidates(graph, path)
  while (candidates.length === 1) {
    path.push(candidates[0]!.id!)
    candidates = inputPathCandidates(graph, path)
  }
  return path
}

export function inputPathComplete(graph: RoutingDetail, selected: string[]): boolean {
  if (!selected.length || new Set(selected).size !== selected.length) return false
  if (!selected.every((id, index) => inputPathCandidates(graph, selected.slice(0, index)).some(node => node.id === id))) return false
  const last = graph.nodes.find(node => node.id === selected.at(-1))!
  return !graph.edges.some(edge => edge.fromNodeCode === last.nodeCode)
    && graph.nodes.filter(node => node.isKey).every(node => selected.includes(node.id!))
}
