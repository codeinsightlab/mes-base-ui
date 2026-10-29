// TEST ONLY: real workspace/CrudPage interaction with mocked transport.
import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import Workspace from '../src/views/basic/materials/index.vue'
import { useAuth } from '../src/stores/auth'
const calls = vi.hoisted(() => ({ list: vi.fn().mockResolvedValue({ items: [], total: 0, offset: 0, limit: 20 }) }))
vi.mock('../src/api/basic/material', () => ({ api: { list: calls.list }, sync: vi.fn() }))
vi.mock('../src/api/basic/materialCategory', () => ({ tree: async() => ({ items: [{ id: '10', name: '父分类', parentId: null }, { id: '11', name: '子分类', parentId: '10' }] }) }))
vi.mock('../src/api/basic/unitMeasure', () => ({ api: { list: async() => ({ items: [], total: 0 }) }}))
let w: ReturnType<typeof mount>
afterEach(() => { w?.unmount(); vi.unstubAllGlobals() })
it('keeps tree highlight and category requests mutually exclusive and preserves text filters', async() => {
  vi.stubGlobal('ResizeObserver', class {observe() {}unobserve() {}disconnect() {}})
  const pinia = createPinia(), auth = useAuth(pinia)
  auth.factoryId = 'F1';auth.factoryPermissions = ['business:material:list', 'business:material:category:list']
  w = mount(Workspace, { global: { plugins: [pinia, ElementPlus], stubs: { RouterLink: true, MaterialBomPanel: true }}});await flushPromises()
  await w.get('input[placeholder="请输入物料编码"]').setValue('KEEP')
  await w.findAll('.el-tree-node__label').find(n => n.text() === '子分类')!.trigger('click');await flushPromises()
  expect(calls.list.mock.lastCall?.[0]).toMatchObject({ categoryId: '11', includeDescendants: 'true', code: 'KEEP', offset: 0 })
  expect(w.findAll('.el-tree-node.is-current')).toHaveLength(1)
  await w.findAll('button').find(b => b.text() === '未分类')!.trigger('click');await flushPromises()
  expect(w.findAll('.el-tree-node.is-current')).toHaveLength(0)
  expect(calls.list.mock.lastCall?.[0]).toMatchObject({ uncategorized: 'true', code: 'KEEP', offset: 0 })
  expect(calls.list.mock.lastCall?.[0]).not.toHaveProperty('categoryId')
  await w.findAll('button').find(b => b.text() === '全部物料')!.trigger('click');await flushPromises()
  expect(w.findAll('.el-tree-node.is-current')).toHaveLength(0)
  expect(calls.list.mock.lastCall?.[0]).not.toHaveProperty('uncategorized')
  expect(calls.list.mock.lastCall?.[0]).toMatchObject({ code: 'KEEP', offset: 0 })
})
