import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus, { ElSelect, ElMessageBox } from 'element-plus'
import { useAuth } from '../src/stores/auth'
import Panel from '../src/components/business/production/OperatorConfiguration.vue'
const config = vi.hoisted(() => ({ users: vi.fn(), candidates: vi.fn(), nodes: vi.fn(), bind: vi.fn() }))
const assignment = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn() }))
vi.mock('../src/api/production/operatorConfiguration', () => ({ operatorConfiguration: config }))
vi.mock('../src/api/production/mesExecutionAssignment', () => ({ api: assignment }))
vi.mock('../src/api/production/mesOperationUser', () => ({ api: { list: vi.fn() } }))
const wrappers: ReturnType<typeof mount>[] = []
beforeEach(() => {
 vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
 vi.resetAllMocks()
 config.users.mockResolvedValue({ items: [{ id: '9007199254740993', name: '张三' }, { id: '2', name: '李四' }], total: 2 })
 config.nodes.mockResolvedValue({ status: 'READY', nodes: [{ id: '11', operationId: '7', code: 'N1', name: '钻孔' }, { id: '12', operationId: '7', code: 'N2', name: '钻孔' }] })
 config.candidates.mockResolvedValue({ items: [{ id: '9007199254740993', name: '张三' }, { id: '2', name: '李四' }], hasMore: false, nextOffset: 2 })
 config.bind.mockResolvedValue(undefined); assignment.create.mockResolvedValue({})
})
afterEach(() => { wrappers.forEach(w => w.unmount()); wrappers.length = 0; document.body.innerHTML = ''; vi.restoreAllMocks() })
function setup(execution = false, actions = ['list', 'create', 'delete']) {
 const pinia = createPinia(), auth = useAuth(pinia), prefix = execution ? 'business:mes:execution:assignment' : 'business:mes:operation:user'
 auth.factoryId = 'A'; auth.factoryPermissions = actions.map(a => prefix + ':' + a)
 const wrapper = mount(Panel, { props: execution ? { executionId: '9007199254740995' } : { operationId: '9007199254740994' }, global: { plugins: [pinia, ElementPlus], stubs: { CrudPage: { name: 'CrudPage', props: ['fixedValues', 'permission', 'managedEditing', 'readonly'], template: '<section>配置列表</section>' } } } })
 wrappers.push(wrapper)
 return { wrapper, auth }
}
async function open(wrapper: ReturnType<typeof mount>) { await wrapper.find('button').trigger('click'); await flushPromises() }
async function select(wrapper: ReturnType<typeof mount>, index: number, value: unknown) {
 wrapper.findAllComponents(ElSelect)[index].vm.$emit('update:modelValue', value)
 wrapper.findAllComponents(ElSelect)[index].vm.$emit('change', value)
 await flushPromises()
}
async function click(text: string) { const button = [...document.body.querySelectorAll('button')].find(b => b.textContent?.trim() === text); expect(button).toBeTruthy(); button!.click(); await flushPromises() }
describe('production operator configuration', () => {
 it('read-only grant exposes list without mutation controls; no grant hides entry', async() => {
  const { wrapper, auth } = setup(false, ['list']); await open(wrapper)
  expect(document.body.textContent).toContain('配置列表'); expect(document.body.textContent).not.toContain('批量增加能力')
  auth.factoryPermissions = []; await flushPromises(); expect(wrapper.find('button').exists()).toBe(false)
 })
 it('bulk capability uses exact string IDs and explicit operation context', async() => {
  const { wrapper } = setup(); await open(wrapper); await select(wrapper, 0, ['9007199254740993', '2']); await click('批量增加能力')
  expect(config.bind).toHaveBeenCalledWith('9007199254740994', ['9007199254740993', '2'])
  expect(wrapper.findComponent({ name: 'CrudPage' }).props('fixedValues')).toEqual({ operationId: '9007199254740994' })
 })
 it('uses one remote nickname selector and preserves choices across searches', async() => {
  const { wrapper } = setup(); await open(wrapper)
  expect(document.body.querySelector('[aria-label="搜索能力人员"]')).toBeNull()
  const picker = wrapper.findComponent(ElSelect)
  expect(picker.props('remote')).toBe(true)
  await select(wrapper, 0, ['9007199254740993'])
  config.users.mockResolvedValueOnce({ items: [{ id: '2', name: '李四' }], total: 1 })
  picker.props('remoteMethod')!('李'); await flushPromises()
  expect(config.users).toHaveBeenLastCalledWith('李', 0)
  expect(picker.props('modelValue')).toEqual(['9007199254740993'])
  expect(document.body.textContent).toContain('张三')
  await select(wrapper, 0, ['9007199254740993', '2']); await click('批量增加能力')
  expect(config.bind).toHaveBeenCalledWith('9007199254740994', ['9007199254740993', '2'])
 })
 it('ignores a late result from an older nickname query', async() => {
  const { wrapper } = setup(); await open(wrapper)
  const pending: ((value: unknown) => void)[] = []
  config.users.mockImplementation(() => new Promise(resolve => { pending.push(resolve) }))
  const search = wrapper.findComponent(ElSelect).props('remoteMethod')!
  search('旧'); search('新')
  pending[1]!({ items: [{ id: '3', name: '新结果' }], total: 1 }); await flushPromises()
  pending[0]!({ items: [{ id: '4', name: '旧结果' }], total: 1 }); await flushPromises()
  expect(document.body.textContent).toContain('新结果')
  expect(document.body.textContent).not.toContain('旧结果')
 })
 it('loads the next page and allows choosing people from both pages', async() => {
  config.users.mockResolvedValueOnce({ items: [{ id: '1', name: '张一' }], total: 2 })
  const { wrapper } = setup(); await open(wrapper)
  config.users.mockResolvedValueOnce({ items: [{ id: '2', name: '张二' }], total: 2 })
  await click('加载更多匹配人员')
  expect(config.users).toHaveBeenLastCalledWith('', 1)
  await select(wrapper, 0, ['1', '2'])
  expect(wrapper.findComponent(ElSelect).props('modelValue')).toEqual(['1', '2'])
 })
 it('same operation in two nodes uses actual node identity and can add more than one person', async() => {
  const { wrapper } = setup(true); await open(wrapper); await select(wrapper, 0, '12')
  expect(config.candidates).toHaveBeenCalledWith('7', 0)
  await select(wrapper, 1, ['9007199254740993']); await click('增加派工')
  await select(wrapper, 1, ['2']); await click('增加派工')
  expect(assignment.create).toHaveBeenNthCalledWith(1, { executionId: '9007199254740995', routingNodeId: '12', userId: '9007199254740993', remark: null })
  expect(assignment.create).toHaveBeenNthCalledWith(2, { executionId: '9007199254740995', routingNodeId: '12', userId: '2', remark: null })
  expect(wrapper.findComponent({ name: 'CrudPage' }).props('fixedValues')).toEqual({ executionId: '9007199254740995', routingNodeId: '12' })
 })
 it('terminal execution hides add controls', async() => {
  config.nodes.mockResolvedValue({ status: 'COMPLETED', nodes: [{ id: '11', operationId: '7', code: 'N1', name: '钻孔' }] })
  const { wrapper } = setup(true); await open(wrapper); await select(wrapper, 0, '11')
  expect(document.body.textContent).not.toContain('增加派工'); expect(assignment.create).not.toHaveBeenCalled()
 })
 it('factory change rejects late candidate results and closes configuration', async() => {
  let release!: (v: unknown) => void
  config.users.mockImplementation(() => new Promise(r => { release = r }))
  const { wrapper, auth } = setup(); await open(wrapper); auth.factoryId = 'B'; auth.revision++; await flushPromises()
  release({ items: [{ id: '1', name: '过期候选' }], total: 1 }); await flushPromises()
  expect(document.body.textContent).not.toContain('过期候选'); expect(wrapper.findComponent({ name: 'CrudPage' }).exists()).toBe(false)
 })
 it('error is visible and retry reads current directory', async() => {
  config.users.mockRejectedValueOnce(new Error('人员读取失败'))
  const { wrapper } = setup(); await open(wrapper); expect(document.body.textContent).toContain('人员读取失败')
  await click('重新检索'); expect(config.users).toHaveBeenCalledTimes(2)
 })
 it('a stale close confirmation cannot close a new factory dialog', async() => {
  let accept!: () => void
  vi.spyOn(ElMessageBox, 'confirm').mockImplementation(() => new Promise(resolve => { accept = () => resolve('confirm' as never) }))
  const { wrapper, auth } = setup(); await open(wrapper); await select(wrapper, 0, ['2'])
  document.body.querySelector<HTMLButtonElement>('.el-dialog__headerbtn')!.click(); await flushPromises()
  auth.factoryId = 'B'; auth.revision++; await flushPromises(); await open(wrapper)
  accept(); await flushPromises()
  expect(wrapper.findComponent({ name: 'CrudPage' }).exists()).toBe(true)
 })
 it('shows the current context and explains an empty eligible candidate list', async() => {
  config.candidates.mockResolvedValue({ items: [], hasMore: false, nextOffset: 0 })
  const { wrapper } = setup(true); await wrapper.setProps({ contextLabel: '9007199254740995' }); await open(wrapper); await select(wrapper, 0, '11')
  expect(document.body.textContent).toContain('生产执行：9007199254740995')
  expect(document.body.textContent).toContain('该工序暂无可派工人员，请配置此工序人员能力')
  expect(assignment.create).not.toHaveBeenCalled()
 })
 it('configures the selected node operation inline and refreshes assignment candidates after saving', async() => {
  const { wrapper } = setup(true)
  useAuth().factoryPermissions.push('business:mes:operation:user:list', 'business:mes:operation:user:create')
  await open(wrapper); await select(wrapper, 0, '12'); await click('配置此工序人员能力')
  const child = wrapper.findAllComponents(Panel).find(panel => panel.props('operationId') === '7')!
  expect(child.props('operationId')).toBe('7')
  await select(child, 0, ['2']); await click('批量增加能力')
  expect(config.bind).toHaveBeenCalledWith('7', ['2'])
  expect(config.candidates).toHaveBeenCalledTimes(2)
  expect(config.candidates).toHaveBeenLastCalledWith('7', 0)
  expect(assignment.create).not.toHaveBeenCalled()
 })
 it('missing operation snapshots display an explicit unknown label instead of null', async() => {
  config.nodes.mockResolvedValue({ status: 'READY', nodes: [{ id: '11', operationId: '7', code: 'N1', name: null }] })
  const { wrapper } = setup(true); await open(wrapper)
  await wrapper.findAllComponents(ElSelect)[0].find('.el-select__wrapper').trigger('click'); await flushPromises()
  expect(document.body.textContent).toContain('N1 · 工序名称未记录（节点 11）')
  expect(document.body.textContent).not.toContain('N1 · null')
 })
 it('closing with unsaved choices asks before discarding and cancel preserves edit', async() => {
  const confirm = vi.spyOn(ElMessageBox, 'confirm').mockRejectedValue('cancel')
  const { wrapper } = setup(); await open(wrapper); await select(wrapper, 0, ['2'])
  const close = document.body.querySelector<HTMLButtonElement>('.el-dialog__headerbtn'); expect(close).toBeTruthy(); close!.click(); await flushPromises()
  expect(confirm).toHaveBeenCalled(); expect(wrapper.findComponent({ name: 'CrudPage' }).exists()).toBe(true)
 })
})
