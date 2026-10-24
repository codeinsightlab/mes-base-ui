import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus, { ElMessageBox } from 'element-plus'
import Routing from '../src/views/production/routing/index.vue'
import { useAuth } from '../src/stores/auth'
const api = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn(), operations: vi.fn(), materials: vi.fn() }))
vi.mock('../src/api/production/routing', () => ({ api, sync: vi.fn() }))
const row = { id: '122', code: 'R1', name: '路线一', version: 1, status: 'DRAFT', revision: 0, description: null, publishedAt: '2026-10-15T08:04:48.696843' }
const detail = () => ({ routing: { ...row }, products: [], nodes: [], edges: [] })
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  vi.restoreAllMocks()
  api.list.mockReset().mockResolvedValue({ items: [row, { ...row, id: '120', publishedAt: '2026-10-13T15:53:58' }], total: 2 })
  api.detail.mockReset().mockImplementation(async() => detail())
  api.operations.mockResolvedValue([]); api.materials.mockResolvedValue([])
})
function setup() {
  const pinia = createPinia(), auth = useAuth(pinia)
  auth.factoryId = 'SIMPLE_B'; auth.factoryPermissions = ['routing:list', 'routing:query', 'routing:update']
  return { auth, wrapper: mount(Routing, { attachTo: document.body, global: { plugins: [pinia, ElementPlus] }}) }
}
describe('routing detail interactions', () => {
  it('shows current linked product identity when published snapshots are absent and never interpolates null', async() => {
    api.detail.mockResolvedValue({ ...detail(), routing: { ...row, status: 'PUBLISHED' }, products: [
      { id: '1', materialId: '19', materialCode: null, materialName: null, currentMaterialCode: 'P19', currentMaterialName: '当前关联产品' },
      { id: '2', materialId: '999', materialCode: 'OLD', materialName: '旧快照名称', currentMaterialCode: null, currentMaterialName: null }
    ] })
    const { wrapper } = setup(); await flushPromises()
    await wrapper.findAll('button').find(b => b.text() === '详情 / 工序')!.trigger('click'); await flushPromises()
    const text = document.body.textContent ?? ''
    expect(text).toContain('P19 · 当前关联产品')
    expect(text).toContain('品号待确认 · 名称待确认（物料ID 999）')
    expect(text).not.toContain('null')
    expect(text).not.toContain('旧快照名称')
    wrapper.unmount()
  })
  it('formats mixed timestamp precision and opens topology on demand without closing its parent', async() => {
    const { wrapper } = setup(); await flushPromises()
    expect(wrapper.text()).toContain('2026-10-15 08:04:48')
    expect(wrapper.text()).toContain('2026-10-13 15:53:58')
    expect(wrapper.text()).not.toContain('696843')
    await wrapper.findAll('button').find(b => b.text() === '详情 / 工序')!.trigger('click'); await flushPromises()
    const drawer = wrapper.findComponent({ name: 'ElDrawer' })
    expect(drawer.props('closeOnClickModal')).toBe(true)
    expect(document.querySelector('[aria-label="路线拓扑预览"]')).toBeNull()
    const graphButton = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === '查看拓扑')!
    graphButton.click(); await flushPromises()
    expect(document.querySelector('[aria-label="路线拓扑预览"]')).not.toBeNull()
    const graphDialog = wrapper.findAllComponents({ name: 'ElDialog' }).find(d => d.props('title') === '工艺路线拓扑')!
    graphDialog.vm.$emit('update:modelValue', false); await flushPromises()
    expect(drawer.props('modelValue')).toBe(true)
    wrapper.unmount()
  })
  it('keeps unsaved edits when dismissal is cancelled and allows confirmed dismissal', async() => {
    const { wrapper } = setup(); await flushPromises()
    await wrapper.findAll('button').find(b => b.text() === '详情 / 工序')!.trigger('click'); await flushPromises()
    const state = wrapper.vm as unknown as { metadata: { name: string }}
    state.metadata.name = '未保存名称'
    const drawer = wrapper.findComponent({ name: 'ElDrawer' }), done = vi.fn()
    const confirm = vi.spyOn(ElMessageBox, 'confirm').mockRejectedValueOnce('cancel')
    await drawer.props('beforeClose')(done)
    expect(done).not.toHaveBeenCalled(); expect(state.metadata.name).toBe('未保存名称')
    confirm.mockImplementationOnce(vi.fn().mockResolvedValue('confirm'))
    await drawer.props('beforeClose')(done)
    expect(done).toHaveBeenCalledOnce()
    wrapper.unmount()
  })
  it('rejects a late detail response once closing starts or factory changes', async() => {
    let release!: (value: ReturnType<typeof detail>) => void
    api.detail.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
    const { wrapper, auth } = setup(); await flushPromises()
    await wrapper.findAll('button').find(b => b.text() === '详情 / 工序')!.trigger('click')
    const drawer = wrapper.findComponent({ name: 'ElDrawer' })
    drawer.vm.$emit('update:modelValue', false); drawer.vm.$emit('close')
    release(detail()); await flushPromises()
    const state = wrapper.vm as unknown as { detail: unknown; graphDialog: boolean }
    expect(state.detail).toBeNull()
    await wrapper.findAll('button').find(b => b.text() === '详情 / 工序')!.trigger('click'); await flushPromises()
    state.graphDialog = true; auth.factoryId = 'OTHER'; auth.revision++; await flushPromises()
    expect(state.detail).toBeNull(); expect(state.graphDialog).toBe(false)
    wrapper.unmount()
  })
})
