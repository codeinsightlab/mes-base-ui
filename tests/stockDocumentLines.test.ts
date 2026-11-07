import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import Lines from '../src/views/wm/stockDocuments/StockDocumentLines.vue'
import { useAuth } from '../src/stores/auth'
const mocks = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('../src/lib/request', () => ({ request: mocks.request }))
let wrapper: ReturnType<typeof mount> | undefined
beforeEach(() => { vi.clearAllMocks();vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }) })
afterEach(() => { wrapper?.unmount();vi.unstubAllGlobals() })
async function setup() {
  const pinia = createPinia(), auth = useAuth(pinia)
  auth.factoryId = 'A';auth.factoryPermissions = ['business:wm:stock:document:query', 'business:wm:stock:action:query']
  wrapper = mount(Lines, { props: { header: { id: '9', direction: 'IN', revision: '1', status: 'POSTED' }, items: [{ id: '8', materialId: '987654321', warehouseId: '987654322', unitId: '987654323', stockId: '987654324', quantity: '3.250000', batchNo: 'LOT-1', binCode: 'A01', stockActionId: '11111111-2222-4333-8444-555555555555' }], writable: false, saving: false, canIssueLine: false, originalLines: new Map() }, global: { plugins: [pinia, ElementPlus] }})
  await flushPromises();return auth
}
it('loads names once per document and renders business names and stock links without system identifiers', async() => {
  mocks.request.mockResolvedValue([{ lineId: '8', materialCode: 'RAW-01', materialName: '铝棒', warehouseCode: 'WH-01', warehouseName: '原材料仓', warehouseSource: 'LOCAL', unitName: '千克' }])
  await setup()
  expect(mocks.request).toHaveBeenCalledTimes(1)
  for (const text of ['RAW-01', '铝棒', '原材料仓', '本地', '千克', 'LOT-1', 'A01', '3.25', '查看变动']) expect(wrapper!.text()).toContain(text)
  expect(wrapper!.text()).not.toMatch(/98765432|11111111-2222/)
  await wrapper!.findAll('button').find(button => button.text() === '查看变动')!.trigger('click')
  expect(wrapper!.emitted('show-action')?.[0]).toEqual(['11111111-2222-4333-8444-555555555555'])
})
it('keeps quantities and batch facts visible when the names fail, with an independent retry', async() => {
  mocks.request.mockRejectedValueOnce(Error('读取失败')).mockResolvedValueOnce([])
  await setup()
  expect(wrapper!.text()).toContain('名称读取失败');expect(wrapper!.text()).toContain('3.25');expect(wrapper!.text()).toContain('LOT-1')
  await wrapper!.findAll('button').find(button => button.text() === '重试')!.trigger('click');await flushPromises()
  expect(mocks.request).toHaveBeenCalledTimes(2);expect(wrapper!.text()).toContain('名称待确认')
})
it('rejects a late name response after switching factories', async() => {
  let finish!: (value: unknown) => void
  mocks.request.mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockResolvedValue([])
  const auth = await setup();auth.factoryId = 'B';auth.revision++;await flushPromises()
  finish([{ lineId: '8', materialName: 'OLD FACTORY SECRET' }]);await flushPromises()
  expect(wrapper!.text()).not.toContain('OLD FACTORY SECRET')
})
