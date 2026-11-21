import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import { mount, flushPromises } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import PeopleAnalytics from '../src/components/business/analytics/PeopleAnalytics.vue'
import { useAuth } from '../src/stores/auth'
import { access, readAnalytics } from '../src/api/production/analytics'
vi.mock('../src/api/production/analytics', async original => ({
  ...await original<typeof import('../src/api/production/analytics')>(), readAnalytics: vi.fn()
}))
it('人员与工序单元格和趋势日共用明细范围，作废审计不改汇总范围', async() => {
  const who = '9007199254740993'
  const pinia = createPinia()
  useAuth(pinia).$patch({ factoryId: 'A', factoryPermissions: [access.menu, access.report] })
  const page = { items: [{ person: who, reports: 1, operations: 1, orders: 1 }], total: 1, limit: 20, offset: 0 }
  vi.mocked(readAnalytics).mockImplementation(async key => {
    if (key === 'people') return { page, names: { [who]: '操作人甲' }, cells: [{ person: who, operation: '31', name: '剪切', reports: 1, quantity: '1.500000', unit: 'kg' }] }
    if (key === 'people-summary') return { reports: 1, people: 1, operations: 1, orders: 1 }
    if (key === 'people-days') return [{ key: '2026-10-01', count: 1 }]
    return { page: { ...page, items: [] }, names: {} as Record<string, string> }
  })
  const w = mount(PeopleAnalytics, { props: { start: '2026-10-01', end: '2026-10-02', valid: true, product: '7', order: '9' }, global: { plugins: [pinia, ElementPlus], stubs: { FactChart: { template: '<button @click="$emit(\'select\',\'2026-10-01\')">选择日期</button>' }, PageDialog: true }}})
  try {
    await flushPromises()
    await w.findAll('button').find(b => b.text() === '1 笔')!.trigger('click')
    await w.findAll('button').find(b => b.text() === '选择日期')!.trigger('click')
    await flushPromises()
    const calls = vi.mocked(readAnalytics).mock.calls
    const detail = () => calls.filter(c => c[0] === 'person-reports').at(-1)![1]
    expect(detail()).toMatchObject({ start: '2026-10-01', end: '2026-10-01', product: '7', order: '9', person: who, operation: '31', voided: 'false' })
    await w.findAll('input[type=radio]')[1].setValue()
    expect(detail().voided).toBe('true')
    expect(calls.filter(c => c[0] === 'people-summary').at(-1)![1]).toMatchObject({ end: '2026-10-02', person: who, operation: '31' })
  } finally {
    w.unmount()
  }
})
