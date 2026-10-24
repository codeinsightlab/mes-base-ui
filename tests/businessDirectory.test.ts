import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'
import type { Component } from 'vue'
import PersonnelSelect from '../src/components/business/directory/PersonnelSelect.vue'
import BusinessDirectorySelect from '../src/components/business/directory/BusinessDirectorySelect.vue'
import { directoryPermissions, getDirectory, listDirectory } from '../src/api/business/directory'
import type { DirectoryOption } from '../src/api/business/directory'
import { useAuth } from '../src/stores/auth'

vi.mock('../src/api/business/directory', async importOriginal => ({
  ...await importOriginal<object>(), listDirectory: vi.fn(), getDirectory: vi.fn()
}))
const row: DirectoryOption = { id: '9007199254740993', name: '测试人员', code: 'P01', parentId: null, departmentId: '10' }
const select = defineComponent({
  props: ['modelValue', 'disabled', 'loading'], emits: ['update:modelValue'],
  template: '<select :disabled="disabled" :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option value="">请选择</option><slot /><slot name="footer" /></select>'
})
const option = defineComponent({ props: ['value', 'label'], template: '<option :value="value">{{ label }}</option>' })
const button = defineComponent({ emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' })
const wrappers: ReturnType<typeof mount>[] = []
function setup(component: Component = PersonnelSelect, permission = true, modelValue: string | null = null) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuth()
  auth.factoryId = 'F1'
  auth.factoryPermissions = permission ? Object.values(directoryPermissions) : []
  const wrapper = mount(component, { props: { modelValue }, global: {
    plugins: [pinia], stubs: { ElSelect: select, ElOption: option, ElButton: button }
  }})
  wrappers.push(wrapper)
  return { wrapper, auth }
}
beforeEach(() => {
  vi.mocked(listDirectory).mockReset().mockResolvedValue({ items: [row], total: 1, offset: 0, limit: 20 })
  vi.mocked(getDirectory).mockReset().mockResolvedValue(row)
})
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()))
describe('read-only business directory components', () => {
  it.each([[PersonnelSelect, 'personnel']] as const)(
    'uses the correct list endpoint and preserves string IDs', async(component, resource) => {
      const { wrapper } = setup(component)
      await flushPromises()
      expect(listDirectory).toHaveBeenCalledWith(resource, '', 0, undefined)
      await wrapper.find('select').setValue(row.id)
      expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([row.id])
      expect(wrapper.emitted('change')?.at(-1)).toEqual([row])
      expect(wrapper.text()).not.toMatch(/新增|修改|删除/)
    })
  it.each(['routings'] as const)('uses the shared directory for %s and shows exact version metadata', async resource => {
    vi.mocked(listDirectory).mockResolvedValue({ items: [{ ...row, name: '精加工', code: 'ROUTE', version: 2 }], total: 1, offset: 0, limit: 20 })
    const component = defineComponent({ components: { BusinessDirectorySelect }, template: `<BusinessDirectorySelect resource="${resource}" />` })
    const { wrapper } = setup(component)
    await flushPromises()
    expect(listDirectory).toHaveBeenCalledWith(resource, '', 0, undefined)
    expect(wrapper.text()).toContain('精加工（ROUTE · V2）')
  })
  it('makes no request without the exact business read grant or factory', async() => {
    const { wrapper, auth } = setup(PersonnelSelect, false)
    await flushPromises()
    expect(listDirectory).not.toHaveBeenCalled()
    expect(wrapper.find('select').attributes('disabled')).toBeDefined()
    auth.factoryPermissions = Object.values(directoryPermissions)
    auth.factoryId = ''
    await flushPromises()
    expect(listDirectory).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('请先选择工厂')
  })
  it('hydrates a selected item not in the first page and allows clearing', async() => {
    vi.mocked(listDirectory).mockResolvedValue({ items: [], total: 0, offset: 0, limit: 20 })
    const { wrapper } = setup(PersonnelSelect, true, row.id)
    await flushPromises()
    expect(getDirectory).toHaveBeenCalledWith('personnel', row.id)
    expect(wrapper.findAll('option').some(option => option.text().includes(row.name))).toBe(true)
    await wrapper.find('select').setValue('')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([null])
  })
  it('paginates and filters without replacing selected details', async() => {
    vi.mocked(listDirectory).mockResolvedValueOnce({ items: [row], total: 2, offset: 0, limit: 20 })
    const { wrapper } = setup()
    await flushPromises()
    vi.mocked(listDirectory).mockResolvedValueOnce({ items: [{ ...row, id: '2' }], total: 2, offset: 1, limit: 20 })
    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(listDirectory).toHaveBeenLastCalledWith('personnel', '', 1, undefined)
    expect(wrapper.findAll('option')).toHaveLength(3)
    const inner = wrapper.findComponent(BusinessDirectorySelect).vm as unknown as { search(value: string): Promise<void> }
    await inner.search('测试')
    expect(listDirectory).toHaveBeenLastCalledWith('personnel', '测试', 0, undefined)
  })
  it('rejects stale list and detail responses after changing factory', async() => {
    let listDone!: (value: Awaited<ReturnType<typeof listDirectory>>) => void
    let detailDone!: (value: DirectoryOption) => void
    vi.mocked(listDirectory).mockImplementationOnce(() => new Promise(done => { listDone = done }))
    vi.mocked(getDirectory).mockImplementationOnce(() => new Promise(done => { detailDone = done }))
    const { wrapper, auth } = setup(PersonnelSelect, true, row.id)
    auth.factoryId = 'F2'
    auth.factoryPermissions = []
    auth.revision++
    await flushPromises()
    listDone({ items: [row], total: 1, offset: 0, limit: 20 })
    detailDone(row)
    await flushPromises()
    expect(wrapper.text()).not.toContain(row.name)
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([null])
  })
  it('shows failed query and retries the real list function', async() => {
    vi.mocked(listDirectory).mockRejectedValueOnce(new Error('查询失败'))
    const { wrapper } = setup()
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toContain('查询失败')
    await wrapper.find('[role="alert"] button').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.text()).toContain(row.name)
  })
})
