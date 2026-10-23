import type { MaterialCategoryVo } from '@/api/basic/materialCategory'
export interface CategoryNode extends MaterialCategoryVo { label: string; children: CategoryNode[] }
/** Preserve malformed rows as roots for inspection instead of hiding them or constructing cyclic UI nodes. */
export function categoryTree(rows:MaterialCategoryVo[]):CategoryNode[] {
  const byId = new Map(rows.map(row => [row.id, row]))
  const nodes = new Map(rows.map(row => [row.id, { ...row, label: row.name, children: [] } as CategoryNode]))
  const roots:CategoryNode[] = []
  for (const row of rows) {
    const seen = new Set<string>([row.id]);let parent = row.parentId, invalid = false
    while (parent) {
      if (seen.has(parent) || !byId.has(parent)) { invalid = true;break }
      seen.add(parent);parent = byId.get(parent)!.parentId
    }
    const node = nodes.get(row.id)!
    if (invalid) node.label += '（分类关系待核实）'
    if (!row.parentId || invalid) roots.push(node)
    else nodes.get(row.parentId)!.children.push(node)
  }
  return roots
}
