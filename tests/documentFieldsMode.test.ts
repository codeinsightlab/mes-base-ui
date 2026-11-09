import { expect, it } from 'vitest'
import { h } from 'vue'
import { mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import DocumentFields from '../src/components/document/DocumentFields.vue'

it.each([
  { mode: 'display' as const, disabled: false, expected: 'display:false' },
  { mode: 'edit' as const, disabled: true, expected: 'edit:true' }
])('passes explicit field mode separately from disabled state: $expected', ({ mode, disabled, expected }) => {
  const wrapper = mount(DocumentFields, {
    props: {
      fields: [{ key: 'quantity', label: '数量', kind: 'decimal' }],
      draft: { quantity: '2.0000' },
      mode,
      disabled
    },
    slots: {
      'field-quantity': ({ mode: slotMode, disabled: slotDisabled }: { mode: string; disabled: boolean | undefined }) => h('span', `${slotMode}:${Boolean(slotDisabled)}`)
    },
    global: { plugins: [ElementPlus] }
  })

  expect(wrapper.text()).toContain(expected)
})
