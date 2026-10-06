// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import configExport, { validateApiTarget } from '../vite.config'

afterEach(() => vi.unstubAllEnvs())

describe('environment backend configuration', () => {
  it('keeps all browser paths unchanged while configuring the development backend', async() => {
    vi.stubEnv('MES_API_TARGET', 'http://127.0.0.1:18081')
    if (typeof configExport !== 'function') throw new Error('Expected mode-aware Vite configuration')
    const config = await configExport({ command: 'serve', mode: 'development' })
    const proxy = config.server?.proxy
    for (const path of ['/api', '/open-api', '/health']) {
      expect(proxy?.[path]).toMatchObject({ target: 'http://127.0.0.1:18081' })
      expect(proxy?.[path]).not.toHaveProperty('rewrite')
    }
    expect(proxy).not.toHaveProperty('/dev-api')
    expect(config).not.toHaveProperty('define')
  })

  it('accepts a production server address without adding a development proxy', async() => {
    vi.stubEnv('MES_API_TARGET', 'https://backend.example.invalid:8443')
    if (typeof configExport !== 'function') throw new Error('Expected mode-aware Vite configuration')
    const config = await configExport({ command: 'build', mode: 'production' })
    expect(config.server?.proxy).toBeUndefined()
    expect(config).not.toHaveProperty('define')
    expect(validateApiTarget('https://backend.example.invalid:8443', false)).toBe('https://backend.example.invalid:8443')
    // Changing the mode must not bypass the existing development-server boundary.
    expect(() => configExport({ command: 'serve', mode: 'production' })).toThrow('explicit loopback backend')
  })

  it.each([
    '', '/api', 'http://127.0.0.1:65536', 'http://user:password@example.invalid',
    'http://example.invalid/api', 'http://example.invalid?target=x',
    'http://example.invalid#api', 'http://example.invalid;include',
    'http://example.invalid\ninclude /tmp/untrusted;'
  ])('rejects invalid or injectable backend configuration %j', (value) => {
    expect(() => validateApiTarget(value, false)).toThrow('MES_API_TARGET')
  })

  it.each(['http://example.invalid:8081', 'https://127.0.0.1:8081', 'http://127.0.0.1'])('retains the local-only development boundary for %s', (value) => {
    expect(() => validateApiTarget(value, true)).toThrow('explicit loopback backend')
  })
})
