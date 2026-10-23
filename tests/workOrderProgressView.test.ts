import { flushPromises, mount } from '@vue/test-utils'
import { computed, inject, provide, reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import WorkOrderProgress from '../src/components/WorkOrderProgress.vue'
import type { WorkOrderProgressPage, WorkOrderProgressQuery } from '../src/api/production/workOrderProgress'

const fixture = vi.hoisted(() => ({ auth: null as any, fetch: vi.fn() }))
vi.mock('../src/stores/auth', () => ({ useAuth: () => fixture.auth }))
vi.mock('../src/api/production/workOrderProgress', () => ({
  loadWorkOrderProgress: (query: WorkOrderProgressQuery) => fixture.fetch(query)
}))
const first: WorkOrderProgressPage = {
  items: [{ id: '1', code: 'TEST_ONLY_FIRST' } as WorkOrderProgressPage['items'][number]],
  total: 12, offset: 0, limit: 5
}
const global = {
  directives: { loading: {} },
  stubs: {
    'el-form': { template: '<form><slot /></form>' },
    'el-form-item': { template: '<div><slot /></div>' },
    'el-input': true, 'el-select': true, 'el-option': true,
    'el-button': { template: '<button><slot /></button>' },
    'el-table': { props: ['data'], template: '<div data-testid="progress-table"><span v-for="row in data" :key="row.id">{{ row.code }}</span><slot /></div>' },
    'el-table-column': true,
    Pagination: { props: ['total', 'page'], emits: ['update:page', 'pagination'], template: '<div data-testid="pager"><span>{{ total }}</span><button @click="$emit(\'update:page\', page + 1); $emit(\'pagination\')">下一页</button></div>' }
  }
}
beforeEach(() => {
  fixture.auth = reactive({ factoryId: 'A', revision: 1, granted: true, hasPermission() { return this.granted } })
  fixture.fetch.mockReset().mockResolvedValue(first)
})
describe('workorder progress refresh keeps the table mounted', () => {
  it('keeps table, rows and pager during paging/search loading and replaces rows after success', async() => {
    const wrapper = mount(WorkOrderProgress, { global })
    await flushPromises()
    const table = wrapper.get('[data-testid="progress-table"]').element
    const pager = wrapper.get('[data-testid="pager"]').element
    let finish!: (value: WorkOrderProgressPage) => void
    fixture.fetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    await wrapper.get('[data-testid="pager"] button').trigger('click')
    expect(wrapper.get('[data-testid="progress-table"]').element).toBe(table)
    expect(wrapper.get('[data-testid="pager"]').element).toBe(pager)
    expect(wrapper.get('[aria-busy="true"]').text()).toContain('TEST_ONLY_FIRST')
    expect(wrapper.get('[data-testid="pager"]').text()).toContain('12')
    expect(wrapper.text()).not.toContain('正在读取…')
    finish({ ...first, offset: 5, items: [{ ...first.items[0]!, id: '2', code: 'TEST_ONLY_NEXT' }] })
    await flushPromises()
    expect(wrapper.get('[data-testid="progress-table"]').element).toBe(table)
    expect(wrapper.text()).toContain('TEST_ONLY_NEXT')
    expect(wrapper.text()).not.toContain('TEST_ONLY_FIRST')
    fixture.fetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('[data-testid="progress-table"]').element).toBe(table)
    expect(wrapper.get('[aria-busy="true"]').attributes('aria-busy')).toBe('true')
    expect(fixture.fetch).toHaveBeenLastCalledWith({ workorderCode: '', productCode: '', status: '', offset: 0, limit: 5 })
    fixture.auth.granted = false
    await flushPromises()
    expect(wrapper.find('[data-testid="progress-table"]').exists()).toBe(false)
    finish(first); await flushPromises()
    expect(wrapper.text()).not.toContain('TEST_ONLY_FIRST')
    expect(wrapper.text()).toContain('当前账号无此数据读取权限')
    wrapper.unmount()
  })
})


describe('workorder progress distinguishes quality outcomes', () => {
  it('shows transfers, untreated declarations and returned-to-node quantities separately', async() => {
    fixture.fetch.mockResolvedValue({ ...first, items: [{
      ...first.items[0], plannedQty: '100', completedQty: '90', goodOutputGapQty: '10',
      qualityTransferredQty: '6', pendingCompletionQty: '10', qualityUntreatedQty: '1',
      qualityReturnedQty: '2', qualityUnverifiedQty: '5',
      completionPercent: '90.00', status: 'RELEASED', source: 'LOCAL', createTime: '2026-10-01T09:30:45'
    }] })
    const wrapper = mount(WorkOrderProgress, { global: {
      ...global,
      stubs: {
        ...global.stubs,
        'el-table': {
          props: ['data'],
          setup(props: any) { provide('progress-test-rows', computed(() => props.data)) },
          template: '<div><slot /></div>'
        },
        'el-table-column': {
          props: ['label'],
          setup() { return { rows: inject('progress-test-rows') } },
          template: '<section :aria-label="label"><slot v-for="row in rows" :row="row" /></section>'
        },
        CodeText: true, StatusTag: true, MetricValue: true, RouterLink: true, 'el-progress': true
      }
    } })
    await flushPromises()
    expect(wrapper.find('[aria-label="已确认报废"]').exists()).toBe(false)
    expect(wrapper.get('[aria-label="工单创建时间"]').text()).toBe('2026-10-01 09:30:45')
    expect(wrapper.get('[aria-label="不良入仓进度"]').text()).toContain('未处理：1')
    expect(wrapper.get('[aria-label="不良入仓进度"]').text()).toContain('历史已返回：2')
    expect(wrapper.get('[aria-label="不良入仓进度"]').text()).toContain('未处理（待核实申报）：5')
    expect(wrapper.get('[aria-label="待收尾差额"]').text()).toContain('10')
    expect(wrapper.get('[aria-label="待收尾差额"]').text()).toContain('合格品缺口：10')
    expect(wrapper.text()).toContain('不良入仓不再重复计入')
    wrapper.unmount()
  })
})
