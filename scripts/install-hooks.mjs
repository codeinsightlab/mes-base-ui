import { execFileSync } from 'node:child_process'
import { existsSync, chmodSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
if (!existsSync(resolve(root, '.git'))) {
  console.log('源码包没有 .git，跳过 Git hook 安装。')
} else {
  const configured = git(['config', '--get', '--default', '', 'core.hooksPath'])
  if (configured && configured !== '.githooks') {
    throw new Error(`已有 core.hooksPath=${configured}，未覆盖；请在现有 pre-commit 中调用 npm run check:staged。`)
  }
  const oldHook = resolve(root, git(['rev-parse', '--git-path', 'hooks/pre-commit']))
  if (!configured && existsSync(oldHook)) {
    throw new Error('已有 pre-commit，未覆盖；请在现有 hook 中调用 npm run check:staged。')
  }
  chmodSync(resolve(root, '.githooks/pre-commit'), 0o755)
  if (!configured) git(['config', '--local', 'core.hooksPath', '.githooks'])
  console.log('已启用暂存区提交检查。')
}
