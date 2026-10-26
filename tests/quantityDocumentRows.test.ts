import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import SalesOrder from '../src/views/sales/order/index.vue'
import ProductionPlan from '../src/views/production/plan/index.vue'
import QuantityInput from '../src/components/business/material/QuantityInput.vue'
import { useAuth } from '../src/stores/auth'
import { invalidateQuantityRules } from '../src/lib/production/quantityRuleInvalidation'
vi.mock('../src/api/basic/material', () => ({ api: { detail: vi.fn(async id => ({ unitId: id })) } }))
vi.mock('../src/api/basic/unitMeasure', () => ({ api: { detail: vi.fn(async id => ({ mustBeWholeNumber: id === 'B' ? 1 : 0, quantityPrecision: 6 })) } }))
let wrapper: ReturnType<typeof mount>
beforeEach(() => { invalidateQuantityRules(); vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }) })
afterEach(() => { wrapper?.unmount(); vi.unstubAllGlobals(); document.body.innerHTML = '' })
it.each([{ page: SalesOrder, key: 'orderedQty' }, { page: ProductionPlan, key: 'plannedQty' }])('keeps material quantity rules separate for each $key document row', async({ page, key }) => {
  const rows = reactive([{ materialId: 'A', [key]: '1.2345000' }, { materialId: 'B', [key]: '2.000' }])
  const document = defineComponent({
    props: { validateAggregateItems: Function }, setup: () => ({ rows }),
    template: '<div><slot name="items" :items="rows" :writable="true" /></div>'
  })
  const pinia = createPinia(), auth = useAuth(pinia)
  auth.factoryId = 'F1'; auth.factoryPermissions = ['business:material:query', 'business:unit:measure:query']
  wrapper = mount(page, { global: { plugins: [pinia, ElementPlus], stubs: { MasterDetailDocument: document, MaterialSelect: true } } })
  await flushPromises()
  const validate = wrapper.findComponent(document).props('validateAggregateItems') as (items: unknown) => string | null
  expect(validate(rows)).toBeNull()
  expect(rows.map(row => row[key])).toEqual(['1.2345', '2'])
  await wrapper.findAllComponents(QuantityInput)[1]!.get('input').setValue('2.5')
  await flushPromises(); expect(validate(rows)).toContain('第2行')
  await wrapper.findAllComponents(QuantityInput)[1]!.get('input').setValue('3')
  await flushPromises(); expect(validate(rows)).toBeNull()
  rows[0]!.materialId = 'B'; await flushPromises()
  expect(validate(rows)).toContain('第1行')
  expect(rows[1]![key]).toBe('3')
})
