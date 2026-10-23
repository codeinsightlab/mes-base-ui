import { describe, expect, it } from 'vitest'
import { categoryTree } from '../src/lib/materialCategories'
import type { MaterialCategoryVo } from '../src/api/basic/materialCategory'
const row = (id:string, parentId:string | null):MaterialCategoryVo => ({ id, parentId, code: id, name: '分类' + id, sort: 0, status: 'ENABLED', remark: null })
describe('material category presentation', () => {
  it('builds nested categories without turning materials into category nodes', () => {
    const result = categoryTree([row('1', null), row('2', '1'), row('3', '2')])
    expect(result).toHaveLength(1)
    expect(result[0]!.children[0]!.children[0]!.id).toBe('3')
  })
  it('keeps every malformed cyclic or orphaned record readable', () => {
    const result = categoryTree([row('1', '2'), row('2', '1'), row('3', '99'), row('4', null)])
    expect(result).toHaveLength(4)
    expect(result.slice(0, 3).every(item => item.label.includes('待核实'))).toBe(true)
    expect(result[3]!.label).toBe('分类4')
  })
})
