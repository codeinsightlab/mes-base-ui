import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ESLint } from 'eslint'

// Read the index, never the working-tree copy: partial staging must stay intact.
export async function checkStaged({ cwd = process.cwd(), eslint = new ESLint({ cwd }) } = {}) {
  const git = args => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  const paths = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'])
    .split('\0').filter(path => /\.(?:[cm]?js|ts|vue)$/.test(path))
  const results = []
  for (const path of paths) {
    const filePath = resolve(cwd, path)
    if (await eslint.isPathIgnored(filePath)) continue
    const content = git(['show', `:./${path}`])
    results.push(...await eslint.lintText(content, { filePath }))
  }
  const failed = results.some(result => result.errorCount > 0 || result.warningCount > 0)
  return { failed, results }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const eslint = new ESLint()
    const { failed, results } = await checkStaged({ eslint })
    const formatter = await eslint.loadFormatter('stylish')
    const output = formatter.format(results)
    if (output) process.stderr.write(output)
    if (failed) {
      process.stderr.write('提交已阻止：请格式化/修复上述文件，重新 git add 后提交。检查没有修改文件或暂存区。\n')
      process.exitCode = 1
    }
  } catch (error) {
    console.error('提交检查无法完成：', error.message)
    process.exitCode = 1
  }
}
