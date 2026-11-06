import { it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { createPinia } from 'pinia'
import BomTreeEditor from '../src/components/business/material/BomTreeEditor.vue'
const { request } = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('../src/lib/request', async(importOriginal) => ({ ...await importOriginal<typeof import('../src/lib/request')>(), request }))
it('does not create a root while editing or previewing; confirm sends the previewed plan', async() => {
  const w = mount(BomTreeEditor, { props: { material: { id: '88', code: 'M', name: '根' }}, global: { plugins: [ElementPlus, createPinia()], stubs: { MaterialPicker: true, QuantityInput: true }}})
  await flushPromises()
  expect(request).not.toHaveBeenCalled()
  request.mockResolvedValueOnce({ hash: 'reviewed', changes: [] })
  await w.findAll('button').find(b => b.text().includes('预览整阶变更'))!.trigger('click')
  await flushPromises()
  const [, options] = request.mock.calls[0]
  expect(options.body.nodes[0]).toMatchObject({ source: null, product: '88' })
  request.mockRejectedValueOnce(new Error('连接中断'))
  await w.findAll('button').find(b => b.text().includes('确认保存'))!.trigger('click')
  await flushPromises()
  expect(w.text()).toContain('连接中断')
  await w.findAll('button').find(b => b.text().includes('确认保存'))!.trigger('click')
  await flushPromises()
  expect(request.mock.calls[1][1].body).toMatchObject({ hash: 'reviewed', plan: options.body })
  expect(request.mock.calls[2][1].body.requestId).toBe(request.mock.calls[1][1].body.requestId)
  w.unmount()
})

it('isolates the chosen occurrence of a shared subassembly without creating records', async() => {
  request.mockReset()
  const node = (key:string, product:string, lines:unknown[]) => ({ key, product, source: key, revision: '7', version: 'V1', code: 'B' + key, base: '1', remark: null, lines })
  const line = (material:string, child:string) => ({ material, child, quantity: '1', sort: 0 })
  const initial = { root: '10', nodes: [node('10', '1', [line('2', '20'), line('3', '30')]), node('20', '2', [line('3', '30')]), node('30', '3', [])] }
  request.mockResolvedValueOnce({ plan: initial, materials: { '1': '根件', '2': '中间件', '3': '共享件' }, statuses: { '10': 'PUBLISHED', '20': 'PUBLISHED', '30': 'PUBLISHED' }})
  const w = mount(BomTreeEditor, { props: { source: '10', material: { id: '1' }}, global: { plugins: [ElementPlus, createPinia()], stubs: { MaterialPicker: true, QuantityInput: true }}})
  await flushPromises()
  const occurrences = w.findAll('nav button').filter(b => b.text().includes('共享件'))
  expect(occurrences).toHaveLength(2)
  await occurrences[1].trigger('click')
  await w.findAll('button').find(b => b.text().includes('仅此路径'))!.trigger('click')
  expect(w.get('[role="status"]').text()).toContain('当前节点已在此路径独立')
  expect(w.findAll('button').find(b => b.text() === '已独立修订')!.attributes('disabled')).toBeDefined()
  expect(w.findAll('nav button').filter(b => b.text().includes('当前路径独立'))).toHaveLength(1)
  expect(request).toHaveBeenCalledTimes(1)
  await w.find('main label:nth-of-type(2) input').setValue('V-special')
  request.mockResolvedValueOnce({ hash: 'diff', changes: [] })
  await w.findAll('button').find(b => b.text().includes('预览整阶'))!.trigger('click')
  await flushPromises()
  const proposed = request.mock.calls[1][1].body
  expect(proposed.nodes).toHaveLength(4)
  const fork = proposed.nodes.find((n:{ version: string }) => n.version === 'V-special')
  expect(fork).toMatchObject({ source: '30', revision: '7' })
  expect(proposed.nodes[0].lines[1].child).toBe(fork.key)
  expect(proposed.nodes.find((n:{ key: string }) => n.key === '20').lines[0].child).toBe('30')
  expect(request.mock.calls.map(c => c[0])).toEqual(['/api/basic/material-bom/tree/10', '/api/basic/material-bom/tree/preview'])
  w.unmount()
})
