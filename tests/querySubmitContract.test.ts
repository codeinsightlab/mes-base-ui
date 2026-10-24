import { expect, it } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from '@vue/compiler-sfc'
import { parse as parseTemplate } from '@vue/compiler-dom'

it('every current query form has one native submit path without click/keyboard duplication', () => {
  let queries = 0
  const inspect = (directory: string) => {
    for (const file of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, file.name)
      if (file.isDirectory()) { inspect(path); continue }
      if (!file.name.endsWith('.vue')) continue
      const template = parse(readFileSync(path, 'utf8')).descriptor.template?.content
      if (!template) continue
      const visit = (node: any, form?: any) => {
        if (node.type === 1) {
          if (['QueryForm', 'el-form', 'form'].includes(node.tag)) form = node
          if (node.tag === 'el-button' && form) {
            const label = node.children.filter((child: any) => child.type === 2).map((child: any) => child.content).join('').trim()
            if (/^(搜索|查询|筛选|定位执行)/.test(label)) {
              queries++
              expect(form.tag, path).toBe('QueryForm')
              expect(form.props.some((prop: any) => prop.type === 7 && prop.name === 'on' && prop.arg?.content === 'submit'), path).toBe(true)
              expect(node.props.find((prop: any) => prop.name === 'native-type')?.value?.content, path).toBe('submit')
              expect(node.props.some((prop: any) => prop.type === 7 && prop.name === 'on' && prop.arg?.content === 'click'), path).toBe(false)
            }
          }
          if (form?.tag === 'QueryForm') {
            expect(node.props.some((prop: any) => prop.type === 7 && prop.name === 'on' && ['keydown', 'keyup'].includes(prop.arg?.content) && prop.modifiers.some((modifier: any) => modifier.content === 'enter')), path).toBe(false)
          }
        }
        for (const child of node.children ?? []) visit(child, form)
      }
      visit(parseTemplate(template))
    }
  }
  inspect(resolve('src'))
  expect(queries).toBeGreaterThanOrEqual(30)
  expect(existsSync('src/lib/queryEnter.ts')).toBe(false)
  expect(readFileSync('src/main.ts', 'utf8')).not.toContain('queryEnter')
})
