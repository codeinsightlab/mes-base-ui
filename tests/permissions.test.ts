import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuth } from '../src/stores/auth';import { configureRequests } from '../src/lib/request'
beforeEach(() => { setActivePinia(createPinia()) })
describe('identity and scope separation', () => {
  it('never promotes factory permission to platform', () => { const s = useAuth();s.factoryPermissions = ['platform:users:read'];expect(s.hasPermission('platform:users:read', 'platform')).toBe(false);expect(s.hasPermission('platform:users:read', 'factory')).toBe(true) })
  it('clears factory grants immediately when switching, keeping platform grants', async() => { const s = useAuth();s.token = 'TEST';s.factoryId = 'A';s.factoryPermissions = ['config:read'];s.platformPermissions = ['platform:users:read'];configureRequests(() => ({ token: s.token, factoryId: s.factoryId, revision: s.revision }), () => s.clear());vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"menus":[],"permissions":[]}')));const switched = s.selectFactory('B');expect(s.factoryPermissions).toEqual([]);expect(s.platformPermissions).toEqual(['platform:users:read']);await switched;expect(s.hasPermission('config:read')).toBe(false) })
  it('clears all local credentials and grants on logout', () => { const s = useAuth();s.token = 'TEST';s.factoryId = 'A';s.factoryPermissions = ['read'];s.clear();expect(s.loggedIn).toBe(false);expect(s.factoryPermissions).toEqual([]);expect(s.factoryId).toBe('') })
})
