import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ESLint } from 'eslint'

// Compare the whole push/PR with its base, rather than only the last commit.
// Locally, HEAD includes both staged and unstaged edits, plus untracked files.
export async function checkChanged({ cwd = process.cwd(), base = 'HEAD', defaultBranch, eslint = new ESLint({ cwd }) } = {}) {
  const git = args => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  let paths
  if (/^0+$/.test(base)) {
    if (!defaultBranch) throw new Error('首次分支推送缺少默认分支，无法确定格式检查范围。')
    const defaultSha = git(['rev-parse', '--verify', '--end-of-options', `refs/remotes/origin/${defaultBranch}^{commit}`]).trim()
    const head = git(['rev-parse', 'HEAD']).trim()
    if (defaultSha === head) paths = git(['ls-files', '-z'])
    else {
      const common = git(['merge-base', 'HEAD', defaultSha]).trim()
      paths = git(['diff', '--name-only', '--diff-filter=ACMR', '-z', common, '--'])
    }
  } else {
    const revision = git(['rev-parse', '--verify', '--end-of-options', `${base}^{commit}`]).trim()
    paths = git(['diff', '--name-only', '--diff-filter=ACMR', '-z', revision, '--'])
  }
  paths += git(['ls-files', '--others', '--exclude-standard', '-z'])
  const candidates = [...new Set(paths.split('\0').filter(path => /\.(?:[cm]?js|ts|vue)$/.test(path)))]
  const results = []
  for (const path of candidates) {
    const filePath = resolve(cwd, path)
    if (!await eslint.isPathIgnored(filePath)) results.push(...await eslint.lintFiles([filePath]))
  }
  return { failed: results.some(result => result.errorCount || result.warningCount), results }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.env.CI && !process.env.MES_FORMAT_BASE) throw new Error('CI 必须显式提供 MES_FORMAT_BASE，不能按空工作区跳过格式检查。')
    const fix = process.argv.includes('--fix')
    if (fix && process.env.CI) throw new Error('CI 只检查，不自动修改源码。')
    const eslint = new ESLint({ fix })
    const { failed, results } = await checkChanged({
      eslint,
      base: process.env.MES_FORMAT_BASE || 'HEAD',
      defaultBranch: process.env.MES_FORMAT_DEFAULT_BRANCH
    })
    if (fix) await ESLint.outputFixes(results)
    const formatter = await eslint.loadFormatter('stylish')
    const output = formatter.format(results)
    if (output) process.stderr.write(output)
    console.log(`已检查 ${results.length} 个变更文件的完整格式与代码质量。`)
    if (failed) process.exitCode = 1
  } catch (error) {
    console.error('变更文件检查无法完成：', error.message)
    process.exitCode = 1
  }
}
