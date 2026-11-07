import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import Page from '../src/views/wm/wmInventory/index.vue'
import MaterialSelect from '../src/components/business/MaterialSelect.vue'
import WarehouseSelect from '../src/components/business/WarehouseSelect.vue'
import { useAuth } from '../src/stores/auth'
const mocks = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), labels: vi.fn() }))
vi.mock('../src/api/wm/wmInventory', () => ({ api: mocks, inventoryUnitLabels: mocks.labels, sync: vi.fn() }))
const row = { id: '987654321', materialId: '987654322', warehouseId: '987654323', materialName: 'M-01 · 铝棒', warehouseName: 'WH-01 · 原料仓', warehouseSource: 'LOCAL', batchNo: 'LOT-A', binCode: 'A01', quantity: '12.500001', availableQuantity: '10.000001', status: 'ENABLED' }
let wrapper: ReturnType<typeof mount> | undefined
beforeEach(() => { vi.clearAllMocks();vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });mocks.list.mockResolvedValue({ items: [row], total: 1, offset: 0, limit: 20 });mocks.labels.mockResolvedValue([{ stockId: row.id, unitName: '千克' }]) })
afterEach(() => { wrapper?.unmount();document.body.innerHTML = '';vi.unstubAllGlobals() })
async function setup() {
  const pinia = createPinia(), auth = useAuth(pinia)
  auth.factoryId = 'A';auth.runtimeMode = 'LOCAL';auth.factoryPermissions = ['list', 'query', 'create', 'update', 'delete'].map(action => 'business:wm:inventory:' + action)
  wrapper = mount(Page, { global: { plugins: [pinia, ElementPlus], stubs: { LocalStockPanel: true, teleport: true, ElSelect: { props: ['modelValue'], template: '<div><slot /></div>' }, ElOption: true }}})
  await flushPromises();return auth
}
it('shows inventory business references, units and quantities without identifiers or audit user IDs', async() => {
  await setup()
  for (const text of ['M-01 · 铝棒', 'WH-01 · 原料仓', '千克', '本地', '12.500001', '10.000001', '查看库存']) expect(wrapper!.text()).toContain(text)
  expect(wrapper!.text()).not.toMatch(/98765432|创建人|修改人|库存标识/)
  expect(mocks.labels).toHaveBeenCalledExactlyOnceWith([row.id])
})
it('keeps facts and offers an independent retry when unit display fails', async() => {
  mocks.labels.mockRejectedValueOnce(Error('单位目录不可用')).mockResolvedValueOnce([{ stockId: row.id, unitName: '千克' }])
  await setup()
  expect(wrapper!.text()).toContain('12.500001');expect(wrapper!.text()).toContain('单位名称读取失败')
  await wrapper!.findAll('button').find(button => button.text() === '重试')!.trigger('click');await flushPromises()
  expect(wrapper!.text()).toContain('千克');expect(mocks.list).toHaveBeenCalledTimes(1)
})
it('preserves material and warehouse selectors in the editor while hiding them as identifier columns', async() => {
  await setup()
  await wrapper!.findAll('button').find(button => button.text().trim() === '新增')!.trigger('click');await flushPromises()
  expect(wrapper!.findAllComponents(MaterialSelect)).toHaveLength(2)
  expect(wrapper!.findAllComponents(WarehouseSelect)).toHaveLength(2)
  expect(wrapper!.text()).toContain('数量通过入库、出库和库存调整更新')
  expect(wrapper!.text()).toContain('新增库存记录')
  expect(mocks.create).not.toHaveBeenCalled();expect(mocks.update).not.toHaveBeenCalled()
})
it('rejects old unit labels after a factory switch', async() => {
  let finish!: (value: unknown) => void
  mocks.labels.mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockResolvedValue([{ stockId: row.id, unitName: '新工厂单位' }])
  const auth = await setup();auth.factoryId = 'B';auth.revision++;await flushPromises()
  finish([{ stockId: row.id, unitName: '旧工厂私有单位' }]);await flushPromises()
  expect(wrapper!.text()).toContain('新工厂单位');expect(wrapper!.text()).not.toContain('旧工厂私有单位')
})
