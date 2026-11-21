import { createPinia, setActivePinia } from 'pinia'
import { effectScope } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, expect, it, vi } from 'vitest'
import { useAuth } from '../src/stores/auth'
import { access } from '../src/api/production/analytics'
import { useSection, plusDays } from '../src/components/business/analytics/useSection'

beforeEach(() => {
  setActivePinia(createPinia())
})
it('clears data on factory or permission changes and rejects late responses', async() => {
  const auth = useAuth()
  auth.$patch({ factoryId: 'A', runtimeMode: 'LOCAL', factoryPermissions: [access.menu, access.stock] })
  const reads: { signal: AbortSignal, resolve: (value:string) => void }[] = []
  const scope = effectScope()
  const result = scope.run(() => useSection(access.stock, () => true, signal => new Promise<string>(resolve => reads.push({ signal, resolve })), true))!
  auth.factoryId = 'B'
  expect(reads[0].signal.aborted).toBe(true)
  reads[0].resolve('factory A')
  reads[1].resolve('factory B')
  await flushPromises()
  expect(result.value.data).toBe('factory B')
  auth.factoryPermissions = [access.menu]
  expect(result.value).toMatchObject({ state: 'forbidden', data: undefined })
  scope.stop()
})
it('keeps an empty source readable while another fails, and blocks ERP even before selection', async() => {
  const auth = useAuth()
  auth.$patch({ factoryId: 'A', runtimeMode: 'LOCAL', factoryPermissions: [access.menu, access.orders, access.quality, access.stock] })
  const scope = effectScope()
  const orders = scope.run(() => useSection(access.orders, () => true, async() => []))!
  const loadQuality = vi.fn().mockRejectedValueOnce(new Error('质量读取失败')).mockResolvedValue(0)
  const quality = scope.run(() => useSection(access.quality, () => true, loadQuality))!
  await flushPromises()
  expect(orders.value).toMatchObject({ state: 'ready', data: [] })
  expect(quality.value).toMatchObject({ state: 'error', message: '质量读取失败' })
  quality.value.retry()
  await flushPromises()
  expect(quality.value).toMatchObject({ state: 'ready', data: 0 })
  const read = vi.fn()
  auth.runtimeMode = 'ERP'
  const inventory = scope.run(() => useSection(access.stock, () => false, read, true))!
  expect(inventory.value.state).toBe('unavailable')
  expect(read).not.toHaveBeenCalled()
  scope.stop()
})
it('counts inclusive business days across leap day and month boundaries', () => {
  expect(plusDays('2024-02-28', 2)).toBe('2024-03-01')
  expect(plusDays('2026-11-01', -1)).toBe('2026-10-31')
})
