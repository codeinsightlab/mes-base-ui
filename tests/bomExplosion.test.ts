// TEST ONLY: mounted readonly page with explicit backend response fixtures.
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import Page from '../src/views/basic/bomExplosion/index.vue'
import { useAuth } from '../src/stores/auth'
import { ApiError } from '../src/lib/request'
import type { Explosion, ExplosionNode } from '../src/api/basic/bomExplosion'
import { invalidateQuantityRules } from '../src/lib/production/quantityRuleInvalidation'
const calls = vi.hoisted(() => ({ explodeBom: vi.fn(), material: vi.fn(), unit: vi.fn() }))
vi.mock('../src/api/basic/bomExplosion', () => ({ explodeBom: calls.explodeBom }))
vi.mock('../src/api/basic/material', () => ({ api: { detail: calls.material }}))
vi.mock('../src/api/basic/unitMeasure', () => ({ api: { detail: calls.unit }}))
const version = { id: '9007199254740993', code: 'BOM-A', version: 'V3', status: 'DRAFT', baseQty: '2', unitId: 'U', defaultVersion: true }
const node = (path: string, overrides = {}): ExplosionNode => ({ path, level: 1, lineId: path, parentBomId: version.id, parentBomVersion: 'V3', materialId: 'C', code: 'C', name: '重复叶料', unitId: 'U', unitName: 'kg', componentQty: '3.123456', baseQty: '2', quantity: '4.500001', childBomId: null, leaf: true, children: [], ...overrides })
function response(overrides: Partial<Explosion> = {}): Explosion {
  return { material: { id: '9007199254740995', code: '000A', name: '顶层产物', unitId: 'U', status: 'ENABLED' }, outputQty: '1', selectedVersion: version, versions: { items: [version], total: 1, offset: 0, limit: 20 }, selectionRequired: false, complete: true,
    items: [node('/11', { materialId: 'B', code: 'B', name: '子件B', childBomId: 'BOM-B', leaf: false, children: [node('/11/13', { level: 2 })] }), node('/12', { children: [node('/12/14', { level: 2, quantity: '4.5' })], leaf: false, childBomId: 'BOM-C' })],
    totals: [{ materialId: 'C', code: 'C', name: '重复叶料', unitId: 'U', unitName: 'kg', quantity: '9.000001', paths: ['/11/13', '/12/14'] }], problems: [], ...overrides }
}
let w: ReturnType<typeof mount>
beforeEach(() => { vi.resetAllMocks(); invalidateQuantityRules(); calls.material.mockResolvedValue({ unitId: 'U' }); calls.unit.mockResolvedValue({ name: 'kg', mustBeWholeNumber: 0, quantityPrecision: 6 }); calls.explodeBom.mockResolvedValue(response()); vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }) })
afterEach(() => { w?.unmount(); document.body.innerHTML = '' })
function setup(permissions = ['business:material:query', 'business:unit:measure:query']) {
  const pinia = createPinia(), auth = useAuth(pinia); auth.factoryId = 'F'; auth.factoryPermissions = permissions
  w = mount(Page, { attachTo: document.body, global: { plugins: [pinia, ElementPlus] }}); return auth
}
const button = (name: string) => w.findAll('button').find(b => b.text() === name)!
async function search() { await w.get('input[aria-label="完整物料编码"]').setValue('000A'); await w.get('form').trigger('submit'); await flushPromises() }
it('queries the exact code and presents real version, paths, levels, ratios and server totals', async() => {
  setup(); await search()
  expect(calls.explodeBom).toHaveBeenCalledWith({ materialCode: '000A', quantity: '1', versionOffset: 0, versionLimit: 20 })
  expect(w.text()).toContain('BOM展开完成'); expect(w.text()).toContain('BOM-A · V3 · DRAFT')
  expect(w.find('section[aria-label="BOM版本候选"]').exists()).toBe(false)
  await button('展开全部层级').trigger('click'); await flushPromises()
  for (const value of ['/11/13', '/12/14', '3.123456', '4.500001', '9.000001']) expect(w.text()).toContain(value)
  expect(calls.explodeBom).toHaveBeenCalledTimes(1)
  expect(w.findAll('button').some(b => /保存|入库|领料|报工/.test(b.text()))).toBe(false)
})
it('requires a root version choice and never guesses a default or newest version', async() => {
  calls.explodeBom.mockResolvedValueOnce(response({ selectedVersion: null, selectionRequired: true, complete: false, items: [], totals: [], versions: { items: [version, { ...version, id: 'other', defaultVersion: false }], total: 21, offset: 0, limit: 20 }, problems: [{ path: '', bomId: null, lineId: null, errorCode: 'MATERIAL_BOM_AMBIGUOUS', message: 'BOM版本有歧义' }] }))
  setup(); await search()
  expect(w.text()).toContain('待选择BOM版本'); expect(w.text()).not.toContain('BOM展开完成')
  expect(w.find('section[aria-label="BOM版本候选"]').exists()).toBe(true)
  expect(calls.explodeBom).toHaveBeenCalledTimes(1)
  await button('以此版本展开').trigger('click'); await flushPromises()
  expect(calls.explodeBom).toHaveBeenLastCalledWith({ materialCode: '000A', quantity: '1', bomId: version.id, versionOffset: 0, versionLimit: 20 })
})
it('pages version candidates through the real server paging parameters', async() => {
  calls.explodeBom.mockResolvedValue(response({ selectedVersion: null, selectionRequired: true, complete: false, versions: { items: [version], total: 22, offset: 0, limit: 20 }}))
  setup(); await search(); await w.get('.btn-next').trigger('click'); await flushPromises()
  expect(calls.explodeBom).toHaveBeenLastCalledWith({ materialCode: '000A', quantity: '1', versionOffset: 20, versionLimit: 20 })
})
it.each(['MATERIAL_BOM_MISSING', 'MATERIAL_BOM_CYCLE'])('shows %s without treating the blocked branch as a leaf or full demand', async(errorCode) => {
  calls.explodeBom.mockResolvedValue(response({ complete: false, problems: [{ path: '/11', bomId: 'BOM-B', lineId: '11', errorCode, message: '该分支无法展开' }], items: [node('/11', { leaf: false, childBomId: 'BOM-B' }), node('/12')] }))
  setup(); await search()
  expect(w.text()).toContain(errorCode); expect(w.text()).toContain('BOM展开受阻')
  expect(w.text()).toContain('已解析叶项需求（不完整）'); expect(w.text()).not.toContain('BOM展开完成')
  const blocked = w.get('section[aria-label="BOM逐层需求"]').findAll('tbody tr').find(row => row.text().includes('/11'))!
  expect(blocked.text()).toContain('展开受阻')
  expect(w.text()).toContain('9.000001')
})
it('refuses a success label when the response contains contradictory completion and blocking flags', async() => {
  calls.explodeBom.mockResolvedValue(response({ complete: true, selectionRequired: true }))
  setup(); await search(); expect(w.text()).not.toContain('BOM展开完成')
})
it('invalidates the displayed result on quantity edits and sends exact decimal strings with the selected version', async() => {
  setup(); await search(); await w.get('input[aria-label="预计产出数量"]').setValue('123456789012.123456'); await flushPromises()
  expect(w.text()).not.toContain('BOM展开完成')
  await button('按当前数量展开').trigger('click'); await flushPromises()
  expect(calls.explodeBom.mock.calls.at(-1)![0]).toMatchObject({ bomId: version.id, quantity: '123456789012.123456' })
})
it('keeps transport errors distinct from a missing BOM or completed query', async() => {
  calls.explodeBom.mockRejectedValueOnce(Error('服务未部署该查询'))
  setup(); await search(); expect(w.text()).toContain('服务未部署该查询'); expect(w.text()).not.toContain('BOM展开完成')
  await button('重试BOM查询').trigger('click'); await flushPromises(); expect(w.text()).toContain('BOM展开完成')
})
it('rejects a response for a different material code', async() => {
  calls.explodeBom.mockResolvedValue(response({ material: { ...response().material, code: 'other' }}))
  setup(); await search(); expect(w.text()).toContain('返回物料编码与查询不一致'); expect(w.text()).not.toContain('BOM展开完成')
})
it('disables unauthorized queries and clears data when permission is revoked', async() => {
  const auth = setup([]); await search(); expect(calls.explodeBom).not.toHaveBeenCalled()
  auth.factoryPermissions = ['business:material:query']; await flushPromises(); await search(); expect(w.text()).toContain('BOM展开完成')
  auth.factoryPermissions = []; await flushPromises(); expect(w.text()).not.toContain('9.000001')
})
it('rejects late responses after code changes, factory switches and unmount', async() => {
  let release!: (value: Explosion) => void
  calls.explodeBom.mockReturnValueOnce(new Promise(resolve => { release = resolve }))
  const auth = setup(); await search()
  await w.get('input[aria-label="完整物料编码"]').setValue('OTHER')
  auth.factoryId = 'NEW'; await flushPromises()
  release(response()); await flushPromises()
  expect(w.text()).not.toContain('9.000001'); expect(w.text()).not.toContain('BOM展开完成')
  w.unmount()
})

