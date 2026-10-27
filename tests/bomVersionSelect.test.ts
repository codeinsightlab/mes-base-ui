import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import BomVersionSelect from '../src/components/business/material/BomVersionSelect.vue'
import { useAuth } from '../src/stores/auth'

const { list, detail } = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn() }))
vi.mock('../src/api/basic/materialBom', () => ({ bomApi: { list, detail }}))

const pageBom = { id: '10', code: 'BOM-A', version: '1', productId: '8', status: 'PUBLISHED', revision: '2', defaultVersion: true }
const selectedBom = { id: '999', code: 'BOM-Z', version: '4', productId: '8', status: 'PUBLISHED', revision: '7', defaultVersion: false }
let wrapper: ReturnType<typeof mount>

beforeEach(() => {
  vi.resetAllMocks()
  list.mockResolvedValue({ items: [pageBom], total: 40 })
  detail.mockResolvedValue(selectedBom)
})
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = '' })

function setup(modelValue: string | null = null) {
  const pinia = createPinia(), auth = useAuth(pinia)
  auth.factoryId = 'A'; auth.factoryPermissions = ['business:material:list', 'business:material:query']
  wrapper = mount(BomVersionSelect, { props: { modelValue, materialId: '8' }, global: { plugins: [pinia, ElementPlus] }})
  return wrapper
}

it('resolves a selected version outside the first page without auto-selecting the default', async() => {
  const component = setup('999')
  await flushPromises()
  expect(detail).toHaveBeenCalledWith('999')
  expect(component.emitted('selected')?.at(-1)?.[0]).toEqual(selectedBom)
  expect(component.emitted('update:modelValue')).toBeUndefined()
  expect(component.text()).toContain('加载更多版本')
})

it('keeps an empty child BOM selection as an empty leaf choice', async() => {
  const component = setup(null)
  await flushPromises()
  expect(component.emitted('update:modelValue')).toBeUndefined()
  expect(component.emitted('selected')).toBeUndefined()
  expect(detail).not.toHaveBeenCalled()
  expect(component.text()).toContain('不选则为本层叶项')
})

