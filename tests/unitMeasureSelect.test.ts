// Component interaction with mocked transport; no database writes.
import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import UnitSelect from '../src/components/business/material/UnitMeasureSelect.vue'
import { useAuth } from '../src/stores/auth'
const calls = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn() }))
vi.mock('../src/api/basic/unitMeasure', () => ({ api: calls }))
let wrapper: ReturnType<typeof mount>
afterEach(() => { wrapper?.unmount(); vi.resetAllMocks(); vi.unstubAllGlobals(); document.body.innerHTML = '' })
async function setup(disabled = false) {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  const pinia = createPinia(), auth = useAuth(pinia)
  auth.factoryId = 'A'; auth.factoryPermissions = ['business:unit:measure:list', 'business:unit:measure:query']
  calls.list.mockResolvedValue({ items: [{ id: '1', code: '02', name: 'PCS' }], total: 21 })
  calls.detail.mockResolvedValue({ id: '1', code: '02', name: 'PCS' })
  wrapper = mount(UnitSelect, { props: { modelValue: '1', disabled }, global: { plugins: [pinia, ElementPlus] }})
  await flushPromises(); return auth
}
it('shows a disabled unit as text without querying candidates or displaying pagination', async() => {
  await setup(true)
  expect(wrapper.text()).toContain('02 · PCS')
  expect(wrapper.findComponent({ name: 'ElSelect' }).exists()).toBe(false)
  expect(wrapper.text()).not.toContain('加载更多')
  expect(calls.list).not.toHaveBeenCalled()
})
it('keeps pagination inside the dropdown and retains the search term', async() => {
  await setup()
  const select = wrapper.findComponent({ name: 'ElSelect' })
  await select.find('.el-select__wrapper').trigger('click'); await flushPromises()
  vi.useFakeTimers()
  select.props('remoteMethod')('件'); await vi.advanceTimersByTimeAsync(300); await flushPromises()
  vi.useRealTimers()
  const footer = document.querySelector('.el-select-dropdown__footer')!
  expect(footer?.textContent).toContain('加载更多')
  ;(footer.querySelector('button') as HTMLButtonElement).click(); await flushPromises()
  expect(calls.list).toHaveBeenLastCalledWith({ name: '件', offset: 1, limit: 20 })
})
it('discards late unit hydration after changing factory', async() => {
  const auth = await setup(true)
  let done!: (value: unknown) => void
  calls.detail.mockImplementationOnce(() => new Promise(resolve => { done = resolve }))
  await wrapper.setProps({ modelValue: '2' }); auth.factoryId = 'B'; await flushPromises()
  done({ id: '2', code: 'OLD', name: '旧工厂单位' }); await flushPromises()
  expect(wrapper.text()).not.toContain('旧工厂单位')
})
