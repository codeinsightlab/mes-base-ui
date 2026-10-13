// TEST ONLY: component confirmation/error/permission contract; no database or ERP.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { useAuth } from '../src/stores/auth'
import Button from '../src/components/business/SyncButton.vue'
const sync = vi.fn<() => Promise<{ fetched: number; created: number; updated: number; skipped: number }>>()
import { ElMessage, ElMessageBox } from 'element-plus'
import type { MessageBoxData } from 'element-plus'
vi.mock('element-plus', () => ({ ElMessage: { success: vi.fn(), error: vi.fn() }, ElMessageBox: { confirm: vi.fn() }}))
afterEach(() => vi.resetAllMocks())
function page(permission = true) {
  const pinia = createPinia(), auth = useAuth(pinia)
  auth.factoryPermissions = permission ? ['business:material:sync'] : ['business:material:create']
  const wrapper = mount(Button, { props: { permission: 'business:material:sync', scope: 'factory', run: sync }, global: { plugins: [pinia], stubs: { ElButton: { template: '<button @click="$emit(\'click\')"><slot /></button>' }}}})
  return { wrapper, auth }
}
describe('Shared synchronization button', () => {
  it('create permission alone does not expose sync', () => {
    const { wrapper } = page(false)
    expect(wrapper.find('button').exists()).toBe(false)
    wrapper.unmount()
  })
  it('confirms, reports counts and refreshes only after success', async() => {
    vi.mocked(ElMessageBox.confirm).mockResolvedValue('confirm' as MessageBoxData)
    vi.mocked(sync).mockResolvedValue({ fetched: 2, created: 1, updated: 1, skipped: 0 })
    const { wrapper } = page()
    await wrapper.find('button').trigger('click'); await flushPromises()
    expect(ElMessageBox.confirm).toHaveBeenCalledOnce()
    expect(sync).toHaveBeenCalledOnce()
    expect(ElMessage.success).toHaveBeenCalledWith('获取 2 条，新增 1 条，更新 1 条，跳过 0 条')
    expect(wrapper.emitted('completed')).toHaveLength(1)
    wrapper.unmount()
  })
  it('does not request on cancellation or factory change during confirmation', async() => {
    vi.mocked(ElMessageBox.confirm).mockRejectedValueOnce('cancel')
    const { wrapper, auth } = page()
    await wrapper.find('button').trigger('click'); await flushPromises()
    expect(sync).not.toHaveBeenCalled()
    vi.mocked(ElMessageBox.confirm).mockImplementationOnce(async() => { auth.revision++; return 'confirm' as MessageBoxData })
    await wrapper.find('button').trigger('click'); await flushPromises()
    expect(sync).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('discards a late result after factory change', async() => {
    vi.mocked(ElMessageBox.confirm).mockResolvedValue('confirm' as MessageBoxData)
    let finish = () => {}
    vi.mocked(sync).mockImplementationOnce(() => new Promise(resolve => {
      finish = () => resolve({ fetched: 2, created: 2, updated: 0, skipped: 0 })
    }))
    const { wrapper, auth } = page()
    await wrapper.find('button').trigger('click'); await flushPromises()
    auth.revision++
    finish(); await flushPromises()
    expect(ElMessage.success).not.toHaveBeenCalled()
    expect(wrapper.emitted('completed')).toBeUndefined()
    wrapper.unmount()
  })
  it('shows the real configuration error without a success refresh', async() => {
    vi.mocked(ElMessageBox.confirm).mockResolvedValue('confirm' as MessageBoxData)
    vi.mocked(sync).mockRejectedValue(new Error('暂未接入 ERP 物料查询接口'))
    const { wrapper } = page()
    await wrapper.find('button').trigger('click'); await flushPromises()
    expect(ElMessage.error).toHaveBeenCalledWith('暂未接入 ERP 物料查询接口')
    expect(wrapper.emitted('completed')).toBeUndefined()
    wrapper.unmount()
  })
})
