import { describe, expect, it } from 'vitest'
import { contentError, graphLayout } from '../src/lib/production/routingGraph'
import type { RoutingNode, RoutingEdge } from '../src/api/production/routing'
const nodes: RoutingNode[] = ['N10', 'N20', 'N30A', 'N30B', 'N40'].map((nodeCode, i) => ({ nodeCode, operationId: '9007199254740993', displayOrder: 5 - i, isKey: false, description: null }))
const edges: RoutingEdge[] = [['N10', 'N20'], ['N20', 'N30A'], ['N20', 'N30B'], ['N30A', 'N40'], ['N30B', 'N40']].map(([fromNodeCode, toNodeCode]) => ({ fromNodeCode: fromNodeCode!, toNodeCode: toNodeCode! }))
describe('routing definition graph', () => {
  it('supports linear, branch and merge with repeated operation and bigint identities', () => {
    expect(contentError(['product'], nodes.slice(0, 3), edges.slice(0, 2), true)).toBe('')
    expect(contentError(['product'], nodes.slice(0, 4), edges.slice(0, 3), true)).toBe('')
    expect(contentError(['product'], nodes, edges, true)).toBe('')
    expect(nodes[0]?.operationId).toBe('9007199254740993')
  })
  it('lays out dependencies by edges and preserves branch separation despite reversed display order', () => {
    const layout = graphLayout(nodes, edges), index = new Map(layout.nodes.map(node => [node.nodeCode, node]))
    for (const edge of edges) expect(index.get(edge.fromNodeCode)!.x).toBeLessThan(index.get(edge.toNodeCode)!.x)
    expect(index.get('N30A')!.x).toBe(index.get('N30B')!.x)
    expect(index.get('N30A')!.y).not.toBe(index.get('N30B')!.y)
  })
  it('rejects self loops, duplicate connections, cycles and foreign endpoints', () => {
    expect(contentError([], nodes, [{ fromNodeCode: 'N10', toNodeCode: 'N10' }])).toContain('自身')
    expect(contentError([], nodes, [...edges, edges[0]!])).toContain('重复')
    expect(contentError([], nodes, [...edges, { fromNodeCode: 'N40', toNodeCode: 'N10' }])).toContain('环路')
    expect(contentError([], nodes, [{ fromNodeCode: 'N10', toNodeCode: 'foreign' }])).toContain('当前路线')
  })
  it('allows isolated drafts and single nodes, but rejects isolated nodes on publish', () => {
    expect(contentError([], nodes, [])).toBe('')
    expect(contentError(['p'], nodes, [], true)).toContain('孤立')
    expect(contentError(['p'], nodes.slice(0, 1), [], true)).toBe('')
  })
  it('retains product/key boundaries and rejects duplicate node codes', () => {
    expect(contentError(['p', 'p'], nodes, edges)).toContain('不能重复')
    expect(contentError(['p'], [nodes[0]!, nodes[0]!], [])).toContain('节点编码不能重复')
    expect(contentError(['p'], nodes.map(node => ({ ...node, isKey: true })), edges)).toContain('一个关键工序')
  })
})
