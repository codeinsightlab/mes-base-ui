// UI interaction with controlled data; no API access.
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { defineComponent, nextTick, ref } from 'vue'
import QueryForm from '../src/components/QueryForm.vue'
import SearchSelect from '../src/components/SearchSelect.vue'
let wrapper: ReturnType<typeof mount>
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class {
    observe() {} unobserve() {} disconnect() {}
  })
})
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

async function setup(props = {}) {
  wrapper = mount(SearchSelect, { attachTo: document.body, props: { options: [{ value: '1', label: '原材料仓' }], ...props }, global: { plugins: [ElementPlus] }})
  await flushPromises()
}

it('shows at most 20 candidates and has no pagination footer', async() => {
  await setup({ options: Array.from({ length: 20 }, (_, i) => ({ value: String(i), label: 'Option ' + i })) })
  await wrapper.get('.el-select__wrapper').trigger('click')
  await flushPromises()
  expect(document.querySelectorAll('[role="option"]')).toHaveLength(20)
  expect(document.querySelector('.el-select-dropdown__footer')).toBeNull()
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
  await wrapper.find('.el-select__wrapper').trigger('click')
  await flushPromises()
  const footer = document.querySelector('.el-select-dropdown__footer')!
  expect(footer.textContent).toContain('查询失败')
  expect(footer.textContent).not.toContain('加载更多')
  expect(document.body.textContent).toContain('原材料仓')
  ;
  (footer.querySelector('button') as HTMLButtonElement).click()
  expect(wrapper.emitted('retry')).toHaveLength(1)
})
it('allows disabled detail display failures to be retried without enabling candidate selection', async() => {
  await setup({ modelValue: '1', options: [], disabled: true, resolveError: '名称读取失败' })
  expect(wrapper.text()).toContain('待确认（1）')
  await wrapper.get('button').trigger('click')
  expect(wrapper.emitted('resolveRetry')).toHaveLength(1)
  expect(wrapper.findComponent({ name: 'ElSelect' }).exists()).toBe(false)
})

async function setupQuery(disabled = false) {
  const Page = defineComponent({
    components: { QueryForm, SearchSelect },
    setup() {
      const value = ref<string | null>('1')
      const submit = vi.fn()
      const loading = ref(false)
      const options = ref([{ value: '1', label: '原材料仓' }])
      const selectedOption = { value: '1', label: '原材料仓' }
      return { value, submit, disabled, options, selectedOption, loading }
    },
    template: `<QueryForm @submit="submit">
      <SearchSelect v-model="value" :options="options" :selected-option="selectedOption" :loading="loading" />
      <button type="submit" :disabled="disabled">查询</button>
    </QueryForm>`
  })
  wrapper = mount(Page, { attachTo: document.body, global: { plugins: [ElementPlus] }})
  await flushPromises()
  return wrapper.vm as unknown as { value: string | null; loading: boolean; submit: ReturnType<typeof vi.fn>; options: { value: string; label: string }[] }
}

it('confirms the first enabled candidate on Enter, without submitting a query', async() => {
  await setup({ options: [{ value: '0', label: '停用仓', disabled: true }, { value: '1', label: '原材料仓' }] })
  await wrapper.get('input').trigger('keydown', { key: 'Enter', code: 'Enter' })
  expect(wrapper.emitted('update:modelValue')).toEqual([['1']])
})

it('uses the highlighted candidate when the dropdown is open', async() => {
  await setup({ options: [{ value: '1', label: '原材料仓' }, { value: '2', label: '成品仓' }] })
  await wrapper.find('.el-select__wrapper').trigger('click')
  await flushPromises()
  await wrapper.get('input').trigger('keydown', { key: 'ArrowDown', code: 'ArrowDown' })
  await wrapper.get('input').trigger('keydown', { key: 'Enter', code: 'Enter' })
  expect(wrapper.emitted('update:modelValue')).toEqual([['2']])
})

