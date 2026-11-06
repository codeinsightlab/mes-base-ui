import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { reactive } from 'vue'
import ElementPlus from 'element-plus'
import Price from '@/components/business/purchase/PurchasePriceInput.vue'
import { useAuth } from '@/stores/auth'
const mocks = vi.hoisted(() => ({ preview: vi.fn() }))
vi.mock('@/api/purchase/purchaseReferencePrice', () => ({ previewPrice: mocks.preview }))
let wrapper:ReturnType<typeof mount> | undefined
beforeEach(() => { vi.useFakeTimers();mocks.preview.mockReset() })
afterEach(() => { wrapper?.unmount();vi.useRealTimers() })
function setup(disabled = false) {
  const pinia = createPinia(), auth = useAuth(pinia);auth.factoryId = 'A'
  const header = reactive({ supplierId: '1', businessDate: '2026-11-06' })
  const row = reactive<Record<string, unknown>>({ materialId: '2', quantity: '3', unitPrice: '1.005', amount: '3.02', referenceUnitPrice: '2' })
  wrapper = mount(Price, { props: { header, row, disabled, onChange: (patch:Record<string, unknown>) => Object.assign(row, patch) }, global: { plugins: [pinia, ElementPlus] }})
  return { auth, header, row }
}
it('keeps the manually negotiated price and uses only the server amount', async() => {
  mocks.preview.mockResolvedValue({ reference: { id: '9', unitPrice: '8.888888' }, amount: '3.02' })
  const { row } = setup();await vi.advanceTimersByTimeAsync(300);await flushPromises()
  expect(row.unitPrice).toBe('1.005');expect(row.amount).toBe('3.02');expect(row.referenceUnitPrice).toBe('8.888888')
  expect(mocks.preview).toHaveBeenCalledWith(expect.objectContaining({ unitPrice: '1.005', quantity: '3' }))
})
it('rejects a quote response from a previous business date', async() => {
  let release!:(result:unknown) => void
  mocks.preview.mockImplementationOnce(() => new Promise(resolve => { release = resolve })).mockResolvedValue({ reference: null, amount: '3.02' })
  const { header, row } = setup();await vi.advanceTimersByTimeAsync(300)
  header.businessDate = '2026-11-07';await flushPromises()
  release({ reference: { id: 'old', unitPrice: '99' }, amount: '297.00' });await flushPromises()
  expect(row.referencePriceId).not.toBe('old');expect(row.amount).not.toBe('297.00')
  await vi.advanceTimersByTimeAsync(300);await flushPromises();expect(row.amount).toBe('3.02')
})
it('shows posted snapshots without reading current prices', async() => {
  const { row } = setup(true);await vi.advanceTimersByTimeAsync(1000);expect(mocks.preview).not.toHaveBeenCalled();expect(row.amount).toBe('3.02');expect(row.referenceUnitPrice).toBe('2')
})
