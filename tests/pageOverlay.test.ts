import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, KeepAlive, nextTick, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import ElementPlus, { ElDialog } from 'element-plus'
import PageBoundary from '../src/components/page/PageBoundary.vue'
import PageDialog from '../src/components/page/PageDialog.vue'
import PageDrawer from '../src/components/page/PageDrawer.vue'
import { acquirePageScrollLock } from '../src/lib/pageOverlay'

const wrappers: ReturnType<typeof mount>[] = []
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: window.innerWidth - 15 })
})
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  document.body.innerHTML = ''
  document.body.removeAttribute('style')
  document.body.className = ''
  vi.restoreAllMocks()
})

it('keeps independent nested scroll owners and restores only original owned styles after the last release', () => {
  document.body.style.setProperty('overflow', 'scroll', 'important')
  document.body.style.setProperty('padding-right', '4px', 'important')
  document.body.style.width = '93%'
  document.body.classList.add('el-popup-parent--hidden')
  const originalPriority = document.body.style.getPropertyPriority('overflow')
  const releaseFirst = acquirePageScrollLock(), releaseSecond = acquirePageScrollLock()
  expect(document.body.style.overflow).toBe('hidden')
  expect(document.body.style.paddingRight).toBe('calc(19px)')
  releaseFirst(); releaseFirst()
  expect(document.body.style.overflow).toBe('hidden')
  releaseSecond()
  expect(document.body.style.overflow).toBe('scroll')
  expect(document.body.style.getPropertyPriority('overflow')).toBe(originalPriority)
  expect(document.body.style.paddingRight).toBe('4px')
  expect(document.body.style.getPropertyPriority('padding-right')).toBe('important')
  expect(document.body.style.width).toBe('93%')
  expect(document.body.classList.contains('el-popup-parent--hidden')).toBe(true)
})

it('preserves independent overflow axes and does not overwrite unrelated body style changes', () => {
  document.body.style.overflowX = 'scroll';document.body.style.overflowY = 'auto'
  const release = acquirePageScrollLock()
  document.body.style.color = 'red'
  release()
  expect(document.body.style.overflowX).toBe('scroll');expect(document.body.style.overflowY).toBe('auto')
  expect(document.body.style.color).toBe('red')
})

it('restores an originally absent inline style without leaving a width or lock class', () => {
  const release = acquirePageScrollLock(); release()
  expect(document.body.style.overflow).toBe('')
  expect(document.body.style.paddingRight).toBe('')
  expect(document.body.style.width).toBe('')
  expect(document.body.className).toBe('')
})

async function pageHarness(beforeClose?: (done: () => void) => unknown, ignoreModelClose = false) {
  const dialog = ref(false), drawer = ref(false), events: boolean[] = []
  const First = defineComponent({ setup: () => () => [
    h('p', '第一页'),
    h(PageDialog, { modelValue: dialog.value, title: '表单弹窗', beforeClose, 'onUpdate:modelValue': value => { events.push(value); if (!ignoreModelClose) dialog.value = value } }, () => h('p', '表单内容')),
    h(PageDrawer, { modelValue: drawer.value, title: '详情抽屉', 'onUpdate:modelValue': value => { drawer.value = value } }, () => h('p', '抽屉内容'))
  ] })
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/first', component: First }, { path: '/second', component: { render: () => h('p', '第二页') }}] })
  await router.push('/first'); await router.isReady()
  const Host = defineComponent({ setup: () => () => h(RouterView, {}, { default: ({ Component, route }: any) => h(KeepAlive, {}, () => h(PageBoundary, { key: route.fullPath, pageKey: route.fullPath }, () => h(Component))) }) })
  const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [router, ElementPlus] }})
  wrappers.push(wrapper)
  await flushPromises()
  return { wrapper, router, dialog, drawer, events }
}

