import { describe, expect, it } from 'vitest'
import { extendInputPath, inputPathComplete } from '../src/lib/production/inputRoutingPath'
import type { RoutingDetail } from '../src/api/production/routing'

function graph(codes: string[], edges: [string, string][], key?: string): RoutingDetail {
  return {
    routing: { id: '1', code: 'R', name: '加工', version: 1, status: 'PUBLISHED', description: null, externalId: null, sourceVersion: null, revision: 1, publishedAt: null }, products: [],
    nodes: codes.map((code, displayOrder) => ({ id: code, nodeCode: code, operationId: code, operationName: code, displayOrder, isKey: code === key, description: null })),
    edges: edges.map(([fromNodeCode, toNodeCode]) => ({ fromNodeCode, toNodeCode }))
  }
}

describe('production input path defaults', () => {
  it('follows a unique full chain regardless of display order', () => {
    const definition = graph(['C', 'A', 'B'], [['A', 'B'], ['B', 'C']])
    expect(extendInputPath(definition)).toEqual(['A', 'B', 'C'])
    expect(inputPathComplete(definition, ['A', 'B', 'C'])).toBe(true)
  })
  it('requires a choice for multiple starts and for every later fork', () => {
    const definition = graph(['A', 'B', 'C', 'D', 'E', 'F'], [['A', 'C'], ['B', 'C'], ['C', 'D'], ['C', 'E'], ['E', 'F']])
    expect(extendInputPath(definition)).toEqual([])
    expect(extendInputPath(definition, ['A'])).toEqual(['A', 'C'])
    expect(extendInputPath(definition, ['A', 'C', 'E'])).toEqual(['A', 'C', 'E', 'F'])
  })
  it('does not consider a branch complete when it skips the required key node', () => {
    const definition = graph(['A', 'B', 'C', 'D'], [['A', 'B'], ['A', 'C'], ['B', 'D'], ['C', 'D']], 'B')
    expect(inputPathComplete(definition, ['A', 'C', 'D'])).toBe(false)
    expect(inputPathComplete(definition, ['A', 'B', 'D'])).toBe(true)
  })
  it('rejects disconnected paths and terminates safely for malformed cyclic graphs', () => {
    const definition = graph(['A', 'B', 'C'], [['A', 'B'], ['B', 'C'], ['C', 'B']])
    expect(extendInputPath(definition)).toEqual(['A', 'B', 'C'])
    expect(inputPathComplete(definition, ['A', 'B', 'C'])).toBe(false)
    expect(inputPathComplete(definition, ['A', 'C'])).toBe(false)
    expect(inputPathComplete(graph([], []), [])).toBe(false)
  })
})
