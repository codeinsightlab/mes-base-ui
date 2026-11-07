// TEST ONLY: selectors use a controlled system parameter; no config HTTP calls.
import { vi } from 'vitest'
vi.mock('../../src/api/system/config', async original => ({
  ...await original<typeof import('../../src/api/system/config')>(),
  getConfigKey: vi.fn(async() => ({ code: 200, data: '20' }))
}))