it('closes only the cached page overlays on navigation, rejects late openings, and returns without reopening', async() => {
  const { router, dialog, drawer, wrapper, events } = await pageHarness()
  dialog.value = true; drawer.value = true; await flushPromises()
  expect(document.body.style.overflow).toBe('hidden')
  expect(document.body.classList.contains('el-popup-parent--hidden')).toBe(false)
  await router.push('/second'); await flushPromises()
  expect(router.currentRoute.value.path).toBe('/second')
  expect(dialog.value).toBe(false); expect(drawer.value).toBe(false)
  expect(document.body.style.overflow).toBe('')
  dialog.value = true; await flushPromises()
  expect(dialog.value).toBe(false)
  expect(events.at(-1)).toBe(false)
  await router.push('/first'); await flushPromises()
  expect(wrapper.findComponent(PageDialog).props('modelValue')).toBe(false)
  expect(document.body.style.overflow).toBe('')
})

it('awaits the existing unsaved form close confirmation and retains the current route and lock when cancelled', async() => {
  let answer!: (accepted: boolean) => void
  const beforeClose = vi.fn(async(done: () => void) => { if (await new Promise<boolean>(resolve => { answer = resolve })) done() })
  const { router, dialog } = await pageHarness(beforeClose)
  dialog.value = true; await nextTick()
  const navigation = router.push('/second'); await flushPromises()
  expect(beforeClose).toHaveBeenCalledOnce()
  expect(router.currentRoute.value.path).toBe('/first')
  answer(false); await navigation; await flushPromises()
  expect(router.currentRoute.value.path).toBe('/first')
  expect(dialog.value).toBe(true)
  expect(document.body.style.overflow).toBe('hidden')
  const accepted = router.push('/second'); await flushPromises(); answer(true); await accepted; await flushPromises()
  expect(router.currentRoute.value.path).toBe('/second')
  expect(dialog.value).toBe(false)
  expect(document.body.style.overflow).toBe('')
})

it('blocks busy forms that do not confirm close and also guards query-only changes of the same route', async() => {
  const { router, dialog } = await pageHarness(() => {})
  dialog.value = true; await nextTick()
  await router.push('/first?other=1'); await flushPromises()
  expect(router.currentRoute.value.fullPath).toBe('/first')
  expect(dialog.value).toBe(true)
  expect(document.body.style.overflow).toBe('hidden')
})

it('releases an unmounted owner while preserving a different still-open overlay token', async() => {
  const { wrapper, dialog } = await pageHarness()
  dialog.value = true; await flushPromises()
  const releaseOther = acquirePageScrollLock()
  wrapper.unmount(); wrappers.splice(wrappers.indexOf(wrapper), 1)
  expect(document.body.style.overflow).toBe('hidden')
  releaseOther()
  expect(document.body.style.overflow).toBe('')
})

it('does not reopen a forced closed cached form whose custom model setter refuses the false update', async() => {
  const { router, wrapper, dialog } = await pageHarness(undefined, true)
  dialog.value = true;await flushPromises()
  expect(document.body.style.overflow).toBe('hidden')
  await router.push('/second');await flushPromises()
  expect(dialog.value).toBe(true)
  expect(document.body.style.overflow).toBe('')
  await router.push('/first');await flushPromises()
  expect(wrapper.findComponent(PageDialog).findComponent(ElDialog).props('modelValue')).toBe(false)
  expect(document.body.style.overflow).toBe('')
})

it('returns the native close promise and calls its completion only after the form confirms', async() => {
  let accept!: () => void
  const { wrapper, dialog } = await pageHarness(async done => { await new Promise<void>(resolve => { accept = resolve });done() })
  dialog.value = true;await flushPromises()
  const native = wrapper.findComponent(PageDialog).findComponent(ElDialog)
  const done = vi.fn(), closing = native.props('beforeClose')!(done)
  expect(closing).toBeInstanceOf(Promise);expect(done).not.toHaveBeenCalled()
  accept();await closing
  expect(done).toHaveBeenCalledOnce();expect(dialog.value).toBe(false)
})
