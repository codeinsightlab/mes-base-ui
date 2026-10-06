import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadLoginOptions } from '../src/api/loginOptions'
import { configureRequests } from '../src/lib/request'

afterEach(() => vi.unstubAllGlobals())
describe('server-controlled captcha requests', () => {
  function setup(enabled: boolean) {
    configureRequests(() => ({ token: '', factoryId: '', revision: 0 }), () => {})
    const options = { captchaOnOff: enabled, registrationEnabled: false, passwordPolicy: { minLength: 12, maxLength: 128, maxBytes: 72 } }
    const fetcher = vi.fn(async(path: string) => new Response(JSON.stringify(path === '/api/login-options' ? options : { ...options, uuid: 'TEST_ONLY', img: 'TEST_ONLY' })))
    vi.stubGlobal('fetch', fetcher)
    return { options, fetcher }
  }
  it('does not request an image when captcha is disabled', async() => {
    const { options, fetcher } = setup(false)
    expect(await loadLoginOptions()).toEqual(options)
    expect(fetcher.mock.calls.map(call => call[0])).toEqual(['/api/login-options'])
  })
  it('requests an image only after the server enables captcha', async() => {
    const { fetcher } = setup(true)
    expect((await loadLoginOptions()).uuid).toBe('TEST_ONLY')
    expect(fetcher.mock.calls.map(call => call[0])).toEqual(['/api/login-options', '/api/captchaImage'])
  })
  it('fails without requesting an image when settings cannot be read', async() => {
    const { fetcher } = setup(false)
    fetcher.mockRejectedValueOnce(new Error('TEST_ONLY'))
    await expect(loadLoginOptions()).rejects.toThrow('连接失败')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
