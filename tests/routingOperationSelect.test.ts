import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import Select from '../src/components/business/production/RoutingOperationSelect.vue'
import SearchSelect from '../src/components/SearchSelect.vue'
import { useAuth } from '../src/stores/auth'
const api = vi.hoisted(() => ({ operations: vi.fn() }))
vi.mock('../src/api/production/routing', () => ({ api }))
const wrappers:ReturnType<typeof mount>[] = []
beforeEach(() => { api.operations.mockReset().mockResolvedValue([]) })
afterEach(() => { wrappers.splice(0).forEach(w => w.unmount());vi.useRealTimers() })
function setup(id:string, disabled = false) {
  const pinia = createPinia(), auth = useAuth(pinia);auth.factoryId = 'TEST';auth.factoryPermissions = ['routing:query', 'routing:update']
  const wrapper = mount(Select, { props: { modelValue: id, option: { id, code: 'OP' + id, name: '工序' + id }, disabled }, global: { plugins: [pinia, ElementPlus] }})
  wrappers.push(wrapper);return { wrapper, auth, input: wrapper.findComponent(SearchSelect) }
}
it('keeps each row search independent and does not prefetch on mount or becoming editable', async() => {
  vi.useFakeTimers()
  const a = setup('1', true), b = setup('2')
  await a.wrapper.setProps({ disabled: false });await flushPromises();expect(api.operations).not.toHaveBeenCalled()
  api.operations.mockImplementation(async(keyword:string) => [{ id: keyword, code: keyword, name: '名称' + keyword }])
  a.input.vm.$emit('search', 'A');b.input.vm.$emit('search', 'B')
  await vi.advanceTimersByTimeAsync(300)
  expect(a.input.props('options').map((r:any) => r.value)).toEqual(['A'])
  expect(b.input.props('options').map((r:any) => r.value)).toEqual(['B'])
  expect(a.input.props('selectedOption')?.label).toBe('OP1 · 工序1')
  a.input.vm.$emit('update:modelValue', 'A')
  expect(a.wrapper.emitted('selected')?.[0]?.[0]).toMatchObject({ id: 'A', name: '名称A' })
})
it('does not reload the opened list and discards results after factory changes', async() => {
  const { wrapper, auth, input } = setup('1')
  let release!:(rows:unknown[]) => void
  api.operations.mockImplementation(() => new Promise(done => { release = done }))
  input.vm.$emit('open');input.vm.$emit('open');await flushPromises()
  expect(api.operations).toHaveBeenCalledOnce()
  auth.factoryId = 'OTHER';release([{ id: 'old', code: 'OLD', name: '旧厂工序' }]);await flushPromises()
  expect(input.props('options')).toEqual([])
  await wrapper.setProps({ disabled: true });input.vm.$emit('open');await flushPromises()
  expect(api.operations).toHaveBeenCalledOnce()
})
