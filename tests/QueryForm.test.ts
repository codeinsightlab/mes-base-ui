import { afterEach, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, reactive, ref } from 'vue'
import ElementPlus from 'element-plus'
import QueryForm from '../src/components/QueryForm.vue'
let wrapper: ReturnType<typeof mount> | undefined
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = '' })
it('uses one native submit path for button clicks and submits without a document key listener', async() => {
  const submit = vi.fn()
  wrapper = mount(QueryForm, { attachTo: document.body, attrs: { class: 'filter-panel', inline: true, onSubmit: submit }, slots: { default: '<input name="code"><input name="name"><button type="submit">查询</button><button type="button">重置</button>' }, global: { plugins: [ElementPlus] }})
  expect(wrapper.get('form').classes()).toContain('filter-panel')
  expect(wrapper.get('form').classes()).toContain('el-form--inline')
  await wrapper.get('button[type="submit"]').trigger('click')
  expect(submit).toHaveBeenCalledTimes(1)
  const event = new Event('submit', { bubbles: true, cancelable: true })
  wrapper.get('form').element.dispatchEvent(event)
  expect(event.defaultPrevented).toBe(true); expect(submit).toHaveBeenCalledTimes(2)
  await wrapper.get('button[type="button"]').trigger('click'); expect(submit).toHaveBeenCalledTimes(2)
})
it('preserves model binding and the legacy queryForm.resetFields ref contract', async() => {
  const Page = defineComponent({ components: { QueryForm }, setup() { const model = reactive({ code: 'ORIGINAL' }); const form = ref<InstanceType<typeof QueryForm>>(); return { model, form } }, template: '<QueryForm ref="form" :model="model"><el-form-item prop="code"><el-input v-model="model.code" /></el-form-item><el-button native-type="submit">查询</el-button></QueryForm>' })
  wrapper = mount(Page, { global: { plugins: [ElementPlus] }})
  await wrapper.get('input').setValue('CHANGED')
  ;(wrapper.vm as any).form.resetFields()
  await wrapper.vm.$nextTick()
  expect((wrapper.get('input').element as HTMLInputElement).value).toBe('ORIGINAL')
})
it('does not synthesize queries from keyboard events or change textarea/select behavior', async() => {
  const submit = vi.fn()
  wrapper = mount(QueryForm, { attrs: { onSubmit: submit }, slots: { default: '<textarea></textarea><select><option>A</option></select><button type="submit" disabled>查询</button>' }, global: { plugins: [ElementPlus] }})
  await wrapper.get('textarea').trigger('keydown', { key: 'Enter' })
  await wrapper.get('select').trigger('keydown', { key: 'Enter' })
  await wrapper.get('button').trigger('click')
  expect(submit).not.toHaveBeenCalled()
})
