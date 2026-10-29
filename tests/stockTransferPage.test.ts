import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { defineComponent, reactive } from 'vue'
import { useAuth } from '../src/stores/auth'
import Page from '../src/views/wm/stockTransfers/index.vue'
const mocks = vi.hoisted(() => ({ request: vi.fn(), query: {} as Record<string, string>, open: vi.fn() }))
vi.mock('../src/lib/request', async original => ({ ...await original<object>(), request: mocks.request }))
vi.mock('vue-router', () => ({ useRoute: () => reactive({ query: mocks.query }) }))
const Document = defineComponent({ props: ['aggregateApi'], setup(_, { expose }) { expose({ open: mocks.open, hasUnsavedChanges: () => false }); return {} }, template: '<div />' })
let wrapper: ReturnType<typeof mount> | undefined
beforeEach(() => { sessionStorage.clear(); vi.clearAllMocks(); mocks.query = {} })
afterEach(() => wrapper?.unmount())
function setup(query = false) {
  const pinia = createPinia(), auth = useAuth(pinia)
  auth.factoryId = 'A'; auth.username = 'operator'; auth.runtimeMode = 'LOCAL'; auth.factoryPermissions = ['business:wm:stock:document:create', ...(query ? ['business:wm:stock:document:query'] : [])]
  wrapper = mount(Page, { global: { plugins: [pinia], stubs: { MasterDetailDocument: Document, ElAlert: true, ElButton: true }}})
  return { auth, aggregate: wrapper.findComponent(Document).props('aggregateApi') }
}
const raw = { reason: '实物移库', items: [{ sourceStockId: '9007199254740999', targetStockId: '9007199254740998', targetWarehouseId: '2', targetBinCode: 'A', quantity: '0.000001' }] }
it('freezes the original create UUID after an unknown response and refuses changed content', async() => {
  const { aggregate } = setup()
  mocks.request.mockRejectedValue(new Error('连接中断'))
  await expect(aggregate.create(raw)).rejects.toThrow('连接中断')
  await expect(aggregate.create(raw)).rejects.toThrow('连接中断')
  expect(mocks.request.mock.calls[1]![1].body).toEqual(mocks.request.mock.calls[0]![1].body)
  await expect(aggregate.create({ ...raw, reason: '改变原因' })).rejects.toThrow('原调拨创建请求')
  expect(mocks.request).toHaveBeenCalledTimes(2)
  expect(sessionStorage.length).toBe(1)
})
it('keeps the uncertain request recoverable after scope cleanup without leaking it into the other factory', async() => {
  const { auth, aggregate } = setup()
  mocks.request.mockRejectedValue(new Error('连接中断'))
  await expect(aggregate.create(raw)).rejects.toThrow()
  auth.factoryId = 'B'; await flushPromises()
  expect(wrapper!.text()).not.toContain('待核实的原创建UUID')
  expect(sessionStorage.getItem('stock-transfer-create:operator:A')).toContain('9007199254740999')
  expect(sessionStorage.getItem('stock-transfer-create:operator:B')).toBeNull()
})

it('accepts destination-only drafts and freezes their original bin across unknown-result recovery', async() => {
  const { aggregate } = setup()
  const row = { sourceStockId: '9007199254740999', targetStockId: null, targetWarehouseId: '2', targetBinCode: ' 0001 ', quantity: '0.000001' }
  const state = (wrapper!.vm.$ as unknown as { setupState: Record<string, any> }).setupState
  state.validities.set(row, true)
  expect(state.validate([row])).toBeNull()
  mocks.request.mockRejectedValue(new Error('连接中断'))
  await expect(aggregate.create({ reason: '实物移库', items: [row] })).rejects.toThrow('连接中断')
  expect(mocks.request.mock.calls[0]![1].body.items[0]).toMatchObject({ targetStockId: null, targetWarehouseId: '2', targetBinCode: ' 0001 ' })
  await expect(aggregate.create({ reason: '实物移库', items: [{ ...row, targetBinCode: 'other' }] })).rejects.toThrow('原调拨创建请求')
  expect(mocks.request).toHaveBeenCalledTimes(1)
})
it('echoes trusted source identity and clears a selected target when its warehouse changes', () => {
  setup()
  const state = (wrapper!.vm.$ as unknown as { setupState: Record<string, any> }).setupState
  const row: Record<string, unknown> = { sourceStockId: '1', targetStockId: 'old', targetBinCode: 'old' }
  state.sourceSelected(row, { materialId: '9', batchNo: ' 000L ' }, '7')
  expect(row).toMatchObject({ materialId: '9', batchNo: ' 000L ', unitId: '7', targetStockId: null })
  state.targetSelected(row, { binCode: ' 000B ' }); expect(row.targetBinCode).toBe(' 000B ')
  row.targetStockId = '2'; state.targetWarehouseChanged(row)
  expect(row.targetStockId).toBeNull(); expect(row.targetBinCode).toBeNull()
})

it('opens either linked document identity only with query permission and watches later links', async() => {
  mocks.query = { documentId: '9007199254740999' }
  setup(true); await flushPromises()
  expect(mocks.open).toHaveBeenCalledWith({ id: '9007199254740999' })
  const state = (wrapper!.vm.$ as unknown as { setupState: Record<string, any> }).setupState
  state.route.query.documentId = '9007199254740998'; await flushPromises()
  expect(mocks.open).toHaveBeenLastCalledWith({ id: '9007199254740998' })
  wrapper!.unmount(); mocks.open.mockClear(); setup(false); await flushPromises()
  expect(mocks.open).not.toHaveBeenCalled()
})
it('uses the canonical outbound id after an inbound deep link and rejects a late previous-factory pair', async() => {
  const { aggregate, auth } = setup(true)
  const pair = { outbound: { document: { id: '10' }, lines: [] }, inbound: { document: { id: '11' }, lines: [] }}
  mocks.request.mockResolvedValueOnce(pair)
  expect((await aggregate.detail('11')).header.id).toBe('10')
  const state = (wrapper!.vm.$ as unknown as { setupState: Record<string, any> }).setupState
  expect(state.currentId).toBe('10')
  let release!: (value: unknown) => void
  mocks.request.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
  const pending = aggregate.detail('11'); auth.factoryId = 'B'; release(pair)
  await expect(pending).rejects.toThrow('上下文已变化'); expect(state.currentId).toBe('')
})
