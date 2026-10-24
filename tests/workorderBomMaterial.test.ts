import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import Panel from '../src/components/business/production/WorkorderMaterialPanel.vue'
import { useAuth } from '../src/stores/auth'
const { get, save, detail } = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn(), detail: vi.fn() }))
vi.mock('../src/api/production/workorderMaterial', () => ({ workorderMaterial: { get, save }}))
vi.mock('../src/api/basic/materialBom', () => ({ bomApi: { detail, list: vi.fn().mockResolvedValue({ items: [], total: 0 }) }}))
const basis = { id: '1', bomId: '10', bomBaseQty: '1', bomComponentQty: '2.5', materialId: '2', unitId: '3', outputUnitId: '4', totalRequiredQty: '250', plannedQty: '100', warehouseIds: '["7"]', workCenter: '钻孔', revision: '2', status: 'ENABLED', frozenAt: null }
let wrapper: ReturnType<typeof mount>
beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }); get.mockResolvedValue(basis); detail.mockResolvedValue({ id: '10', code: 'BOM-A', version: '2' }) })
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = '' })
async function setup() {
  const pinia = createPinia(), auth = useAuth(pinia); auth.factoryId = 'A'; auth.factoryPermissions = ['workorder:query', 'workorder:material:update', 'business:material:query']
  wrapper = mount(Panel, { props: { workorderId: '1', productId: '8' }, global: { plugins: [pinia, ElementPlus], stubs: { MaterialSelect: true, WarehouseSelect: true, UnitMeasureSelect: true, BomVersionSelect: true }}})
  await flushPromises(); return { auth, state: wrapper.vm as unknown as { editing: boolean; form: { bomId: string | null }; save: () => Promise<void> }}
}
it('uses an explicit BOM version and sends no competing manual ratio', async() => {
  const { state } = await setup(); expect(wrapper.text()).toContain('BOM-A · 2'); expect(wrapper.text()).toContain('首次正式领料前可调整')
  state.editing = true; state.form.bomId = null; await state.save(); expect(save).not.toHaveBeenCalled()
  state.form.bomId = '11'; save.mockResolvedValue({ ...basis, bomId: '11' }); await state.save()
  expect(save).toHaveBeenCalledWith('1', { bomId: '11', warehouseIds: ['7'], workCenter: '钻孔', enabled: true, expectedRevision: '2' })
  expect(save.mock.calls[0]![1]).not.toHaveProperty('totalRequiredQty'); expect(save.mock.calls[0]![1]).not.toHaveProperty('materialId')
})
it('keeps the raw basis readable when the BOM name request fails', async() => {
  detail.mockRejectedValue(new Error('版本读取失败')); await setup()
  expect(wrapper.text()).toContain('版本读取失败'); expect(wrapper.text()).toContain('2.5'); expect(wrapper.text()).toContain('250')
})
it('prevents editing a basis fixed by successful input', async() => {
  get.mockResolvedValue({ ...basis, frozenAt: '2026-10-23T10:00:00' }); const { state } = await setup()
  const button = wrapper.findAll('button').find(b => b.text() === '选择BOM与领料范围')!
  expect(button.attributes('disabled')).toBeDefined(); state.form.bomId = '11'; await state.save(); expect(save).not.toHaveBeenCalled()
})
it('does not restore another factory basis after a late request', async() => {
  let release!: (v: unknown) => void; get.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
  const { auth } = await setup(); get.mockResolvedValueOnce(null); auth.factoryId = 'B'; await flushPromises(); release(basis); await flushPromises()
  expect(wrapper.text()).toContain('尚未选择BOM'); expect(wrapper.text()).not.toContain('250')
})
