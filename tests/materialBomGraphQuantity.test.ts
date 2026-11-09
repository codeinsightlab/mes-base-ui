// TEST ONLY: mounted panel with real QuantityInput and mocked transport.
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { defineComponent } from 'vue'
import ElementPlus from 'element-plus'
import Panel from '../src/components/business/material/MaterialBomPanel.vue'
import QuantityInput from '../src/components/business/material/QuantityInput.vue'
import { useAuth } from '../src/stores/auth'
import { invalidateQuantityRules } from '../src/lib/production/quantityRuleInvalidation'
const calls = vi.hoisted(() => ({ unit: vi.fn(), structure: vi.fn(), copy: vi.fn(), open: vi.fn(), prompt: vi.fn(), confirm: vi.fn(), transition: vi.fn(), setDefault: vi.fn(), create: vi.fn(), update: vi.fn(), detail: vi.fn(), itemCreate: vi.fn(), itemUpdate: vi.fn(), itemRemove: vi.fn(), itemDelete: vi.fn(), headerApi: null as any, itemApi: null as any, refreshId: '', row: { id: 'B', revision: '7', status: 'DRAFT', defaultVersion: false }}))
vi.mock('../src/api/basic/material', () => ({ api: { detail: async() => ({ unitId: 'U' }) }}))
vi.mock('../src/api/basic/unitMeasure', () => ({ api: { detail: calls.unit }}))
vi.mock('../src/api/basic/materialBom', () => ({ bomApi: { detail: calls.detail, create: calls.create, update: calls.update }, bomItemApi: { create: calls.itemCreate, update: calls.itemUpdate, remove: calls.itemRemove, delids: calls.itemDelete }, copyBom: calls.copy, structure: calls.structure, setDefaultBom: calls.setDefault, transition: calls.transition }))
vi.mock('../src/lib/pageMessageBox', () => ({ usePageMessageBox: () => ({ prompt: calls.prompt, confirm: calls.confirm }) }))
const Document = defineComponent({ props: ['headerApi', 'itemApi'], emits: ['back'], setup(props, { expose }) {
  expose({ open: calls.open, refresh: async() => props.headerApi.detail(calls.refreshId) })
  calls.headerApi = props.headerApi
  calls.itemApi = props.itemApi
  return { row: calls.row }
}, template: `<div><button @click="$emit('back')">返回列表</button><div class="header-list"><slot name="header-list-actions" :row="row" :refresh="async()=>{}"/></div><div class="header-detail"><slot name="header-actions" :row="row" :refresh="async()=>{}" :dirty="false"/></div><slot name="field-baseQty" :draft="{baseQty:'0.5',unitId:'U'}" :disabled="row.status!=='DRAFT'" :mode="row.status==='DRAFT'?'edit':'display'"/><slot v-if="row.status==='DRAFT'" name="field-quantity" :draft="{materialId:'M',quantity:'0.5',unitName:'件',unitId:'U'}" :disabled="false" :mode="'edit'"/></div>` })
let w: ReturnType<typeof mount>
beforeEach(() => {
  invalidateQuantityRules()
  calls.unit.mockReset().mockResolvedValue({ name: '件', mustBeWholeNumber: 1, quantityPrecision: 0 })
  calls.structure.mockReset().mockResolvedValue({ items: [], totals: [] })
  calls.copy.mockReset()
  calls.open.mockReset()
  calls.prompt.mockReset()
  calls.confirm.mockReset()
  calls.transition.mockReset()
  calls.setDefault.mockReset()
  calls.create.mockReset()
  calls.update.mockReset()
  calls.detail.mockReset()
  calls.itemCreate.mockReset()
  calls.itemUpdate.mockReset()
  calls.itemRemove.mockReset()
  calls.itemDelete.mockReset()
  calls.row.status = 'DRAFT'
})
afterEach(() => w?.unmount())

