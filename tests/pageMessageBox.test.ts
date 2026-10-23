import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, readonly, ref } from 'vue'
import { createPageMessageBox, usePageMessageBox } from '../src/lib/pageMessageBox'
import { acquirePageScrollLock } from '../src/lib/pageOverlay'
import type { PageOverlayScope } from '../src/lib/pageOverlay'

interface Owner { scope: PageOverlayScope; deactivate: () => void; entries: Set<{ forceClose: () => void }> }
const scopes: Owner[] = []
function owner(): Owner {
  const active = ref(true)
  const entries = new Set<{ forceClose: () => void }>()
  const scope: PageOverlayScope = { active: readonly(active), register(entry) { entries.add(entry); return () => entries.delete(entry) } }
  const deactivate = () => { active.value = false; for (const entry of entries) entry.forceClose() }
  const value = { scope, deactivate, entries }
  scopes.push(value)
  return value
}
function box(title: string) {
  return Array.from(document.querySelectorAll<HTMLElement>('.el-message-box')).find(node => node.querySelector('.el-message-box__title')?.textContent === title)!
}
async function click(title: string, action: 'confirm' | 'cancel') {
  const buttons = box(title).querySelectorAll<HTMLButtonElement>('.el-message-box__btns button')
  buttons[action === 'confirm' ? buttons.length - 1 : 0]!.click()
  await flushPromises()
}
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
})
afterEach(async() => {
  for (const scope of scopes) scope.deactivate()
  scopes.length = 0
  await flushPromises()
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

it('cancels only the inactive owner and settles its promise while another owner remains locked', async() => {
  const a = owner(), b = owner()
  const first = createPageMessageBox(a.scope).confirm('A内容', 'A').then(() => 'confirmed', reason => reason)
  const second = createPageMessageBox(b.scope).confirm('B内容', 'B')
  await flushPromises()
  a.deactivate()
  expect(await first).toBe('cancel')
  await flushPromises()
  expect(box('B')).toBeTruthy()
  expect(document.body.style.overflow).toBe('hidden')
  await click('B', 'confirm')
  expect(await second).toBe('confirm')
  expect(document.body.style.overflow).not.toBe('hidden')
  expect(a.entries.size).toBe(0)
  expect(b.entries.size).toBe(0)
})

it('releases a nested confirmation token without unlocking its parent overlay', async() => {
  const releaseParent = acquirePageScrollLock()
  const page = owner()
  const result = createPageMessageBox(page.scope).confirm(h('strong', '保留VNode消息'), '嵌套')
  await flushPromises()
  expect(box('嵌套').querySelector('strong')?.textContent).toBe('保留VNode消息')
  await click('嵌套', 'confirm')
  await result
  expect(document.body.style.overflow).toBe('hidden')
  releaseParent()
  expect(document.body.style.overflow).not.toBe('hidden')
})

it('does not create a confirmation or acquire a scroll lease for an inactive owner', async() => {
  const page = owner()
  page.deactivate()
  await expect(createPageMessageBox(page.scope).confirm('不应显示', '失活')).rejects.toBe('cancel')
  await flushPromises()
  expect(box('失活')).toBeUndefined()
  expect(document.body.style.overflow).not.toBe('hidden')
})

it('preserves prompt input, shortcut options, and function messages', async() => {
  const page = owner()
  const prompt = createPageMessageBox(page.scope).prompt(() => h('em', '输入依据'), { title: '输入', inputValue: '原值' })
  await flushPromises()
  expect(box('输入').querySelector('em')?.textContent).toBe('输入依据')
  const input = box('输入').querySelector('input')!
  input.value = '新依据'
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await click('输入', 'confirm')
  expect(await prompt).toEqual({ action: 'confirm', value: '新依据' })
})

it('keeps normal beforeClose guards but forces an inactive owner to cancel', async() => {
  const page = owner(), beforeClose = vi.fn()
  const pending = createPageMessageBox(page.scope).confirm('尚未保存', '关闭保护', { beforeClose }).then(() => 'confirmed', reason => reason)
  await flushPromises()
  await click('关闭保护', 'cancel')
  expect(beforeClose).toHaveBeenCalledOnce()
  expect(page.entries.size).toBe(1)
  page.deactivate()
  expect(await pending).toBe('cancel')
  expect(beforeClose).toHaveBeenCalledOnce()
})

it('never resolves a confirmed result after the page becomes inactive in the same turn', async() => {
  const page = owner(), send = vi.fn()
  const result = createPageMessageBox(page.scope).confirm('确认', '竞争').then(send, reason => reason)
  await flushPromises()
  const buttons = box('竞争').querySelectorAll<HTMLButtonElement>('.el-message-box__btns button')
  buttons[buttons.length - 1]!.click()
  page.deactivate()
  expect(await result).toBe('cancel')
  expect(send).not.toHaveBeenCalled()
})

it('captures a component lifecycle owner when no page boundary is provided', async() => {
  let pending!: Promise<unknown>
  const component = mount(defineComponent({ setup() { const messages = usePageMessageBox(); pending = messages.alert('提示', '局部生命周期').catch(reason => reason); return () => h('div') } }))
  await flushPromises()
  component.unmount()
  expect(await pending).toBe('cancel')
  expect(document.body.style.overflow).not.toBe('hidden')
})