it('submits the containing query exactly once when already selected', async() => {
  const page = await setupQuery()
  await wrapper.get('input').trigger('keydown', { key: 'Enter', code: 'Enter' })
  expect(page.submit).toHaveBeenCalledTimes(1)
  expect(wrapper.findComponent(SearchSelect).emitted('update:modelValue')).toBeUndefined()
  await wrapper.get('input').trigger('keydown', { key: 'Enter', code: 'Enter', repeat: true })
  expect(page.submit).toHaveBeenCalledTimes(1)
})

it('does not submit for IME confirmation, disabled query buttons, or edit forms', async() => {
  const page = await setupQuery(true)
  await wrapper.get('input').trigger('keydown', { key: 'Enter', code: 'Enter' })
  expect(page.submit).not.toHaveBeenCalled()
  await wrapper.get('input').trigger('keydown', { key: 'Enter', code: 'Enter', isComposing: true })
  expect(page.submit).not.toHaveBeenCalled()
  wrapper.unmount()
  const submit = vi.fn()
  wrapper = mount(SearchSelect, { attachTo: document.body, props: { modelValue: '1', options: [{ value: '1', label: '仓库' }] }, global: { plugins: [ElementPlus] }})
  const form = document.createElement('form')
  document.body.append(form)
  form.append(wrapper.element)
  form.addEventListener('submit', submit)
  await wrapper.get('input').trigger('keydown', { key: 'Enter', code: 'Enter' })
  expect(submit).not.toHaveBeenCalled()
})

