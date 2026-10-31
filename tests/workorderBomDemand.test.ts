// TEST ONLY: real mounted view, explicitly mocked backend responses; no live inventory proof.
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import Panel from '../src/components/business/production/WorkorderBomDemand.vue'
import { useAuth } from '../src/stores/auth'
import type { BomGraph } from '../src/api/basic/materialBom'
const calls = vi.hoisted(() => ({ structure: vi.fn(), routings: vi.fn() }))
vi.mock('../src/api/basic/materialBom', () => ({ structure: calls.structure }))
vi.mock('../src/api/production/workorder', () => ({ api: { routings: calls.routings }}))
const graph: BomGraph = {
  bomId: '9007199254740993', outputQty: '123456789012.123456', totals: [], items: [
    { path: '/1', materialId: 'B', code: 'B', name: '子件B', quantity: '246913578024.246912', unitName: '件', childBomId: '2', children: [
      { path: '/1/2', materialId: 'C', code: 'C', name: '叶项C', quantity: '0.123456', unitName: '千克', childBomId: null, children: [] }
    ] },
    { path: '/3', materialId: 'C', code: 'C', name: '叶项C', quantity: '1.234567', unitName: '千克', childBomId: null, children: [] }
  ]
}
let wrapper: ReturnType<typeof mount>
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  calls.structure.mockImplementation(async(id: string) => ({ ...graph, bomId: id }))
  calls.routings.mockResolvedValue([{ id: '9007199254740995', code: 'R-B', name: '加工', version: 1, status: 'PUBLISHED' }])
})
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = '' })
async function setup(permissions = ['workorder:query', 'business:material:query']) {
  const pinia = createPinia(), auth = useAuth(pinia)
  auth.factoryId = 'F'; auth.factoryPermissions = permissions
  wrapper = mount(Panel, { props: { bomId: graph.bomId, productId: 'A', productCode: 'A', productName: '顶层产品', plannedQty: graph.outputQty }, global: { plugins: [pinia, ElementPlus] }})
  await flushPromises()
  return auth
}
function button(text: string) { return wrapper.findAll('button').find(b => b.text() === text)! }
async function expand() {
  // The root starts open; expand B and preserve both C occurrences by their BOM paths.
  await wrapper.findAll('.el-table__expand-icon')[1]!.trigger('click'); await flushPromises()
}
it('reads the saved BOM at the current plan and preserves node quantities and repeated leaf identities', async() => {
  await setup(); await expand()
  expect(calls.structure).toHaveBeenCalledWith(graph.bomId, graph.outputQty)
  expect(wrapper.text()).toContain('顶层产品')
  expect(wrapper.text()).toContain('246913578024.246912')
  expect(wrapper.text()).toContain('0.123456')
  expect(wrapper.text()).toContain('1.234567')
  expect(wrapper.findAll('tbody tr').filter(row => row.text().includes('叶项C'))).toHaveLength(2)
  expect(calls.routings).not.toHaveBeenCalled()
})
it('keeps receipt and gap unknown and exposes no parent continuation even after manufacturing routes are found', async() => {
  await setup()
  await button('核对可用工艺').trigger('click'); await flushPromises()
  expect(calls.routings).toHaveBeenCalledWith('A')
  expect(wrapper.text()).toContain('制造 → 报工 → 正式入库')
  expect(wrapper.text()).toContain('候选工艺')
  expect(wrapper.text()).toContain('多层需求仅供辅助核对，不要求子件重新制造')
  const row = wrapper.get('tbody tr')
  expect(row.findAll('td')[2]!.text()).toBe('待确认')
  expect(row.findAll('td')[3]!.text()).toBe('待确认')
  expect(wrapper.findAll('button').some(b => /继续生产|正式领料|收货入库|创建子工单/.test(b.text()))).toBe(false)
  expect(wrapper.text()).not.toContain('闭环完成')
})
it('does not infer routing or outsourcing from a missing child BOM and explains no-routing production', async() => {
  calls.routings.mockResolvedValue([])
  await setup(); await expand()
  const leaf = wrapper.findAll('tbody tr').find(row => row.text().includes('叶项C'))!
  expect(leaf.text()).toContain('路径待确认')
  await leaf.find('button').trigger('click'); await flushPromises()
  expect(calls.routings).toHaveBeenCalledWith('C')
  expect(leaf.text()).toContain('单阶段工单可跳过工序报工')
  expect(leaf.text()).toContain('可领数量以MES扫码计算及提交复验为准')
  expect(leaf.text()).not.toContain('已满足')
})
it('retains the structure when one routing read fails and permits retry', async() => {
  calls.routings.mockRejectedValueOnce(Error('工艺接口不可用'))
  await setup(); await button('核对可用工艺').trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('工艺接口不可用')
  expect(wrapper.text()).toContain('路径待确认')
  expect(wrapper.text()).toContain('顶层产品')
  expect(wrapper.text()).toContain(graph.outputQty)
  await button('重试工艺核对').trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('候选工艺')
  expect(wrapper.text()).not.toContain('工艺接口不可用')
})
it('distinguishes structure failure from an empty BOM and retries the real query', async() => {
  calls.structure.mockRejectedValueOnce(Error('结构读取失败'))
  await setup()
  expect(wrapper.text()).toContain('结构读取失败')
  expect(wrapper.text()).not.toContain('暂无数据')
  expect(wrapper.find('table').exists()).toBe(false)
  await button('重试多层需求').trigger('click'); await flushPromises()
  expect(wrapper.text()).toContain('顶层产品')
})
it('rejects a response for a different BOM instead of displaying wrong demand', async() => {
  calls.structure.mockResolvedValue({ ...graph, bomId: 'wrong' })
  await setup()
  expect(wrapper.text()).toContain('BOM结构响应与当前版本不一致')
  expect(wrapper.find('table').exists()).toBe(false)
})
it('does not request absent BOMs or unauthorized resources', async() => {
  await setup([])
  expect(calls.structure).not.toHaveBeenCalled()
  expect(wrapper.text()).toContain('不允许读取')
  wrapper.unmount()
  await setup()
  calls.structure.mockClear()
  await wrapper.setProps({ bomId: null }); await flushPromises()
  expect(calls.structure).not.toHaveBeenCalled()
  expect(wrapper.text()).toContain('保存工单BOM用料后')
  expect(wrapper.find('table').exists()).toBe(false)
})
it('recalculates after a plan change and rejects the old response', async() => {
  let release!: (value: BomGraph) => void
  calls.structure.mockReturnValueOnce(new Promise(resolve => { release = resolve }))
  await setup()
  calls.structure.mockResolvedValue({ ...graph, outputQty: '2' })
  await wrapper.setProps({ plannedQty: '2' }); await flushPromises()
  release(graph); await flushPromises()
  expect(wrapper.text()).not.toContain(graph.outputQty)
  expect(calls.structure).toHaveBeenLastCalledWith(graph.bomId, '2')
})
it('clears old factory demand and rejects late structure responses after permission revocation', async() => {
  let release!: (value: BomGraph) => void
  calls.structure.mockReturnValueOnce(new Promise(resolve => { release = resolve }))
  const auth = await setup()
  auth.factoryPermissions = []; await flushPromises()
  release(graph); await flushPromises()
  expect(wrapper.text()).not.toContain(graph.outputQty)
  expect(wrapper.find('table').exists()).toBe(false)
})
it('rejects late routing results after a factory switch', async() => {
  let release!: (value: unknown[]) => void
  calls.routings.mockReturnValueOnce(new Promise(resolve => { release = resolve }))
  const auth = await setup()
  await button('核对可用工艺').trigger('click'); await flushPromises()
  auth.factoryId = 'NEW'; await flushPromises()
  release([{ id: 'secret', code: 'OLD-FACTORY', name: '旧工厂工艺', version: 1 }]); await flushPromises()
  expect(wrapper.text()).not.toContain('OLD-FACTORY')
  expect(wrapper.text()).toContain('工艺 / 委外路径待确认')
})
it('clears results while factory switching and after unmount', async() => {
  const auth = await setup()
  auth.factorySwitching = true; await flushPromises()
  expect(wrapper.find('table').exists()).toBe(false)
  expect(button('刷新多层需求').attributes('disabled')).toBeDefined()
  auth.factorySwitching = false; await flushPromises()
  expect(wrapper.find('table').exists()).toBe(true)
  wrapper.unmount()
})
