import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import Panel from '../src/components/business/production/WorkorderMaterialPanel.vue'
import BomVersionSelect from '../src/components/business/material/BomVersionSelect.vue'
import { useAuth } from '../src/stores/auth'
const { get, save, detail, defaultBom } = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn(), detail: vi.fn(), defaultBom: vi.fn() }))
vi.mock('../src/api/production/workorderMaterial', () => ({ workorderMaterial: { get, save }}))
vi.mock('../src/api/basic/materialBom', () => ({ bomApi: { detail, list: vi.fn().mockResolvedValue({ items: [], total: 0 }) }, defaultBom }))
const basis = { id: '1', bomId: '10', bomBaseQty: '1', bomComponentQty: '2.5', materialId: '2', unitId: '3', outputUnitId: '4', totalRequiredQty: '250', plannedQty: '100', warehouseIds: '["7"]', workCenter: '钻孔', revision: '2', status: 'ENABLED', frozenAt: null }
let wrapper: ReturnType<typeof mount>
beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }); get.mockResolvedValue(basis); detail.mockResolvedValue({ id: '10', code: 'BOM-A', version: '2', productId: '8', status: 'PUBLISHED', revision: '3' }); defaultBom.mockResolvedValue(null) })
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = '' })
async function setup(stubBomSelector = true) {
  const pinia = createPinia(), auth = useAuth(pinia); auth.factoryId = 'A'; auth.factoryPermissions = ['workorder:query', 'workorder:material:update', 'business:material:query', 'business:material:list']
  const stubs = { MaterialSelect: true, WarehouseSelect: true, UnitMeasureSelect: true, ...(stubBomSelector ? { BomVersionSelect: true } : {}) }
  wrapper = mount(Panel, { props: { workorderId: '1', productId: '8' }, global: { plugins: [pinia, ElementPlus], stubs }})
  await flushPromises(); return { auth, state: wrapper.vm as unknown as { editing: boolean; form: { bomId: string | null }; selectedBom: { id: string; revision: string } | null; defaultError: string; defaultResolved: boolean; edit: () => void; save: () => Promise<void> }}
}
it('uses an explicit BOM version and sends no competing manual ratio', async() => {
  const { state } = await setup(); expect(wrapper.text()).toContain('BOM-A · 2'); expect(wrapper.text()).toContain('首次正式领料前可调整')
  state.editing = true; state.form.bomId = null; await state.save(); expect(save).not.toHaveBeenCalled()
  state.form.bomId = '11'; state.selectedBom = { id: '11', code: 'BOM-B', version: '1', productId: '8', status: 'PUBLISHED', revision: '9' } as never; save.mockResolvedValue({ ...basis, bomId: '11' }); await state.save()
  expect(save).toHaveBeenCalledWith('1', { bomId: '11', warehouseIds: ['7'], workCenter: '钻孔', enabled: true, expectedRevision: '2', expectedBomRevision: '9' })
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

it('preselects a product default only in the unsaved first-maintenance form', async() => {
  get.mockResolvedValue(null)
  const productDefault = { id: '20', code: 'BOM-DEFAULT', version: '3', productId: '8', status: 'PUBLISHED', revision: '6', defaultVersion: true }
  defaultBom.mockResolvedValue(productDefault)
  detail.mockResolvedValue(productDefault)
  const { state } = await setup(false)
  state.edit(); await flushPromises()
  expect(state.form.bomId).toBe('20')
  expect(state.selectedBom).toMatchObject({ id: '20', revision: '6' })
  expect(save).not.toHaveBeenCalled()
})

it('keeps default lookup failures distinct from a product with no default', async() => {
  get.mockResolvedValue(null)
  defaultBom.mockRejectedValue(new Error('默认读取不可用'))
  const { state } = await setup()
  state.edit(); await flushPromises()
  expect(state.defaultError).toBe('默认读取不可用')
  expect(state.defaultResolved).toBe(false)
  expect(state.form.bomId).toBeNull()
})

it('preserves a manual BOM choice when the default lookup returns late', async() => {
  get.mockResolvedValue(null)
  let resolveDefault!: (value: unknown) => void
  defaultBom.mockReturnValue(new Promise(resolve => { resolveDefault = resolve }))
  const manualBom = { id: '21', code: 'BOM-MANUAL', version: '2', productId: '8', status: 'PUBLISHED', revision: '11', defaultVersion: false }
  detail.mockResolvedValue(manualBom)
  const { state } = await setup(false)
  state.edit(); await flushPromises()
  const selector = wrapper.findComponent(BomVersionSelect)
  selector.vm.$emit('update:modelValue', manualBom.id)
  selector.vm.$emit('selected', manualBom)
  await flushPromises()
  resolveDefault({ id: '20', code: 'BOM-DEFAULT', version: '3', productId: '8', status: 'PUBLISHED', revision: '6', defaultVersion: true })
  await flushPromises()
  expect(state.form.bomId).toBe(manualBom.id)
  expect(state.selectedBom).toMatchObject({ id: manualBom.id, revision: manualBom.revision })
})

it('preserves an explicit clear when the default lookup returns late', async() => {
  get.mockResolvedValue(null)
  let resolveDefault!: (value: unknown) => void
  defaultBom.mockReturnValue(new Promise(resolve => { resolveDefault = resolve }))
  const manualBom = { id: '21', code: 'BOM-MANUAL', version: '2', productId: '8', status: 'PUBLISHED', revision: '11', defaultVersion: false }
  detail.mockResolvedValue(manualBom)
  const { state } = await setup(false)
  state.edit(); await flushPromises()
  const selector = wrapper.findComponent(BomVersionSelect)
  selector.vm.$emit('update:modelValue', manualBom.id)
  selector.vm.$emit('selected', manualBom)
  await flushPromises()
  selector.vm.$emit('update:modelValue', null)
  selector.vm.$emit('selected', null)
  await flushPromises()
  resolveDefault({ id: '20', code: 'BOM-DEFAULT', version: '3', productId: '8', status: 'PUBLISHED', revision: '6', defaultVersion: true })
  await flushPromises()
  expect(state.form.bomId).toBeNull()
  expect(state.selectedBom).toBeNull()
})