it('does not call a material without a root BOM a completed leaf expansion', async() => {
  calls.explodeBom.mockResolvedValue(response({ selectedVersion: null, complete: false, items: [], totals: [], versions: { items: [], total: 0, offset: 0, limit: 20 }, problems: [{ path: '', bomId: null, lineId: null, errorCode: 'MATERIAL_BOM_MISSING', message: '缺少根BOM' }] }))
  setup(); await search()
  expect(w.text()).toContain('缺少根BOM')
  expect(w.text()).toContain('BOM展开受阻')
  expect(w.text()).not.toContain('BOM展开完成')
})

it('keeps version selection and paging usable with only material query permission', async() => {
  calls.explodeBom.mockResolvedValueOnce(response({ selectedVersion: null, selectionRequired: true, complete: false,
    versions: { items: [version], total: 22, offset: 0, limit: 20 }, items: [], totals: [],
    problems: [{ path: '', bomId: null, lineId: null, errorCode: 'MATERIAL_BOM_AMBIGUOUS', message: '请选择版本' }] }))
  setup(['business:material:query']); await search()
  expect(button('以此版本展开').attributes('disabled')).toBeUndefined()
  expect(w.get('.btn-next').attributes('disabled')).toBeUndefined()
  expect(button('按当前数量展开').attributes('disabled')).toBeDefined()
  expect(calls.unit).not.toHaveBeenCalled()
  expect(calls.material).not.toHaveBeenCalled()
  await button('以此版本展开').trigger('click'); await flushPromises()
  expect(calls.explodeBom).toHaveBeenLastCalledWith({ materialCode: '000A', quantity: '1', bomId: version.id, versionOffset: 0, versionLimit: 20 })
  expect(w.text()).toContain('BOM展开完成')
})
it('retains the known tree and totals when version paging fails and retries the exact page', async() => {
  calls.explodeBom.mockResolvedValueOnce(response({ versions: { items: [version], total: 22, offset: 0, limit: 20 }}))
  setup(); await search()
  calls.explodeBom.mockRejectedValueOnce(Error('版本读取中断'))
  await w.get('.btn-next').trigger('click'); await flushPromises()
  expect(w.text()).toContain('版本读取中断')
  expect(w.text()).toContain('9.000001')
  expect(w.get('section[aria-label="BOM逐层需求"]').text()).toContain('子件B')
  expect(w.find('section[aria-label="BOM版本候选"] [role="alert"]').exists()).toBe(true)
  const failed = calls.explodeBom.mock.calls.at(-1)![0]
  await button('重试版本候选').trigger('click'); await flushPromises()
  expect(calls.explodeBom).toHaveBeenLastCalledWith(failed)
  expect(failed).toMatchObject({ bomId: version.id, quantity: '1', versionOffset: 20 })
  expect(w.text()).not.toContain('版本读取中断')
})
it('uses real table expansion and collapse to show and hide deep material paths', async() => {
  setup(); await search()
  const tree = () => w.get('section[aria-label="BOM逐层需求"]')
  await button('收起层级').trigger('click'); await flushPromises()
  expect(tree().findAll('tbody tr').filter(row => row.text().includes('/11/13')).some(row => row.isVisible())).toBe(false)
  await button('展开全部层级').trigger('click'); await flushPromises()
  expect(tree().findAll('tbody tr').filter(row => row.text().includes('/11/13')).some(row => row.isVisible())).toBe(true)
  await tree().findAll('.el-table__expand-icon')[0]!.trigger('click'); await flushPromises()
  expect(tree().findAll('tbody tr').filter(row => row.text().includes('/11/13')).some(row => row.isVisible())).toBe(false)
})
it.each(['factory', 'permission', 'identity', 'switching', 'unmount'])('independently rejects a late result after %s changes', async mode => {
  let release!: (value: Explosion) => void
  calls.explodeBom.mockReturnValueOnce(new Promise(resolve => { release = resolve }))
  const auth = setup(); await search()
  if (mode === 'factory') auth.factoryId = 'NEW'
  else if (mode === 'permission') auth.factoryPermissions = []
  else if (mode === 'identity') auth.userId = 'NEW-USER'
  else if (mode === 'switching') auth.factorySwitching = true
  else w.unmount()
  await flushPromises(); release(response()); await flushPromises()
  expect(w.text()).not.toContain('9.000001')
  expect(w.text()).not.toContain('BOM展开完成')
})
it('allows a newer code query while the old query is pending and protects its result from the old failure', async() => {
  let reject!: (error: Error) => void
  calls.explodeBom.mockReturnValueOnce(new Promise((_, failure) => { reject = failure }))
  setup(); await search()
  await w.get('input[aria-label="完整物料编码"]').setValue('OTHER')
  calls.explodeBom.mockResolvedValueOnce(response({ material: { ...response().material, code: 'OTHER', name: '新查询物料' }}))
  await w.get('form').trigger('submit'); await flushPromises()
  reject(Error('旧请求失败')); await flushPromises()
  expect(w.text()).toContain('新查询物料')
  expect(w.text()).not.toContain('旧请求失败')
})

it('clears all prior facts when the server denies a version-page read', async() => {
  calls.explodeBom.mockResolvedValueOnce(response({ versions: { items: [version], total: 22, offset: 0, limit: 20 }}))
  setup(); await search()
  calls.explodeBom.mockRejectedValueOnce(new ApiError('FORBIDDEN', '查询权限已撤回', '', 403))
  await w.get('.btn-next').trigger('click'); await flushPromises()
  expect(w.text()).toContain('查询权限已撤回')
  expect(w.text()).not.toContain('9.000001')
  expect(w.text()).not.toContain('顶层产物')
  expect(w.find('section[aria-label="BOM逐层需求"]').exists()).toBe(false)
})
