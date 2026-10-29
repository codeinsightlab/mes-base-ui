import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import { useAuth } from '../src/stores/auth'
import Page from '../src/views/system/autocode/index.vue'

const api = vi.hoisted(() => ({ listRule: vi.fn(), getRuleDocument: vi.fn(), addRule: vi.fn(), updateRule: vi.fn(), delRule: vi.fn(), genCode: vi.fn(), previewCode: vi.fn() }))
vi.mock('../src/api/system/autocode/rule', () => api)
vi.mock('../src/api/system/datasource', () => ({ listFactories: vi.fn().mockResolvedValue({ rows: [], total: 0 }) }))
let wrapper: ReturnType<typeof mount>
let auth: ReturnType<typeof useAuth>
const result = () => ({ rule: { ruleId: '9007199254740999', ruleCode: 'QA', ruleName: '验收规则', ruleType: 'WORK_ORDER', factoryId: null, maxLength: 64, isPadded: 'N', enableFlag: 'Y' }, parts: [{ partId: '11', partType: 'FIXCHAR', fixCharacter: 'QA' }, { partType: 'NOWDATE' }, { partType: 'SERIALNO' }], prefixEditable: true, version: 'VERSION_1' })
beforeEach(async() => {
  vi.clearAllMocks()
  api.listRule.mockResolvedValue({ rows: [], total: 0 })
  api.addRule.mockResolvedValue({ data: result() })
  api.updateRule.mockResolvedValue({ data: result() })
  api.getRuleDocument.mockResolvedValue({ data: result() })
  api.previewCode.mockResolvedValue({ data: { code: 'QA20261029001' }})
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  const pinia = createPinia(); auth = useAuth(pinia)
  wrapper = mount(Page, { global: {
    plugins: [pinia, ElementPlus], stubs: { PageHeader: true, RightToolbar: true, Pagination: true, RouterLink: true, DictTag: true },
    mocks: { dict: { type: { sys_yes_no: [{ value: 'Y', label: '是' }, { value: 'N', label: '否' }], sys_autocode_ruletype: [{ value: 'WORK_ORDER', label: '工单' }] }}, resetForm() {}, addDateRange: (query: unknown) => query, parseTime: String, $modal: { msgSuccess: vi.fn(), msgError: vi.fn(), confirm: vi.fn().mockRejectedValue('cancel') }}
  }}); await flushPromises()
})
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = ''; vi.unstubAllGlobals() })
function vm(): any { return wrapper.vm }
function grant() { auth.platformPermissions = ['system:autocode:rule:add', 'system:autocode:rule:edit', 'system:autocode:rule:query'] }

it('restores buttons reactively only to the currently authorized platform user', async() => {
  expect(wrapper.text()).not.toContain('新增')
  grant(); await flushPromises(); expect(wrapper.text()).toContain('新增')
  auth.platformPermissions = ['system:autocode:rule:list']; await flushPromises(); expect(wrapper.text()).not.toContain('新增')
})

it('creates the rule and prefix with one command, then opens preview without consuming a number', async() => {
  grant(); await flushPromises(); vm().handleAdd(); await flushPromises()
  Object.assign(vm().form, { ruleCode: 'QA', ruleName: '验收规则', ruleType: 'WORK_ORDER' }); vm().composition.prefix = 'QA'
  await vm().submitForm(); await flushPromises()
  expect(api.addRule).toHaveBeenCalledTimes(1)
  expect(api.addRule).toHaveBeenCalledWith({ rule: expect.objectContaining({ ruleCode: 'QA', maxLength: 64, factoryId: null }), prefix: 'QA', version: null })
  expect(vm().codeOpen).toBe(true)
  await vm().testCode(false)
  expect(api.previewCode).toHaveBeenCalledWith('QA', null)
  expect(api.genCode).not.toHaveBeenCalled()
})

it('edits the same rule using the server composition and version, keeping the dialog on errors', async() => {
  grant(); await flushPromises(); await vm().handleUpdate({ ruleId: '9007199254740999' }); await flushPromises()
  vm().form.ruleName = '修改名称'; vm().composition.prefix = 'QB'
  api.updateRule.mockRejectedValueOnce(new Error('规则或组成已被其他操作修改，请重新加载后保存'))
  await vm().submitForm(); await flushPromises()
  expect(api.updateRule).toHaveBeenCalledWith({ rule: expect.objectContaining({ ruleId: '9007199254740999', ruleName: '修改名称' }), prefix: 'QB', version: 'VERSION_1' })
  expect(vm().open).toBe(true); expect(vm().saveError).toContain('重新加载')
})

it('clears revoked or changed-context drafts and refuses a late detail response', async() => {
  grant(); await flushPromises()
  let finish!: (value: unknown) => void
  api.getRuleDocument.mockReturnValue(new Promise(resolve => { finish = resolve }))
  const pending = vm().handleUpdate({ ruleId: '9' })
  auth.revision++; await flushPromises(); finish({ data: result() }); await pending
  expect(vm().open).toBe(false); expect(vm().form.ruleId).toBeUndefined()
})

it('leaves advanced compositions untouched in the aggregate command', async() => {
  grant(); await flushPromises(); const advanced = { ...result(), prefixEditable: false }
  api.getRuleDocument.mockResolvedValueOnce({ data: advanced })
  await vm().handleUpdate({ ruleId: advanced.rule.ruleId }); await flushPromises()
  await vm().submitForm(); await flushPromises()
  expect(api.updateRule.mock.calls[0][0]).toMatchObject({ prefix: null, version: 'VERSION_1' })
})
