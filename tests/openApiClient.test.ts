import { describe, expect, it, vi } from 'vitest'
import OpenApiClient from '../src/views/system/openApiClient/index.vue'
vi.mock('../src/api/system/openApiClient', () => ({
  listClients: vi.fn(), getClient: vi.fn(), createClient: vi.fn(), changeStatus: vi.fn(),
  resetSecret: vi.fn(), getApiCatalog: vi.fn(), getClientApis: vi.fn(), replaceClientApis: vi.fn(), getDataScope: vi.fn()
}))
function state() {
  const options = OpenApiClient as unknown as { data: () => any; methods: Record<string, (...args: any[]) => any> }
  return Object.assign(options.data(), options.methods)
}
describe('restored OpenAPI administration', () => {
  it('selects and clears a complete API group while preserving unrelated grants', () => {
    const vm = state()
    vm.selectedApis = ['legacy.read']
    const group = { apis: [{ apiCode: 'diagnostics.ping' }, { apiCode: 'diagnostics.client' }] }
    vm.toggleGroup(group, true)
    expect(vm.selectedApis).toEqual(['legacy.read', 'diagnostics.ping', 'diagnostics.client'])
    vm.toggleGroup(group, true)
    expect(vm.selectedApis).toHaveLength(3)
    vm.toggleGroup(group, false)
    expect(vm.selectedApis).toEqual(['legacy.read'])
  })
  it('disposes one-time credentials when the page leaves', () => {
    const vm = state()
    vm.showSecret({ appKey: 'TEST_ONLY', appSecret: 'TEST ONLY' })
    expect(vm.secretOpen).toBe(true)
    vm.disposeSecrets()
    expect(vm.secret).toBeNull()
    expect(vm.secretOpen).toBe(false)
    vm.showSecret({ appKey: 'LATE_TEST', appSecret: 'TEST ONLY' })
    expect(vm.secret).toBeNull()
  })
})
