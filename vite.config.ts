import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { loadEnv } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

export function validateApiTarget(value: string, localOnly: boolean): string {
  // This value is inserted into Nginx syntax. Accept an origin, never a URI,
  // credentials or directive characters; URL also validates the port range.
  if (typeof value !== 'string' || !/^https?:\/\/(?:[A-Za-z0-9.-]+|\[[A-Fa-f0-9:]+\])(?::\d{1,5})?\/?$/.test(value)) {
    throw new Error('MES_API_TARGET 必须为 http(s) 后端地址，不含路径、查询参数或凭证')
  }
  let target: URL
  try { target = new URL(value) } catch { throw new Error('MES_API_TARGET 后端地址或端口无效') }
  if (localOnly && (target.protocol !== 'http:' || target.hostname !== '127.0.0.1' || !target.port)) {
    throw new Error('Development proxy requires an explicit loopback backend')
  }
  return target.origin
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), 'MES_')
  const apiTarget = validateApiTarget(env.MES_API_TARGET, command === 'serve' || mode === 'development' || mode === 'test')
  return {
    plugins: [vue(), {
      name: 'mes-deployment-config',
      apply: 'build',
      writeBundle() {
        const template = readFileSync(new URL('./deploy/nginx.conf.template', import.meta.url), 'utf8')
        const outputDir = new URL('./target/deploy/', import.meta.url)
        mkdirSync(outputDir, { recursive: true })
        writeFileSync(new URL('nginx.conf', outputDir),
          `# Generated for mode: ${mode}\n` + template.replaceAll('__MES_API_TARGET__', apiTarget))
      }
    }],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }},
    server: {
      watch: env.MES_DEV_WATCH_POLLING === 'true' ? { usePolling: true, interval: 1000 } : undefined,
      proxy: command === 'serve' ? {
        '/api': { target: apiTarget },
        '/health': { target: apiTarget },
        '/open-api': { target: apiTarget }
      } : undefined
    },
    test: { environment: 'jsdom', restoreMocks: true }
  }
})