it('copies the selected display label and preserves native copying of typed text', async() => {
  await setup({ modelValue: '1' })
  const setData = vi.fn()
  const event = new Event('copy', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', { value: { setData }})
  wrapper.get('input').element.dispatchEvent(event)
  expect(setData).toHaveBeenCalledWith('text/plain', '原材料仓')
  expect(event.defaultPrevented).toBe(true)
  expect(wrapper.get('.search-select__label').attributes('title')).toBe('原材料仓')
  await wrapper.get('input').setValue('新关键词')
  const typingCopy = new Event('copy', { bubbles: true, cancelable: true })
  Object.defineProperty(typingCopy, 'clipboardData', { value: { setData }})
  wrapper.get('input').element.dispatchEvent(typingCopy)
  expect(setData).toHaveBeenCalledTimes(1)
  expect(typingCopy.defaultPrevented).toBe(false)
})

it('keeps Enter in selection mode while typing a replacement, excluding the pinned old selection', async() => {
  const page = await setupQuery()
  const select = wrapper.findComponent(SearchSelect)
  page.options = [{ value: '2', label: '新仓库' }]
  await wrapper.get('input').setValue('新')
  await flushPromises()
  await wrapper.get('input').trigger('keydown', { key: 'Enter', code: 'Enter' })
  expect(page.submit).not.toHaveBeenCalled()
  expect(select.emitted('update:modelValue')).toEqual([['2']])
  await flushPromises()
  await wrapper.get('input').trigger('keydown', { key: 'Enter', code: 'Enter' })
  expect(page.submit).toHaveBeenCalledTimes(1)
})

it('does not choose stale candidates while loading or confirming Chinese composition', async() => {
  await setup({ loading: true })
  await wrapper.find('.el-select__wrapper').trigger('click')
  await flushPromises()
  await wrapper.get('input').trigger('keydown', { key: 'Enter', code: 'Enter' })
  expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  await wrapper.get('input').setValue('changed')
  await wrapper.setProps({ loading: false })
  await wrapper.get('input').trigger('keydown', { key: 'Enter', code: 'Enter', isComposing: true })
  expect(wrapper.emitted('update:modelValue')).toBeUndefined()
})

it('preserves native input and deletion across capture/target microtask checkpoints', async() => {
  await setup({ modelValue: '1', options: [], selectedOption: { value: '1', label: '原材料仓' }})
  const input = wrapper.get('input').element as HTMLInputElement

  async function edit(value: string) {
    input.value = value
    // Native events may flush Vue between listeners; plain dispatchEvent does not.
    wrapper.element.addEventListener('input', (event: Event) => event.stopPropagation(), { capture: true, once: true })
    input.dispatchEvent(new InputEvent('input', { bubbles: true }))
    await nextTick()
    expect(input.value).toBe(value)
    input.dispatchEvent(new InputEvent('input', { bubbles: true }))
    await nextTick()
    expect(input.value).toBe(value)
  }

  await edit('3')
  await wrapper.setProps({ options: [{ value: '2', label: '新候选' }] })
  expect(input.value).toBe('3')
  await edit('34')
  await edit('3')
  await edit('')
  await edit('7')
  await edit('')
  expect(wrapper.emitted('update:modelValue')).toBeUndefined()
})

it('keeps an emptied search draft in selection mode until a candidate is confirmed', async() => {
  const page = await setupQuery()
  page.options = [{ value: '2', label: '新仓库' }]
  await wrapper.get('input').setValue('3')
  expect(page.value).toBe('1')
  await wrapper.get('input').setValue('')
  await wrapper.get('input').trigger('keydown', { key: 'Enter', code: 'Enter' })
  expect(page.submit).not.toHaveBeenCalled()
  expect(page.value).toBe('2')
  await wrapper.get('input').trigger('keydown', { key: 'Enter', code: 'Enter' })
  expect(page.submit).toHaveBeenCalledTimes(1)
})

it('cancels a search with one Escape and retains the committed value and keyboard focus', async() => {
  const page = await setupQuery()
  const input = wrapper.get('input')
  ;
  (input.element as HTMLInputElement).focus()
  await input.setValue('34')
  await input.trigger('keydown', { key: 'Escape', code: 'Escape' })
  await flushPromises()
  expect((input.element as HTMLInputElement).value).toBe('')
  expect(page.value).toBe('1')
  expect(document.activeElement).toBe(input.element)
  expect(page.submit).not.toHaveBeenCalled()
  await input.trigger('keydown', { key: 'Enter', code: 'Enter' })
  expect(page.submit).toHaveBeenCalledTimes(1)
})

it('discards an unconfirmed draft on blur without changing the selection or querying', async() => {
  const page = await setupQuery()
  const input = wrapper.get('input').element as HTMLInputElement
  input.focus()
  await wrapper.get('input').setValue('34')
  input.blur()
  await flushPromises()
  expect(input.value).toBe('')
  expect(page.value).toBe('1')
  expect(page.submit).not.toHaveBeenCalled()
  page.options = [{ value: '2', label: '迟到的候选' }]
  await nextTick()
  expect(input.value).toBe('')
  expect(wrapper.get('.search-select__label').text()).toBe('原材料仓')
})

it('clears both selection and draft permanently, rather than restoring them on cancel', async() => {
  const page = await setupQuery()
  const input = wrapper.get('input').element as HTMLInputElement
  input.focus()
  await wrapper.get('input').setValue('3')
  await wrapper.get('.el-select__clear').trigger('click')
  await flushPromises()
  expect(page.value).toBeNull()
  expect(input.value).toBe('')
  await wrapper.get('input').trigger('keydown', { key: 'Escape', code: 'Escape' })
  input.blur()
  await flushPromises()
  expect(page.value).toBeNull()
  expect(page.submit).not.toHaveBeenCalled()
})

it('confirms the same candidate by keyboard before permitting a query', async() => {
  const page = await setupQuery()
  await wrapper.get('input').setValue('3')
  await flushPromises()
  await wrapper.get('input').trigger('keydown', { key: 'Enter', code: 'Enter' })
  expect(page.value).toBe('1')
  expect(page.submit).not.toHaveBeenCalled()
  await wrapper.get('input').trigger('keydown', { key: 'Enter', code: 'Enter' })
  expect(page.submit).toHaveBeenCalledTimes(1)
})

it('confirms the same candidate by click before permitting a query', async() => {
  const page = await setupQuery()
  await wrapper.get('input').setValue('3')
  await flushPromises()
  ;
  (document.querySelector('[role="option"]') as HTMLElement).click()
  await flushPromises()
  expect(page.value).toBe('1')
  expect(page.submit).not.toHaveBeenCalled()
  await wrapper.get('input').trigger('keydown', { key: 'Enter', code: 'Enter' })
  expect(page.submit).toHaveBeenCalledTimes(1)
})

it('discards an input draft on external value reset, and does not copy the old value in search mode', async() => {
  await setup({ modelValue: '1' })
  await wrapper.get('input').setValue('3')
  await wrapper.get('input').setValue('')
  const setData = vi.fn()
  const event = new Event('copy', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', { value: { setData }})
  wrapper.get('input').element.dispatchEvent(event)
  expect(setData).not.toHaveBeenCalled()
  await wrapper.get('input').setValue('3')
  await wrapper.setProps({ modelValue: null })
  await flushPromises()
  expect((wrapper.get('input').element as HTMLInputElement).value).toBe('')
})

it('resets composition state when the input is disabled and recreated', async() => {
  await setup({ modelValue: '1' })
  await wrapper.get('input').trigger('compositionstart')
  await wrapper.setProps({ disabled: true })
  await wrapper.setProps({ disabled: false })
  await wrapper.get('input').trigger('keydown', { key: 'Enter', code: 'Enter' })
  expect(wrapper.emitted('confirm')).toHaveLength(1)
})

it('remembers Enter after paste while searching and only queries on the next Enter', async() => {
  const page = await setupQuery()
  page.loading = true
  page.options = []
  await nextTick()
  const input = wrapper.get('input').element as HTMLInputElement
  input.value = '141045'
  input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }))
  await nextTick()
  await wrapper.get('input').trigger('keydown', { key: 'Enter', code: 'Enter' })
  expect(page.value).toBe('1')
  expect(page.submit).not.toHaveBeenCalled()
  page.options = [{ value: '2', label: '141045 result' }]
  page.loading = false
  await flushPromises()
  expect(page.value).toBe('2')
  expect(input.value).toBe('')
  expect(page.submit).not.toHaveBeenCalled()
  await wrapper.get('input').trigger('keydown', { key: 'Enter', code: 'Enter' })
  expect(page.submit).toHaveBeenCalledTimes(1)
})

