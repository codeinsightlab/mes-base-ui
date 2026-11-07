import { afterEach, expect, it, vi } from 'vitest'
import { getConfigKey } from '../src/api/system/config'
import { loadSearchOptionLimit, SEARCH_OPTION_LIMIT_KEY } from '../src/lib/searchOptionSettings'

afterEach(() => vi.resetAllMocks())
it('reads the latest system value on each search rather than caching a fixed limit', async() => {
  vi.mocked(getConfigKey).mockResolvedValueOnce({ data: '50' }).mockResolvedValueOnce({ data: '20' })
  expect(await loadSearchOptionLimit()).toBe(50)
  expect(await loadSearchOptionLimit()).toBe(20)
  expect(getConfigKey).toHaveBeenCalledWith(SEARCH_OPTION_LIMIT_KEY)
})
it('coalesces concurrent reads and releases the request after it completes', async() => {
  let resolve!: (result: { data: string }) => void
  vi.mocked(getConfigKey).mockImplementationOnce(() => new Promise(done => {
    resolve = done
  }))
  const first = loadSearchOptionLimit()
  const second = loadSearchOptionLimit()
  expect(first).toBe(second)
  resolve({ data: '20' })
  expect(await second).toBe(20)
  expect(getConfigKey).toHaveBeenCalledTimes(1)
  await loadSearchOptionLimit()
  expect(getConfigKey).toHaveBeenCalledTimes(2)
})
it.each(['', '0', '-1', '101', '1.5', 'bad'])('rejects invalid parameter %s without silently using 20', async value => {
  vi.mocked(getConfigKey).mockResolvedValueOnce({ data: value })
  await expect(loadSearchOptionLimit()).rejects.toThrow()
  expect(await loadSearchOptionLimit()).toBe(20)
})
it('propagates infrastructure failures and supports retry', async() => {
  vi.mocked(getConfigKey).mockRejectedValueOnce(new Error('offline'))
  await expect(loadSearchOptionLimit()).rejects.toThrow('offline')
  expect(await loadSearchOptionLimit()).toBe(20)
})
