import { describe, it, expect, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import RoleView from '../src/views/system/role/index.vue'
import { treeselect } from '../src/api/system/menu'
vi.mock('../src/api/system/menu', () => ({ treeselect: vi.fn(), roleMenuTreeselect: vi.fn() }))
const methods = (RoleView as unknown as { methods: {
  getMenuTreeselect: (this: any) => void;
  handleRoleKindChange: (this: any) => void
}}).methods

describe('role scope assignment tree', () => {
  it('ignores a late platform tree after changing to a factory role', async() => {
    let complete!: (response: unknown) => void
    vi.mocked(treeselect).mockReturnValueOnce(new Promise(resolve => { complete = resolve }))
      .mockResolvedValueOnce({ data: [{ id: 'business' }] })
    const context = { form: { kind: 'PLATFORM' }, menuOptions: [] }
    methods.getMenuTreeselect.call(context)
    context.form.kind = 'FACTORY'
    methods.getMenuTreeselect.call(context)
    await flushPromises()
    expect(vi.mocked(treeselect).mock.calls.slice(-2)).toEqual([['PLATFORM'], ['FACTORY']])
    complete({ data: [{ id: 'system' }] })
    await flushPromises()
    expect(context.menuOptions).toEqual([{ id: 'business' }])
  })

  it('clears old selections and factory identity when changing role kind', () => {
    const clear = vi.fn(), reload = vi.fn()
    const context = { form: { factoryId: 'F1' }, menuNodeAll: true,
      menuOptions: [{ id: 'system' }], $refs: { menu: { setCheckedKeys: clear }},
      getMenuTreeselect: reload }
    methods.handleRoleKindChange.call(context)
    expect(context.form.factoryId).toBeNull()
    expect(context.menuNodeAll).toBe(false)
    expect(context.menuOptions).toEqual([])
    expect(clear).toHaveBeenCalledWith([])
    expect(reload).toHaveBeenCalledOnce()
  })
})
