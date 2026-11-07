import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { ESLint } from 'eslint'
import { checkStaged } from './check-staged.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const config = join(root, 'eslint.config.mjs')

function repository(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'mes-format-'))
  t.after(() => rmSync(cwd, { recursive: true, force: true }))
  const git = args => execFileSync('git', args, { cwd, encoding: 'utf8' })
  git(['init', '--quiet'])
  const eslint = new ESLint({ cwd, overrideConfigFile: config })
  return { cwd, git, eslint }
}

test('staged content is checked independently of working-tree edits, without modifying the index', async t => {
  const { cwd, git, eslint } = repository(t)
  const file = join(cwd, '含 空格.ts')
  const valid = "export const label = 'ok'\n"
  const invalid = 'export const label = "bad";\n'
  writeFileSync(file, valid)
  git(['add', '--', '含 空格.ts'])
  writeFileSync(file, invalid)
  const index = readFileSync(join(cwd, '.git/index'))
  assert.equal((await checkStaged({ cwd, eslint })).failed, false)
  assert.deepEqual(readFileSync(join(cwd, '.git/index')), index)
  assert.equal(readFileSync(file, 'utf8'), invalid)

  git(['add', '--', '含 空格.ts'])
  writeFileSync(file, valid)
  assert.equal((await checkStaged({ cwd, eslint })).failed, true)
  assert.equal(readFileSync(file, 'utf8'), valid)
})

test('empty index and unsupported files pass; old compressed statements fail', async t => {
  const { cwd, git, eslint } = repository(t)
  assert.equal((await checkStaged({ cwd, eslint })).failed, false)
  writeFileSync(join(cwd, 'notes.md'), 'text\n')
  git(['add', 'notes.md'])
  assert.equal((await checkStaged({ cwd, eslint })).failed, false)
  writeFileSync(join(cwd, 'compact.ts'), 'export function run() { let value = 1; value++; return value }\n')
  git(['add', 'compact.ts'])
  const { failed, results } = await checkStaged({ cwd, eslint })
  assert.equal(failed, true)
  assert.ok(results[0].messages.some(message => message.ruleId === '@stylistic/max-statements-per-line'))
})

test('the user-formatted Vue reference passes and ESLint fix leaves it byte-for-byte unchanged', async() => {
  const filePath = join(root, 'src/views/basic/bomExplosion/index.vue')
  const content = readFileSync(filePath, 'utf8')
  const eslint = new ESLint({ cwd: root, fix: true })
  const [result] = await eslint.lintText(content, { filePath })
  assert.equal(result.errorCount, 0)
  assert.equal(result.warningCount, 0)
  assert.equal(result.output ?? content, content)
})

test('format expands semicolon-separated statements and is stable on a second pass', async() => {
  const eslint = new ESLint({ cwd: root, fix: true })
  const filePath = join(root, 'scripts/example.mjs')
  const [first] = await eslint.lintText('export function run() { let value = 1; value++; return value }\n', { filePath })
  assert.equal(first.errorCount, 0)
  assert.equal(first.output, 'export function run() {\n  let value = 1\n  value++\n  return value\n}\n')
  const [second] = await eslint.lintText(first.output, { filePath })
  assert.equal(second.output, undefined)
  assert.equal(second.errorCount, 0)
})
