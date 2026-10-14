import { describe, expect, it } from 'vitest'
import { completePath, nextNodes, validAllocation } from '../src/lib/production/batchPath'
import { saveBody, parseWorkOrderResponse, type Save } from '../src/api/production/workorder'
import type { RoutingDetail } from '../src/api/production/routing'
const graph = { nodes: ['A', 'B', 'C', 'D', 'E'].map((id, i) => ({ id: '900719925474099' + i, nodeCode: id })), edges: [['A', 'B'], ['B', 'C'], ['B', 'D'], ['C', 'E'], ['D', 'E']].map(([fromNodeCode, toNodeCode]) => ({ fromNodeCode, toNodeCode })) } as RoutingDetail
const ids = graph.nodes.map(n => n.id!)
it('submits only the explicit editable contract', () => {
  const input = { code: 'WO', productId: '9007199254740993', routingId: '5', plannedQty: '0.3', revision: 2, status: 'RELEASED',
    batches: [{ batchNo: '19001', plannedQty: '0.3', routeStatus: 'LOCKED' }] } as unknown as Save
  const body = saveBody(input)
  expect(body).not.toHaveProperty('status')
  expect(body.batches[0]).not.toHaveProperty('routeStatus')
  expect(body.productId).toBe('9007199254740993')
  expect(body.plannedQty).toBe('0.3')
})
describe('single batch path', () => {
  it('selects both valid branches without enumerating combinations', () => {
    expect(nextNodes(graph, []).map(n => n.nodeCode)).toEqual(['A'])
    expect(nextNodes(graph, ids.slice(0, 2)).map(n => n.nodeCode)).toEqual(['C', 'D'])
    expect(completePath(graph, [ids[0]!, ids[1]!, ids[2]!, ids[4]!])).toBe(true)
    expect(completePath(graph, [ids[0]!, ids[1]!, ids[3]!, ids[4]!])).toBe(true)
  })
  it('rejects skipped, incomplete, foreign and repeated nodes', () => {
    for (const path of [[ids[0]!, ids[2]!, ids[4]!], [ids[0]!], [ids[0]!, ids[1]!, ids[1]!, ids[4]!], ['foreign']]) expect(completePath(graph, path)).toBe(false)
  })
  it('keeps decimals exact for large quantities', () => {
    expect(validAllocation('99999999999999.999999', [{ plannedQty: '99999999999999.999998' }, { plannedQty: '0.000001' }])).toBe(true)
    expect(validAllocation('0.3', [{ plannedQty: '0.1' }, { plannedQty: '0.2' }])).toBe(true)
    expect(validAllocation('1', [{ plannedQty: '0.9999999' }])).toBe(false)
    expect(validAllocation('2', [{ plannedQty: '1' }])).toBe(false)
  })
})

it('decodes quantities exactly while keeping count and revision numeric', () => {
  const value = parseWorkOrderResponse('{"plannedQty":99999999999999.999999,"revision":3,"total":7,"remark":"quantity text: \\"plannedQty\\":123","batches":[{"plannedQty":0.000001}]}') as { plannedQty: string; revision: number; total: number; remark: string; batches: { plannedQty: string }[] }
  expect(value.plannedQty).toBe('99999999999999.999999')
  expect(value.batches[0]?.plannedQty).toBe('0.000001')
  expect(value.revision).toBe(3)
  expect(value.total).toBe(7)
  expect(value.remark).toBe('quantity text: "plannedQty":123')
})