function setup() {
  const pinia = createPinia(), auth = useAuth(pinia)
  auth.factoryId = 'F'
  auth.factoryPermissions = ['business:material:query', 'business:material:create', 'business:material:update', 'business:unit:measure:query']
  w = mount(Panel, { props: { material: { id: 'M', unitId: 'U' }, unitNames: { U: '件' }}, global: { plugins: [pinia, ElementPlus], stubs: { MasterDetailDocument: Document, MaterialPicker: defineComponent({ setup(_, { expose }) {
    expose({ cancel: () => {} })
    return () => null
  } }), BomVersionSelect: true }}})
  return w
}

const button = (name:string) => w.findAll('button').find(b => b.text() === name)!
it.each([{ whole: 1, precision: 0, bad: '0.5', good: '2' }, { whole: 0, precision: 2, bad: '0.123', good: '0.12' }])('guards physical calculation while keeping ratios fractional: %j', async rule => {
  calls.unit.mockResolvedValue({ name: '单位', mustBeWholeNumber: rule.whole, quantityPrecision: rule.precision })
  setup()
  await flushPromises()
  const ratios = w.findAllComponents(QuantityInput)
  expect(ratios).toHaveLength(2)
  for (const ratio of ratios) expect(ratio.emitted('validity')?.at(-1)).toEqual([true])
  await button('多阶结构与需求').trigger('click')
  await flushPromises()
  expect(calls.structure).toHaveBeenCalledWith('B', '1')
  const input = w.get('input[aria-label="预计产出数量"]')
  await input.setValue(rule.bad)
  await flushPromises()
  calls.structure.mockClear()
  expect(button('计算').attributes('disabled')).toBeDefined()
  await button('计算').trigger('click')
  expect(calls.structure).not.toHaveBeenCalled()
  await input.setValue(rule.good)
  await flushPromises()
  await button('计算').trigger('click')
  await flushPromises()
  expect(calls.structure).toHaveBeenCalledWith('B', rule.good)
})
it('uses display quantity and retains its unit in read-only BOM versions', async() => {
  calls.row.status = 'PUBLISHED'
  setup()
  await flushPromises()

  expect(w.findAllComponents(QuantityInput)).toHaveLength(0)
  expect(w.text()).toContain('0.5 件')
  expect(w.findAll('span').some(span => span.text() === '0.5')).toBe(true)
})
it('copies the selected version as a draft and opens it for editing', async() => {
  calls.prompt.mockResolvedValue({ value: 'V2' })
  calls.copy.mockResolvedValue({ id: 'NEW', status: 'DRAFT' })
  calls.detail.mockResolvedValue({ id: 'B', revision: '7', status: 'PUBLISHED' })
  setup()
  await flushPromises()
  expect(w.text()).not.toContain('刷新版本')
  expect(w.findAll('.header-list button').filter(b => b.text() === '复制为草稿')).toHaveLength(1)
  expect(w.findAll('.header-detail button').some(b => b.text() === '复制为草稿' || b.text() === '发布')).toBe(false)
  await button('复制为草稿').trigger('click')
  await flushPromises()
  expect(calls.copy).toHaveBeenCalledWith('B', 'V2', '7')
  expect(calls.open).toHaveBeenCalledWith({ id: 'NEW', status: 'DRAFT' })
})
it('keeps publish and copy actions in the BOM version list', async() => {
  calls.row.status = 'DRAFT'
  setup()
  await flushPromises()
  expect(w.findAll('.header-list button').map(button => button.text())).toContain('发布')
  expect(w.findAll('.header-list button').map(button => button.text())).toContain('复制为草稿')
  expect(w.findAll('.header-detail button').map(button => button.text())).not.toContain('发布')
  expect(w.findAll('.header-detail button').map(button => button.text())).not.toContain('复制为草稿')
})
it('sets the default BOM from the version list using the latest revision', async() => {
  calls.row.status = 'PUBLISHED'
  calls.row.defaultVersion = false
  calls.confirm.mockResolvedValue('confirm')
  calls.detail.mockResolvedValue({ id: 'B', revision: '8', status: 'PUBLISHED', defaultVersion: false })
  setup()
  await flushPromises()
  expect(w.findAll('.header-list button').map(button => button.text())).toContain('设为默认')
  expect(w.findAll('.header-detail button').map(button => button.text())).not.toContain('设为默认')
  await button('设为默认').trigger('click')
  await flushPromises()
  expect(calls.setDefault).toHaveBeenCalledWith('B', '8')
})
it('reloads the current BOM revision after new or copied draft item edits before saving the header', async() => {
  calls.create.mockResolvedValue({ id: 'NEW', revision: '1' })
  calls.detail.mockImplementation(async id => ({ id, revision: id === 'NEW' ? '2' : '6' }))
  calls.itemCreate.mockResolvedValue({ id: 'LINE' })
  calls.itemUpdate.mockResolvedValue({ id: 'LINE' })
  calls.update.mockImplementation(async(_id, body) => ({ ...body, id: 'NEW', revision: '3' }))
  setup()
  await flushPromises()
  calls.refreshId = 'NEW'
  await calls.headerApi.create({ code: 'BOM', version: 'V1', baseQty: '1' })
  await calls.itemApi.create({ bomId: 'NEW', materialId: 'M1', quantity: '2', sort: 0 })
  await calls.headerApi.update('NEW', { code: 'BOM', version: 'V1', baseQty: '1' })
  expect(calls.detail).toHaveBeenCalledWith('NEW')
  expect(calls.update).toHaveBeenCalledWith('NEW', expect.objectContaining({ revision: '2' }))

  await calls.headerApi.detail('COPY')
  calls.refreshId = 'COPY'
  await calls.itemApi.update('LINE', { materialId: 'M1', quantity: '3', sort: 0 })
  await calls.headerApi.update('COPY', { code: 'BOM', version: 'V2', baseQty: '1' })
  expect(calls.detail).toHaveBeenLastCalledWith('COPY')
  expect(calls.update).toHaveBeenLastCalledWith('COPY', expect.objectContaining({ revision: '6' }))
})
it('closes the structure view when returning to the list', async() => {
  setup()
  await flushPromises()
  await button('多阶结构与需求').trigger('click')
  await flushPromises()
  expect(w.find('section[aria-label="多阶BOM结构与需求"]').exists()).toBe(true)
  await button('返回列表').trigger('click')
  await flushPromises()
  expect(w.find('section[aria-label="多阶BOM结构与需求"]').exists()).toBe(false)
})
it('allows an authorized user to enable a disabled version', async() => {
  calls.row.status = 'DISABLED'
  calls.confirm.mockResolvedValue('confirm')
  calls.transition.mockResolvedValue({})
  calls.detail.mockResolvedValue({ id: 'B', revision: '7', status: 'DISABLED' })
  setup()
  await flushPromises()
  await button('启用').trigger('click')
  await flushPromises()
  expect(calls.transition).toHaveBeenCalledWith('B', 'enable', '7')
})
it('does not copy after permission is revoked while the version prompt is open', async() => {
  let resolvePrompt!: (value: { value: string }) => void
  calls.prompt.mockReturnValue(new Promise(resolve => {
    resolvePrompt = resolve
  }))
  setup()
  await flushPromises()
  await button('复制为草稿').trigger('click')
  await flushPromises()
  useAuth().factoryPermissions = ['business:material:query']
  await flushPromises()
  resolvePrompt({ value: 'V2' })
  await flushPromises()
  expect(calls.copy).not.toHaveBeenCalled()
})
it('waits for the initial unit read and allows retry after failure before requesting structure', async() => {
  calls.unit.mockRejectedValue(Error('读取失败'))
  setup()
  await flushPromises()
  await button('多阶结构与需求').trigger('click')
  await flushPromises()
  expect(calls.structure).not.toHaveBeenCalled()
  expect(button('计算').attributes('disabled')).toBeDefined()
  calls.unit.mockResolvedValue({ name: '件', mustBeWholeNumber: 1, quantityPrecision: 0 })
  const graph = w.get('section[aria-label="多阶BOM结构与需求"]')
  await graph.findAll('button').find(b => b.text() === '重试')!.trigger('click')
  await flushPromises()
  expect(calls.structure).toHaveBeenCalledWith('B', '1')
})
