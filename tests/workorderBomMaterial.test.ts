import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { defineComponent, watch } from 'vue'
import ElementPlus, { ElMessageBox } from 'element-plus'
import Editor from '../src/components/business/production/WorkorderMaterialEditor.vue'
import BomSelect from '../src/components/business/material/WorkorderBomSelect.vue'
import Panel from '../src/components/business/production/WorkorderMaterialPanel.vue'
import { emptyMaterialDemand, type MaterialDemandSave } from '../src/api/production/workorderMaterial'
import { useAuth } from '../src/stores/auth'
const calls = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn(), direct: vi.fn(), defaultBom: vi.fn(), structure: vi.fn() }))
vi.mock('../src/api/production/workorderMaterial', async original => ({ ...await original<typeof import('../src/api/production/workorderMaterial')>(), workorderMaterial: { get: calls.get, save: calls.save }}))
vi.mock('../src/api/basic/materialBom', () => ({ defaultBom: calls.defaultBom, directComponents: calls.direct, structure: calls.structure }))
const Quantity = defineComponent({ name: 'QuantityInput', props: ['modelValue', 'materialId'], emits: ['validity', 'update:modelValue'], setup(props, { emit }) { watch(() => props.modelValue, value => emit('validity', !!value && Number(value) > 0), { immediate: true }); return () => null } })
let wrapper: ReturnType<typeof mount>
const bom = { id: '10', productId: '8', unitId: '1', revision: '3', status: 'PUBLISHED' }
const components = (quantity: string) => ({ version: bom, items: [
  { lineId: '101', materialId: '2', unitId: '1', componentQty: '2', baseQty: '1', quantity: quantity === '2' ? '4' : '2' },
  { lineId: '102', materialId: '3', unitId: '1', componentQty: '3', baseQty: '1', quantity: quantity === '2' ? '6' : '3' }
] })
const stubs = { BomVersionSelect: true, MaterialSelect: true, UnitMeasureSelect: true, WarehouseSelect: true, QuantityInput: Quantity }
beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }); calls.defaultBom.mockResolvedValue(bom); calls.direct.mockImplementation((_, quantity) => Promise.resolve(components(quantity))); calls.structure.mockRejectedValue(new Error('分析读取失败')) })
afterEach(() => { wrapper?.unmount(); vi.restoreAllMocks(); document.body.innerHTML = '' })
function authState() { const pinia = createPinia(), auth = useAuth(pinia); auth.factoryId = 'A'; auth.factoryPermissions = ['workorder:query', 'workorder:material:update', 'business:material:query', 'business:material:list']; return { pinia, auth } }
async function setup(draft = emptyMaterialDemand()) {
  const { pinia, auth } = authState()
  wrapper = mount(Editor, { props: { modelValue: draft, productId: '8', plannedQty: '1', 'onUpdate:modelValue': value => { void wrapper.setProps({ modelValue: value }) } }, global: { plugins: [pinia, ElementPlus], stubs }})
  await flushPromises()
  return { auth, state: wrapper.vm as unknown as { updateRow: (index: number, value: object) => void; add: () => void; validateAndConfirm: () => Promise<boolean> }}
}
const draft = () => (wrapper.props() as { modelValue: MaterialDemandSave }).modelValue
it('selects the published default and fills every direct component from the server quantity', async() => {
  await setup()
  expect(draft().bomId).toBe('10'); expect(draft().expectedBomRevision).toBe('3')
  expect(draft().items.map(row => [row.materialId, row.totalRequiredQty, row.bomItemId])).toEqual([['2', '2', '101'], ['3', '3', '102']])
  expect(calls.structure).not.toHaveBeenCalled(); expect(calls.save).not.toHaveBeenCalled()
})
it('requires an explicit version when the product has no default', async() => {
  calls.defaultBom.mockResolvedValue(null); await setup()
  expect(draft().bomId).toBeNull(); expect(draft().items).toEqual([]); expect(calls.direct).not.toHaveBeenCalled()
})
it('recalculates untouched BOM rows and retains adjusted and added quantities', async() => {
  const { state } = await setup()
  state.updateRow(0, { totalRequiredQty: '17', manuallyAdjusted: true }); await flushPromises()
  state.add(); await flushPromises(); state.updateRow(2, { materialId: '4', unitId: '1', totalRequiredQty: '9' }); await flushPromises()
  await wrapper.setProps({ plannedQty: '2' }); await flushPromises()
  expect(draft().items.map(row => row.totalRequiredQty)).toEqual(['17', '6', '9'])
  expect(draft().items[0]?.standardRequiredQty).toBe('4')
  expect(wrapper.text()).toContain('产量已变化')
  vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue('confirm' as never)
  expect(await state.validateAndConfirm()).toBe(true); expect(draft().adjustmentsConfirmed).toBe(true)
})
it('allows confirmation cancellation without silently resetting manual quantities', async() => {
  const { state } = await setup(); state.updateRow(0, { totalRequiredQty: '17', manuallyAdjusted: true }); await flushPromises()
  await wrapper.setProps({ plannedQty: '2' }); await flushPromises()
  vi.spyOn(ElMessageBox, 'confirm').mockRejectedValue('cancel')
  expect(await state.validateAndConfirm()).toBe(false); expect(draft().items[0]?.totalRequiredQty).toBe('17'); expect(draft().adjustmentsConfirmed).toBe(false)
})
it('does not replace an existing workorder version with the current default', async() => {
  await setup({ ...emptyMaterialDemand(), bomId: '10', expectedBomRevision: '3' })
  expect(calls.defaultBom).not.toHaveBeenCalled(); expect(draft().bomId).toBe('10')
})
it('rejects late component results and clears the old material document after switching factory', async() => {
  let release!: (value: unknown) => void
  calls.direct.mockReturnValueOnce(new Promise(resolve => { release = resolve }))
  const { auth } = await setup(); auth.factoryId = 'B'; await flushPromises(); release(components('1')); await flushPromises()
  expect(draft().items).toEqual([]); expect(draft().bomId).toBeNull()
})
it('keeps a user version selection when default lookup returns late', async() => {
  let release!: (value: unknown) => void; calls.defaultBom.mockReturnValue(new Promise(resolve => { release = resolve }))
  const { pinia } = authState()
  wrapper = mount(BomSelect, { props: { modelValue: null, materialId: '8' }, global: { plugins: [pinia, ElementPlus], stubs }}); await flushPromises()
  wrapper.findComponent({ name: 'BomVersionSelect' }).vm.$emit('update:modelValue', '11'); await flushPromises()
  release(bom); await flushPromises(); expect(wrapper.emitted('update:modelValue')).toEqual([['11']])
})
it('shows default lookup failure separately from no default', async() => {
  calls.defaultBom.mockRejectedValue(new Error('默认读取不可用')); await setup()
  expect(wrapper.text()).toContain('默认读取不可用'); expect(draft().bomId).toBeNull(); expect(calls.direct).not.toHaveBeenCalled()
})
it('keeps saved material facts visible when the auxiliary recursive view fails', async() => {
  calls.get.mockResolvedValue({ workorderId: '1', bomId: '10', revision: '2', frozenAt: null, items: [{ id: '9', materialId: '2', unitId: '1', totalRequiredQty: '250', standardRequiredQty: '200', manuallyAdjusted: true }] })
  const { pinia } = authState(); wrapper = mount(Panel, { props: { workorderId: '1', productId: '8', plannedQty: '100' }, global: { plugins: [pinia, ElementPlus], stubs }}); await flushPromises()
  expect(wrapper.text()).toContain('250'); expect(wrapper.text()).toContain('人工新增'); expect(wrapper.text()).toContain('分析读取失败')
})
it('prevents editing a basis frozen by formal input', async() => {
  calls.get.mockResolvedValue({ workorderId: '1', bomId: null, revision: '2', frozenAt: '2026-10-30T10:00:00', items: [] })
  const { pinia } = authState(); wrapper = mount(Panel, { props: { workorderId: '1', productId: '8' }, global: { plugins: [pinia, ElementPlus], stubs }}); await flushPromises()
  expect(wrapper.findAll('button').find(button => button.text() === '维护工单用料')?.attributes('disabled')).toBeDefined()
})
