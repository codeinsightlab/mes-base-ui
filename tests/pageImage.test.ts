import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, provide, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus, { ElImageViewer } from 'element-plus'
import PageImage from '../src/components/page/PageImage.vue'
import PageDialog from '../src/components/page/PageDialog.vue'
import { pageOverlayScopeKey, type PageOverlay } from '../src/lib/pageOverlay'

const image = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='
const wrappers: ReturnType<typeof mount>[] = []
beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: window.innerWidth - 15 })
  Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 600 })
  Object.defineProperty(document.body, 'scrollHeight', { configurable: true, value: 1200 })
})
afterEach(async() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  await vi.runOnlyPendingTimersAsync()
  document.body.innerHTML = ''; document.body.removeAttribute('style'); document.body.className = ''
  vi.useRealTimers(); vi.restoreAllMocks()
})
async function harness() {
  const active = ref(true), modal = ref(false), overlays = new Set<PageOverlay>()
  const Host = defineComponent({
    setup() {
      provide(pageOverlayScopeKey, { active, register(overlay) { overlays.add(overlay); return () => overlays.delete(overlay) } })
      return () => [h(PageImage, { src: image, previewSrcList: [image, image + '#second'], initialIndex: 1, fit: 'cover', alt: '私有预览图' }),
        h(PageDialog, { modelValue: modal.value, title: '下一页面弹窗', 'onUpdate:modelValue': value => { modal.value = value } }, () => '当前弹窗')]
    }
  })
  const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [ElementPlus] }}); wrappers.push(wrapper)
  await flushPromises()
  const preview = wrapper.findComponent(PageImage)
  // Explicit load simulates the existing authenticated object URL thumbnail;
  // the data URL is local and this test performs no HTTP image retrieval.
  const thumbnail = preview.get('img')
  await thumbnail.trigger('load'); await thumbnail.trigger('click'); await flushPromises()
  return { wrapper, preview, active, modal, overlays }
}

it('opens the real viewer with the original list and initial index, and unmounts it when its page deactivates', async() => {
  const { wrapper, preview, active } = await harness()
  const viewer = wrapper.findComponent(ElImageViewer)
  expect(viewer.exists()).toBe(true)
  expect(viewer.props('urlList')).toEqual([image, image + '#second'])
  expect(viewer.props('initialIndex')).toBe(1)
  expect(preview.get('img').attributes('alt')).toBe('私有预览图')
  expect(document.body.classList.contains('el-image-viewer-parent--hidden')).toBe(true)
  expect(document.body.classList.contains('el-popup-parent--hidden')).toBe(false)
  expect(document.body.style.overflow).toBe('')
  active.value = false; await flushPromises()
  expect(wrapper.findComponent(ElImageViewer).exists()).toBe(false)
  await vi.advanceTimersByTimeAsync(220)
  expect(document.body.classList.contains('el-image-viewer-parent--hidden')).toBe(false)
  expect(document.body.style.width).toBe('')
  active.value = true; await flushPromises()
  expect(wrapper.findComponent(ElImageViewer).exists()).toBe(false)
})

it('keeps a new managed dialog locked after the native viewer delayed cleanup and restores original body style after closing it', async() => {
  document.body.style.width = '95%'; document.body.style.overflow = 'auto'
  const { active, modal, wrapper, overlays } = await harness()
  active.value = false; await flushPromises()
  // A different page may activate its dialog while the prior viewer cleanup waits.
  active.value = true; modal.value = true; await flushPromises()
  expect(wrapper.findComponent(ElImageViewer).exists()).toBe(false)
  expect(document.body.style.overflow).toBe('hidden')
  await vi.advanceTimersByTimeAsync(220)
  expect(document.body.style.overflow).toBe('hidden')
  expect(document.body.classList.contains('el-image-viewer-parent--hidden')).toBe(false)
  modal.value = false; await flushPromises()
  expect(document.body.style.overflow).toBe('auto')
  expect(document.body.style.width).toBe('95%')
  expect(document.body.style.paddingRight).toBe('')
  expect(overlays.size).toBe(2)
})

it('releases native preview lock on unmount and ignores new preview clicks on an inactive page', async() => {
  const { preview, active, wrapper } = await harness()
  active.value = false; await flushPromises()
  await preview.get('img').trigger('click'); await flushPromises()
  expect(wrapper.findComponent(ElImageViewer).exists()).toBe(false)
  wrapper.unmount(); wrappers.splice(wrappers.indexOf(wrapper), 1)
  await vi.advanceTimersByTimeAsync(220)
  expect(document.body.classList.contains('el-image-viewer-parent--hidden')).toBe(false)
  expect(document.body.style.width).toBe('')
})

it('disposes an open viewer on component unmount without leaving its native body class', async() => {
  const { wrapper } = await harness()
  expect(document.body.classList.contains('el-image-viewer-parent--hidden')).toBe(true)
  wrapper.unmount();wrappers.splice(wrappers.indexOf(wrapper), 1)
  await vi.advanceTimersByTimeAsync(220)
  expect(document.body.classList.contains('el-image-viewer-parent--hidden')).toBe(false)
  expect(document.body.style.width).toBe('')
})
