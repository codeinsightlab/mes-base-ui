import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import CodeScanner from '../src/components/scanner/CodeScanner.vue'
const read = vi.hoisted(() => vi.fn())
vi.mock('../src/components/scanner/qrImage', () => ({ readQrImage: read }))
const mounted: ReturnType<typeof mount>[] = []
afterEach(() => { mounted.forEach(w => w.unmount()); mounted.length = 0; document.body.innerHTML = ''; read.mockReset() })
async function open() {
  const wrapper = mount(CodeScanner, { attachTo: document.body, props: { contextKey: 'A:1' }, global: { plugins: [ElementPlus], stubs: { teleport: true }}})
  mounted.push(wrapper); await wrapper.get('button').trigger('click'); await flushPromises(); return wrapper
}
it('allows manual entry and emits only on confirmation', async() => {
  const wrapper = await open()
  await wrapper.get('input[aria-label="扫码码值"]').setValue('WO001:P001#9007199254740993')
  expect(wrapper.emitted('confirm')).toBeUndefined()
  await wrapper.get('form').trigger('submit')
  expect(wrapper.emitted('confirm')).toEqual([['WO001:P001#9007199254740993', 'TEXT']])
  expect(wrapper.emitted('update:modelValue')).toEqual([['WO001:P001#9007199254740993']])
})
it('recognizes dropped images but waits for explicit confirmation', async() => {
  read.mockResolvedValue('WO001:P001#9007199254740993')
  const wrapper = await open(), file = new File(['TEST ONLY'], 'qr.png', { type: 'image/png' })
  await wrapper.get('.scan-drop').trigger('drop', { dataTransfer: { files: [file] }}); await flushPromises()
  expect(read).toHaveBeenCalledWith(file)
  expect(wrapper.text()).toContain('二维码识别成功')
  expect((wrapper.get('input[aria-label="扫码码值"]').element as HTMLInputElement).value).toBe('WO001:P001#9007199254740993')
  expect(wrapper.emitted('confirm')).toBeUndefined()
  await wrapper.get('form').trigger('submit'); expect(wrapper.emitted('confirm')).toEqual([['WO001:P001#9007199254740993', 'IMAGE']])
})
it('supports the file selector and surfaces failures without reusing an old code', async() => {
  const wrapper = await open()
  await wrapper.get('input[aria-label="扫码码值"]').setValue('OLD')
  read.mockRejectedValue(new Error('未识别到二维码'))
  const file = wrapper.get('input[type="file"]')
  Object.defineProperty(file.element, 'files', { value: [new File(['x'], 'qr.png', { type: 'image/png' })] })
  await file.trigger('change'); await flushPromises()
  expect(wrapper.text()).toContain('未识别到二维码')
  expect((wrapper.get('input[aria-label="扫码码值"]').element as HTMLInputElement).value).toBe('')
  await wrapper.get('form').trigger('submit'); expect(wrapper.emitted('confirm')).toBeUndefined()
})
it('rejects multiple images and ignores late recognition after close, scope change or permission loss', async() => {
  const wrapper = await open(), file = new File(['x'], 'qr.png', { type: 'image/png' })
  await wrapper.get('.scan-drop').trigger('drop', { dataTransfer: { files: [file, file] }})
  expect(wrapper.text()).toContain('每次选择一张'); expect(read).not.toHaveBeenCalled()
  for (const change of ['close', 'scope', 'permission']) {
    let finish!: (value: string) => void
    read.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    await wrapper.get('.scan-drop').trigger('drop', { dataTransfer: { files: [file] }})
    if (change === 'scope') await wrapper.setProps({ contextKey: 'B:2' })
    else if (change === 'permission') await wrapper.setProps({ disabled: true })
    else await wrapper.findAll('button').find(b => b.text() === '取消')!.trigger('click')
    finish('STALE'); await flushPromises()
    expect(wrapper.emitted('confirm')).toBeUndefined()
    await wrapper.setProps({ disabled: false })
    await wrapper.get('button').trigger('click'); await flushPromises()
    expect((wrapper.get('input[aria-label="扫码码值"]').element as HTMLInputElement).value).toBe('')
  }
})

it('preserves the exact text instead of trimming an identity into a different code', async() => {
  const wrapper = await open(), code = '  WO:PRODUCT#LOT  '
  await wrapper.get('input[aria-label="扫码码值"]').setValue(code);await wrapper.get('form').trigger('submit')
  expect(wrapper.emitted('confirm')).toEqual([[code, 'TEXT']]);expect(wrapper.emitted('update:modelValue')).toEqual([[code]])
})
it('marks edited image content as text while retaining exact decoded image content when unchanged', async() => {
  const wrapper = await open(), file = new File(['x'], 'qr.png', { type: 'image/png' })
  read.mockResolvedValue(' WO:PRODUCT#LOT ')
  await wrapper.get('.scan-drop').trigger('drop', { dataTransfer: { files: [file] }});await flushPromises()
  await wrapper.get('input[aria-label="扫码码值"]').setValue(' WO:PRODUCT#EDITED ');await wrapper.get('form').trigger('submit')
  expect(wrapper.emitted('confirm')).toEqual([[' WO:PRODUCT#EDITED ', 'TEXT']])
})
