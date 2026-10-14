import type { RoutingNode, RoutingEdge } from '@/api/production/routing'

export function contentError(materialIds: string[], nodes: RoutingNode[], edges: RoutingEdge[], publishing = false): string {
  if (materialIds.length > 100 || nodes.length > 100 || edges.length > 400) return '最多 100 个产品、100 个节点和 400 条连接'
  if (new Set(materialIds).size !== materialIds.length) return '物料产品不能重复'
  if (nodes.some(node => !/^[A-Za-z0-9_-]{1,64}$/.test(node.nodeCode))) return '节点编码须为字母、数字、下划线或短横线'
  if (new Set(nodes.map(node => node.nodeCode)).size !== nodes.length) return '节点编码不能重复'
  if (nodes.some(node => !node.operationId)) return '请选择每个节点的工序'
  if (nodes.some(node => !Number.isInteger(node.displayOrder) || node.displayOrder < 0)) return '显示排序须为非负整数'
  if (nodes.filter(node => node.isKey).length > 1) return '最多设置一个关键工序'
  const incoming = new Map(nodes.map(node => [node.nodeCode, 0])), outgoing = new Map(nodes.map(node => [node.nodeCode, [] as string[]]))
  const unique = new Set<string>()
  for (const edge of edges) {
    if (!incoming.has(edge.fromNodeCode) || !incoming.has(edge.toNodeCode)) return '连接两端必须是当前路线的节点'
    if (edge.fromNodeCode === edge.toNodeCode) return '节点不能连接自身'
    const pair = JSON.stringify([edge.fromNodeCode, edge.toNodeCode])
    if (unique.has(pair)) return '不能重复添加相同连接'
    unique.add(pair); outgoing.get(edge.fromNodeCode)!.push(edge.toNodeCode); incoming.set(edge.toNodeCode, incoming.get(edge.toNodeCode)! + 1)
  }
  if (publishing && (!nodes.length || !materialIds.length)) return '发布至少需要一个产品和一个节点'
  if (publishing && nodes.length > 1 && nodes.some(node => !incoming.get(node.nodeCode) && !outgoing.get(node.nodeCode)!.length)) return '发布前请连接所有孤立节点'
  const queue = [...incoming].filter(([, count]) => count === 0).map(([code]) => code)
  let visited = 0
  for (let i = 0; i < queue.length; i++) {
    visited++
    for (const target of outgoing.get(queue[i]!)!) {
      const count = incoming.get(target)! - 1; incoming.set(target, count)
      if (!count) queue.push(target)
    }
  }
  return visited === nodes.length ? '' : '连接形成了环路，请移除回连'
}

export function graphLayout(nodes: RoutingNode[], edges: RoutingEdge[]) {
  const ordered = [...nodes].sort((a, b) => a.displayOrder - b.displayOrder || a.nodeCode.localeCompare(b.nodeCode))
  const incoming = new Map(nodes.map(node => [node.nodeCode, 0])), outgoing = new Map(nodes.map(node => [node.nodeCode, [] as string[]]))
  const depths = new Map(nodes.map(node => [node.nodeCode, 0]))
  for (const edge of edges) {
    if (!incoming.has(edge.fromNodeCode) || !incoming.has(edge.toNodeCode)) continue
    outgoing.get(edge.fromNodeCode)!.push(edge.toNodeCode); incoming.set(edge.toNodeCode, incoming.get(edge.toNodeCode)! + 1)
  }
  const queue = ordered.filter(node => incoming.get(node.nodeCode) === 0).map(node => node.nodeCode)
  for (let i = 0; i < queue.length; i++) {
    for (const target of outgoing.get(queue[i]!)!) {
      depths.set(target, Math.max(depths.get(target)!, depths.get(queue[i]!)! + 1))
      incoming.set(target, incoming.get(target)! - 1)
      if (incoming.get(target) === 0) queue.push(target)
    }
  }
  const levels = new Map<number, RoutingNode[]>()
  for (const node of ordered) { const depth = depths.get(node.nodeCode)!; levels.set(depth, [...(levels.get(depth) ?? []), node]) }
  const height = Math.max(130, ...[...levels.values()].map(level => level.length * 96 + 34))
  const positioned = ordered.map(node => {
    const depth = depths.get(node.nodeCode)!, level = levels.get(depth)!
    return { ...node, x: 24 + depth * 210, y: (height - level.length * 96) / 2 + level.indexOf(node) * 96 + 16 }
  })
  return { nodes: positioned, width: Math.max(230, ...positioned.map(node => node.x + 185)), height }
}
