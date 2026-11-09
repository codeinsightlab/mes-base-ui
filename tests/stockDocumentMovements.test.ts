import { afterEach, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, inject, provide } from 'vue'
import StockDocumentMovements from '../src/components/business/warehouse/StockDocumentMovements.vue'

let wrapper: ReturnType<typeof mount> | undefined
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
})

const movementRowsKey = Symbol('movementRows')
const TableStub = defineComponent({
  props: { data: { type: Array, default: () => [] }},
  setup(props, { slots }) {
    provide(movementRowsKey, () => props.data as Record<string, unknown>[])
    return () => h('div', slots.default?.())
  }
})
const ColumnStub = defineComponent({
  props: { label: String, prop: String },
  setup(props, { slots }) {
    const rows = inject<() => Record<string, unknown>[]>(movementRowsKey)!
    return () => h('div', [
      h('strong', props.label),
      ...rows().map(row => slots.default ? slots.default({ row }) : String(row[props.prop || ''] ?? ''))
    ])
  }
})

it('formats signed stock movement quantities through the shared display rule', async() => {
  wrapper = mount(StockDocumentMovements, {
    props: {
      movements: [
        { id: '1', documentLineId: '1', actionType: 'ISSUE', quantityDelta: '2.0030', occurredAt: '', referenceActionId: null, operationId: null, stockId: '1', batchNo: null, binCode: null, operatorUserId: '1', reason: '' },
        { id: '2', documentLineId: '2', actionType: 'RETURN', quantityDelta: '-0.0500', occurredAt: '', referenceActionId: null, operationId: null, stockId: '2', batchNo: null, binCode: null, operatorUserId: '1', reason: '' }
      ]
    },
    global: { stubs: { ElTable: TableStub, ElTableColumn: ColumnStub, ElEmpty: true }}
  })

  expect(wrapper.text()).toContain('+2.003')
  expect(wrapper.text()).toContain('-0.05')
  expect(wrapper.text()).not.toContain('2.0030')
  expect(wrapper.text()).not.toContain('-0.0500')
})
