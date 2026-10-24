import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { reactive, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BusinessWorkspace from '../src/components/BusinessWorkspace.vue'

const fixture = vi.hoisted(() => ({ state: null as any }))
vi.mock('../src/composables/useBusinessWorkspace', () => ({ useBusinessWorkspace: () => fixture.state }))
const global = { stubs: {
  WorkOrderProgress: true,
  'el-tabs': { template: '<div><slot /></div>' },
  'el-tab-pane': { props: ['label'], template: '<section><h2>{{ label }}</h2><slot /></section>' },
  'el-table': true, 'el-table-column': true,
  'el-button': { template: '<button><slot /></button>' },
  RouterLink: { template: '<a><slot /></a>' },
  CodeText: { props: ['value'], template: '<span>{{ value }}</span>' }, MetricValue: true
}}
const resource = () => reactive({ state: 'ready', value: { items: [] as any[], total: 0 }, error: '', updatedAt: '10:00:00' })
beforeEach(() => {
  setActivePinia(createPinia())
  fixture.state = {
    drafts: resource(), released: resource(), ready: resource(), running: resource(),
    reports: { ...resource(), value: [] }, defects: { ...resource(), value: [] }, loading: ref(false), reload: vi.fn()
  }
})
describe('business workspace truthful tasks and unavailable integrations', () => {
  it('keeps progress as the only order overview and shows bounded recent lists without totals', () => {
    const wrapper = mount(BusinessWorkspace, { props: { factoryName: '测试工厂' }, global })
    expect(wrapper.text()).not.toContain('工单概览')
    expect(wrapper.text()).toContain('按流水编号倒序显示最近 10 条')
    expect(wrapper.text()).toContain('按登记时间倒序显示最近 10 条处理记录')
    expect(wrapper.text()).not.toContain('共 0 条流水')
    wrapper.unmount()
  })
  it('shows quality connection failure as an explicit integration todo, never as no defects', () => {
    fixture.state.defects.state = 'error'; fixture.state.defects.value = null
    fixture.state.defects.error = '服务暂时不可用，请稍后重试'
    const wrapper = mount(BusinessWorkspace, { props: { factoryName: '测试工厂' }, global })
    expect(wrapper.text()).toContain('待办：恢复质量数据接入')
    expect(wrapper.text()).toContain('质量处置流水读取失败')
    expect(wrapper.text()).not.toContain('暂无不良处置流水')
    expect(wrapper.text()).not.toContain('示例数据'); wrapper.unmount()
  })
  it('excludes cancelled or draft workorders from actionable ready execution samples', () => {
    fixture.state.ready.value = { total: 3, items: [
      { id: '1', workorderId: '1', workorderStatus: 'RELEASED' },
      { id: '2', workorderId: '2', workorderStatus: 'CANCELLED' },
      { id: '3', workorderId: '3', workorderStatus: 'DRAFT' }
    ] }
    const wrapper = mount(BusinessWorkspace, { props: { factoryName: '测试工厂' }, global })
    const tasks = wrapper.find('[aria-label="工厂待办与接入事项"]')
    expect(tasks.findAll('.business-task-list a').map(link => link.text())).toEqual(['1'])
    expect(tasks.findAll('.business-task-list a').map(link => link.text())).not.toContain('2');expect(tasks.findAll('.business-task-list a').map(link => link.text())).not.toContain('3')
    expect(tasks.text()).toContain('仅列本次前 6 条'); wrapper.unmount()
  })
})
