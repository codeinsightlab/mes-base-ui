import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ElTree } from 'element-plus'
import Role from '../src/views/system/role/index.vue'

type MenuNode = { id: string; label: string; children?: MenuNode[] }
type CheckState = { checkedKeys: (string | number)[] }
type Tree = InstanceType<typeof ElTree>
type Context = {
  form: { menuCheckStrictly: boolean; deptCheckStrictly: boolean };
  $refs: { menu: Tree; dept: Tree };
  $nextTick: () => Promise<void>
}
const methods = (Role as unknown as { methods: {
  handleCheckedTreeConnect: (this: Context, value: boolean, type: 'menu' | 'dept') => Promise<void>;
  handleMenuBranchCheck: (this: Context, node: MenuNode, state: CheckState) => void;
  getMenuAllCheckedKeys: (this: Context) => (string | number)[]
}}).methods
const root = '9007199254740993'
const page = '9007199254740994'
const actions = ['read', 'create', 'update', 'delete']
const data = [{ id: root, label: '目录', children: [{ id: page, label: '页面', children:
  actions.map(id => ({ id, label: id })) }] }]

function fixture(type: 'menu' | 'dept' = 'menu') {
  const wrapper = mount(ElTree, { props: { data, nodeKey: 'id', showCheckbox: true, checkStrictly: true }, attrs: {
    onCheck: (node: MenuNode, state: CheckState) => methods.handleMenuBranchCheck.call(context, node, state)
  }})
  const context: Context = {
    form: { menuCheckStrictly: false, deptCheckStrictly: false },
    $refs: { menu: wrapper.vm, dept: wrapper.vm },
    $nextTick: async() => { await wrapper.setProps({ checkStrictly: !context.form[type === 'menu' ? 'menuCheckStrictly' : 'deptCheckStrictly'] }) }
  }
  return { wrapper, context }
}

describe('role tree linkage using the real Element Plus tree', () => {
  it('includes every descendant when enabling linkage on an independently selected parent', async() => {
    const { wrapper, context } = fixture()
    wrapper.vm.setChecked(root, true, false)
    expect(wrapper.vm.getCheckedKeys()).toEqual([root])
    await methods.handleCheckedTreeConnect.call(context, true, 'menu')
    expect(new Set(wrapper.vm.getCheckedKeys())).toEqual(new Set([root, page, ...actions]))
    expect(new Set(methods.getMenuAllCheckedKeys.call(context))).toEqual(new Set([root, page, ...actions]))
    wrapper.unmount()
  })

  it('preserves independent selection when linkage is disabled and submits only selected children', async() => {
    const { wrapper, context } = fixture()
    wrapper.vm.setChecked(root, true, false)
    await methods.handleCheckedTreeConnect.call(context, true, 'menu')
    wrapper.vm.setChecked('delete', false, true)
    const submitted = methods.getMenuAllCheckedKeys.call(context)
    expect(submitted).toContain(root)
    expect(submitted).toContain(page)
    expect(submitted).toContain('create')
    expect(submitted).not.toContain('delete')
    const before = wrapper.vm.getCheckedKeys()
    await methods.handleCheckedTreeConnect.call(context, false, 'menu')
    expect(wrapper.vm.getCheckedKeys()).toEqual(before)
    wrapper.vm.setChecked(root, true, false)
    expect(wrapper.vm.getCheckedKeys()).not.toContain('delete')
    wrapper.unmount()
  })

  it('selects and clears all descendants on direct parent clicks even with linkage disabled', async() => {
    const { wrapper, context } = fixture()
    const checkbox = wrapper.find('input[type="checkbox"]')
    await checkbox.setValue(true)
    await flushPromises()
    expect(context.form.menuCheckStrictly).toBe(false)
    expect(new Set(methods.getMenuAllCheckedKeys.call(context))).toEqual(new Set([root, page, ...actions]))
    await checkbox.setValue(false)
    await flushPromises()
    expect(methods.getMenuAllCheckedKeys.call(context)).toEqual([])
    wrapper.unmount()
  })

  it('clears every child when clicking an already checked parent from saved independent selections', async() => {
    const { wrapper, context } = fixture()
    wrapper.vm.setChecked(root, true, false)
    wrapper.vm.setChecked('read', true, false)
    await flushPromises()
    await wrapper.find('input[type="checkbox"]').setValue(false)
    await flushPromises()
    expect(methods.getMenuAllCheckedKeys.call(context)).toEqual([])
    wrapper.unmount()
  })

  it('also synchronizes selected parents in the department data-scope tree', async() => {
    const { wrapper, context } = fixture('dept')
    wrapper.vm.setChecked(root, true, false)
    await methods.handleCheckedTreeConnect.call(context, true, 'dept')
    expect(new Set(wrapper.vm.getCheckedKeys())).toEqual(new Set([root, page, ...actions]))
    wrapper.unmount()
  })
})
