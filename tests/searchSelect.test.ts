// UI interaction with controlled data; no API access.
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import SearchSelect from '../src/components/SearchSelect.vue'
let wrapper: ReturnType<typeof mount>
beforeEach(() => { vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }) })
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = ''; vi.unstubAllGlobals() })
async function setup(props = {}) {
  wrapper = mount(SearchSelect, { attachTo: document.body, props: { options: [{ value: '1', label: '原材料仓' }], hasMore: true, ...props }, global: { plugins: [ElementPlus] }})
  await flushPromises()
}
it('keeps pagination in the dropdown, preserves focus on mousedown, and blocks duplicate loads while busy', async() => {
  await setup()
  expect(wrapper.text()).not.toContain('加载更多')
  await wrapper.find('.el-select__wrapper').trigger('click'); await flushPromises()
  const button = document.querySelector('.el-select-dropdown__footer button') as HTMLButtonElement
  const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
  button.dispatchEvent(event)
  expect(event.defaultPrevented).toBe(true)
  button.click(); await flushPromises()
  expect(wrapper.emitted('loadMore')).toHaveLength(1)
  await wrapper.setProps({ loading: true }); button.click()
  expect(wrapper.emitted('loadMore')).toHaveLength(1)
})
it('shows disabled values as text, retains the full title, and never displays pagination', async() => {
  const label = '编码 · 一个很长的名称 / 原材料仓库'
  await setup({ modelValue: '9007199254740993', disabled: true, selectedOption: { value: '9007199254740993', label }})
  expect(wrapper.text()).toBe(label)
  expect(wrapper.get('.search-select__text').attributes('title')).toBe(label)
  expect(wrapper.findComponent({ name: 'ElSelect' }).exists()).toBe(false)
  expect(wrapper.emitted('search')).toBeUndefined()
  await wrapper.setProps({ selectedOption: null })
  expect(wrapper.text()).toContain('待确认（9007199254740993）')
  await wrapper.setProps({ modelValue: null })
  expect(wrapper.text()).toBe('—')
})
it('shows query failure with retry inside the dropdown while keeping valid candidates visible', async() => {
  await setup({ error: '查询失败' })
  await wrapper.find('.el-select__wrapper').trigger('click'); await flushPromises()
  const footer = document.querySelector('.el-select-dropdown__footer')!
  expect(footer.textContent).toContain('查询失败')
  expect(footer.textContent).not.toContain('加载更多')
  expect(document.body.textContent).toContain('原材料仓')
  ;(footer.querySelector('button') as HTMLButtonElement).click()
  expect(wrapper.emitted('retry')).toHaveLength(1)
})
it('allows disabled detail display failures to be retried without enabling candidate selection', async() => {
  await setup({ modelValue: '1', options: [], disabled: true, resolveError: '名称读取失败' })
  expect(wrapper.text()).toContain('待确认（1）')
  await wrapper.get('button').trigger('click')
  expect(wrapper.emitted('resolveRetry')).toHaveLength(1)
  expect(wrapper.findComponent({ name: 'ElSelect' }).exists()).toBe(false)
})