it.each(['typing', 'escape', 'blur'])('cancels a waiting Enter on %s', async action => {
  const page = await setupQuery()
  page.loading = true
  page.options = []
  await wrapper.get('input').setValue('141045')
  const input = wrapper.get('input').element as HTMLInputElement
  input.focus()
  await wrapper.get('input').trigger('keydown', { key: 'Enter', code: 'Enter' })
  if (action === 'typing') await wrapper.get('input').setValue('new')
  if (action === 'escape') await wrapper.get('input').trigger('keydown', { key: 'Escape', code: 'Escape' })
  if (action === 'blur') input.blur()
  await flushPromises()
  page.options = [{ value: '2', label: 'new result' }]
  page.loading = false
  await flushPromises()
  expect(page.value).toBe('1')
  expect(page.submit).not.toHaveBeenCalled()
})

it('discards waiting confirmation after a failed request rather than selecting on a later retry', async() => {
  await setup({ loading: true, options: [] })
  await wrapper.get('input').setValue('141045')
  await wrapper.get('input').trigger('keydown', { key: 'Enter', code: 'Enter' })
  await wrapper.setProps({ error: 'offline', loading: false })
  await flushPromises()
  await wrapper.setProps({ error: '', loading: true })
  await wrapper.setProps({ options: [{ value: '2', label: 'new result' }], loading: false })
  await flushPromises()
  expect(wrapper.emitted('update:modelValue')).toBeUndefined()
})
