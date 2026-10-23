import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import { useAuth } from '../src/stores/auth'
import WarehousePage from '../src/views/wm/wmWarehouse/index.vue'
import CrudPage from '../src/components/CrudPage.vue'
import { warehouseTypeOptions, warehouseTypeText } from '../src/api/wm/wmWarehouse'

const calls = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() }))
vi.mock('../src/api/wm/wmWarehouse', async original => ({ ...(await original<object>()), api: calls }))
let wrapper: ReturnType<typeof mount>
const legacy = { id: '9007199254740993', code: 'HISTORY', name: '待补录仓库', status: 'ENABLED', source: 'LOCAL', warehouseType: null, warehouseTypeLabel: '待补录' }
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  calls.list.mockResolvedValue({ items: [legacy], total: 1, offset: 0, limit: 20 })
  calls.detail.mockResolvedValue(legacy)
  calls.create.mockResolvedValue({ ...legacy, warehouseType: 'WIP' })
  calls.update.mockResolvedValue({ ...legacy, warehouseType: 'SCRAP' })
})
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = ''; vi.unstubAllGlobals() })
async function setup() {
  const pinia = createPinia(), auth = useAuth(pinia)
  auth.factoryId = 'A'; auth.runtimeMode = 'LOCAL'
  auth.factoryPermissions = ['list', 'query', 'create', 'update', 'delete'].map(action => 'business:wm:warehouse:' + action)
  wrapper = mount(WarehousePage, { global: { plugins: [pinia, ElementPlus], stubs: { E10SyncPreview: true }}})
  await flushPromises()
  const crud = wrapper.findComponent(CrudPage)
  const state = (crud.vm.$ as unknown as { setupState: Record<string, any> }).setupState
  return { state, crud, auth }
}
it('shows legacy pending classification and seven stable Chinese options without a default', async() => {
  const { crud, state } = await setup()
  expect(wrapper.text()).toContain('待补录')
  const field = crud.props('fields').find(f => f.key === 'warehouseType')!
  expect(field.required).toBe(true); expect(field.searchable).toBe(true)
  expect(field.options).toEqual(warehouseTypeOptions); expect(field.defaultValue).toBeUndefined()
  expect(warehouseTypeOptions.map(o => o.value)).toEqual(['RAW_MATERIAL', 'WIP', 'FINISHED_GOODS', 'INSPECTION', 'DEFECTIVE', 'SCRAP', 'OUTSOURCING'])
  await state.open()
  Object.assign(state.draft, { code: 'NEW', name: '新增仓库', status: 'ENABLED' })
  await state.save(); expect(calls.create).not.toHaveBeenCalled()
  state.draft.warehouseType = 'WIP'; await state.save()
  expect(calls.create.mock.calls[0]![0]).toMatchObject({ warehouseType: 'WIP' })
})
it('loads detail, requires legacy classification on edit, and submits the selected code', async() => {
  const { state } = await setup()
  await state.open(legacy)
  expect(calls.detail).toHaveBeenCalledWith(legacy.id)
  expect(state.draft.warehouseType).toBeNull()
  await state.save(); expect(calls.update).not.toHaveBeenCalled()
  state.draft.warehouseType = 'SCRAP'; await state.save()
  expect(calls.update).toHaveBeenCalledWith(legacy.id, expect.objectContaining({ warehouseType: 'SCRAP' }))
})
it('sends the type filter and clears the editor after a factory change', async() => {
  const { state, auth } = await setup()
  state.search.warehouseType = 'FINISHED_GOODS'; await state.load()
  expect(calls.list.mock.calls.at(-1)![0]).toMatchObject({ warehouseType: 'FINISHED_GOODS' })
  await state.open(legacy); auth.factoryId = 'B'; auth.revision++; await flushPromises()
  expect(state.dialog).toBe(false)
  expect(state.draft.warehouseType).toBeUndefined()
})
it('keeps existing ERP warehouse editing restrictions', async() => {
  const { state, auth, crud } = await setup()
  expect(crud.props('editableRow')!({ source: 'EXTERNAL' })).toBe(false)
  auth.runtimeMode = 'ERP'; await flushPromises()
  await state.open({ ...legacy, source: 'EXTERNAL' })
  expect(state.dialog).toBe(false)
  expect(calls.update).not.toHaveBeenCalled()
})

it('distinguishes missing API information from a known unclassified warehouse', () => {
  expect(warehouseTypeText(null)).toBe('待补录')
  expect(warehouseTypeText(undefined)).toBe('类型信息未返回')
  expect(warehouseTypeText('OTHER')).toBe('未知类型')
})

it('uses audit name columns instead of displaying actor IDs', async() => {
  calls.list.mockResolvedValue({ items: [{ ...legacy, createBy: '100', createByName: '张三', updateBy: '101', updateByName: '李四' }], total: 1, offset: 0, limit: 20 })
  const { crud } = await setup()
  expect(wrapper.text()).toContain('张三'); expect(wrapper.text()).toContain('李四')
  const keys = crud.props('fields').map(field => field.key)
  expect(keys).toContain('createByName'); expect(keys).toContain('updateByName')
  expect(keys).not.toContain('createBy'); expect(keys).not.toContain('updateBy')
})
