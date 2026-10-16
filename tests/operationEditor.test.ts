import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus, { ElSelect, ElMessageBox } from 'element-plus'
import Operation from '../src/views/production/operation/index.vue'
import { useAuth } from '../src/stores/auth'
const mocks = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn(), update: vi.fn(), users: vi.fn(), bind: vi.fn(), relations: vi.fn() }))
vi.mock('../src/api/production/operation', () => ({ api: { list: mocks.list, detail: mocks.detail, update: mocks.update } }))
vi.mock('../src/api/production/operatorConfiguration', () => ({ operatorConfiguration: { users: mocks.users, bind: mocks.bind } }))
vi.mock('../src/api/production/mesOperationUser', () => ({ api: { list: mocks.relations } }))
const row = { id: '9007199254740993', code: 'OP1', name: '检验', status: 'ENABLED', sort: 0, revision: 2 }
const wrappers: ReturnType<typeof mount>[] = []
beforeEach(() => {
 vi.resetAllMocks()
 vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
 mocks.list.mockResolvedValue({ items: [{ ...row }], total: 1 }); mocks.detail.mockResolvedValue({ ...row })
 mocks.update.mockResolvedValue({ ...row, revision: 3 })
 mocks.users.mockResolvedValue({ items: [{ id: '6087', name: '张三' }], total: 1 })
 mocks.relations.mockResolvedValue({ items: [], total: 0 }); mocks.bind.mockResolvedValue(undefined)
})
afterEach(() => { wrappers.forEach(w => w.unmount()); wrappers.length = 0; document.body.innerHTML = ''; vi.restoreAllMocks() })
async function setup(people = true, metadataWrite = true) {
 const pinia = createPinia(), auth = useAuth(pinia)
 auth.factoryId = 'A'; auth.factoryPermissions = ['operation:list', 'operation:query', ...(metadataWrite ? ['operation:update'] : []), 'operation:create', ...(people ? ['business:mes:operation:user:list', 'business:mes:operation:user:create'] : [])]
 const wrapper = mount(Operation, { attachTo: document.body, global: { plugins: [pinia, ElementPlus] } }); wrappers.push(wrapper)
 await flushPromises(); await wrapper.findAll('button').find(b => b.text() === '编辑')!.trigger('click'); await flushPromises()
 expect(document.querySelector('[role=tab][id$=information]')?.getAttribute('aria-selected')).toBe('true')
 document.querySelector<HTMLElement>('[role=tab][id$=people]')!.click(); await flushPromises()
 return { wrapper, auth }
}
async function click(label: string) { document.body.querySelectorAll('button').forEach(b => { if (b.textContent?.trim() === label) b.click() }); await flushPromises() }
describe('operation editor with operator capability', () => {
 it('has one edit entry with inline personnel and saves metadata without losing chosen people', async() => {
  const { wrapper } = await setup()
  expect(wrapper.findAll('button').some(b => b.text() === '可操作人员')).toBe(false)
  expect(document.body.textContent).toContain('可操作人员')
  const picker = wrapper.findComponent({ name: 'OperatorConfigurationPanel' }).findComponent(ElSelect)
  picker.vm.$emit('update:modelValue', ['6087']); await flushPromises()
  await click('保存工序信息')
  expect(mocks.update).toHaveBeenLastCalledWith(row.id, expect.objectContaining({ revision: 2 }))
  expect(picker.props('modelValue')).toEqual(['6087'])
  expect(document.querySelector('[role="dialog"][aria-label="编辑工序"]')).not.toBeNull()
  await click('保存工序信息')
  expect(mocks.update).toHaveBeenLastCalledWith(row.id, expect.objectContaining({ revision: 3 }))
  await click('批量增加能力'); expect(mocks.bind).toHaveBeenCalledWith(row.id, ['6087'])
 })
 it('asks before discarding pending personnel and keeps choices on cancel', async() => {
  const { wrapper } = await setup()
  const picker = wrapper.findComponent({ name: 'OperatorConfigurationPanel' }).findComponent(ElSelect)
  picker.vm.$emit('update:modelValue', ['6087']); await flushPromises()
  const confirm = vi.spyOn(ElMessageBox, 'confirm').mockRejectedValueOnce('cancel')
  await click('关闭'); expect(confirm).toHaveBeenCalled(); expect(picker.props('modelValue')).toEqual(['6087'])
  confirm.mockResolvedValueOnce('confirm' as never); await click('关闭')
  expect(document.body.textContent).not.toContain('批量增加能力')
 })
 it('preserves personnel access without granting operation update', async() => {
  await setup(true, false)
  expect(mocks.users).toHaveBeenCalledOnce()
  await click('保存工序信息'); expect(mocks.update).not.toHaveBeenCalled()
  expect(document.body.textContent).toContain('批量增加能力')
 })
 it('does not fetch or expose personnel without its independent permission', async() => {
  await setup(false)
  expect(document.body.textContent).toContain('暂无查看工序能力人员的权限')
  expect(mocks.users).not.toHaveBeenCalled(); expect(mocks.relations).not.toHaveBeenCalled()
 })
 it('clears embedded personnel and rejects a late directory result after a factory switch', async() => {
  let release!: (value: unknown) => void
  mocks.users.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
  const { auth } = await setup(); auth.factoryId = 'B'; auth.revision++; await flushPromises()
  release({ items: [{ id: '8', name: '旧工厂迟到用户' }], total: 1 }); await flushPromises()
  expect(document.body.textContent).not.toContain('旧工厂迟到用户')
  expect(document.body.textContent).not.toContain('批量增加能力')
 })
})
