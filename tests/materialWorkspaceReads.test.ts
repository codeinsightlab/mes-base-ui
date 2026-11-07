import { afterEach, expect, it, vi } from 'vitest'
import { defineComponent, h, KeepAlive, nextTick, ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import Materials from '../src/views/basic/materials/index.vue'
import { useAuth } from '../src/stores/auth'
const mocks = vi.hoisted(() => ({ tree: vi.fn(), units: vi.fn() }))
vi.mock('../src/api/basic/materialCategory', async original => ({ ...await original<object>(), tree: mocks.tree }))
vi.mock('../src/api/basic/unitMeasure', async original => ({ ...await original<{ api: object }>(), api: { ...(await original<{ api: object }>()).api, list: mocks.units }}))
let wrapper:ReturnType<typeof mount>
afterEach(() => { wrapper?.unmount();vi.clearAllMocks() })
it('loads categories and units once on initial activation and refreshes on returning to the cached page', async() => {
  mocks.tree.mockResolvedValue({ items: [] });mocks.units.mockResolvedValue({ items: [], total: 0 })
  const pinia = createPinia(), auth = useAuth(pinia)
  auth.factoryId = 'TEST';auth.factoryPermissions = ['business:material:category:list', 'business:unit:measure:list']
  const visible = ref(true)
  wrapper = mount(defineComponent({ setup: () => () => h(KeepAlive, null, { default: () => visible.value ? h(Materials) : null }) }), { global: { plugins: [pinia, ElementPlus], stubs: { CrudPage: true, MaterialBomPanel: true, RouterLink: true }}})
  await flushPromises()
  expect(mocks.tree).toHaveBeenCalledTimes(1)
  expect(mocks.units).toHaveBeenCalledTimes(1)
  visible.value = false;await nextTick();visible.value = true;await flushPromises()
  expect(mocks.tree).toHaveBeenCalledTimes(2)
  expect(mocks.units).toHaveBeenCalledTimes(2)
})
