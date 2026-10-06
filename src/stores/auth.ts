import { defineStore } from 'pinia'
import { request } from '@/lib/request'
import type { PermissionScope } from '@/lib/request'
import { routeMenus, type SourceRoute } from '@/lib/sourceMenus'
import type { PasswordPolicy } from '@/utils/passwordPolicy'
export interface Menu { id: string;name: string;path: string;permission: string;kind: string;children: Menu[];component?: string;hidden?: boolean;isCache?: boolean;query?: string;icon?: string;link?: string }
export const useAuth = defineStore('auth', { state: () => ({ passwordPolicy: { minLength: 12, maxLength: 128, maxBytes: 72 } as PasswordPolicy, token: '', avatar: '', username: '', factoryId: '', revision: 0, platformMenus: [] as Menu[], factoryMenus: [] as Menu[], platformPermissions: [] as string[], factoryPermissions: [] as string[], factories: [] as { factoryId: string;name: string }[], expiresAt: '' }),
  getters: { loggedIn: s => !!s.token }, actions: {
    hasPermission(code:string, scope:PermissionScope = 'factory') { return (scope === 'platform' ? this.platformPermissions : this.factoryPermissions).includes(code) },
    clear() { this.token = '';this.username = '';this.factoryId = '';this.expiresAt = '';this.platformMenus = [];this.factoryMenus = [];this.platformPermissions = [];this.factoryPermissions = [];this.factories = [];this.revision++ },
    async login(username:string, password:string, code?:string, uuid?:string) { const session = await request<{ accessToken: string;expiresAt: string }>('/api/platform/session', { method: 'POST', body: { username, password, code, uuid }, scope: 'platform', public: true });this.token = session.accessToken;this.expiresAt = session.expiresAt;this.username = username;this.revision++;try { await this.loadNavigation();this.factories = await request('/api/foundation/factories', { scope: 'platform', query: { offset: 0, limit: 100 }}) } catch(e) { this.clear();throw e } },
    async loadNavigation() {
      const [info, response] = await Promise.all([request<{ user: { userName: string;avatar: string };permissions: string[];passwordPolicy: PasswordPolicy }>('/api/system/info', { scope: 'platform' }), request<{ data: SourceRoute[] }>('/api/system/getRouters', { scope: 'platform' })])
      this.passwordPolicy = info.passwordPolicy;this.platformPermissions = info.permissions;this.avatar = info.user.avatar;this.platformMenus = routeMenus(response.data);this.factoryMenus = [];this.factoryPermissions = []
    },
    async refreshNavigation() { const factory = this.factoryId;await this.loadNavigation();this.revision++;if (factory) await this.selectFactory(factory) },
    async selectFactory(id:string) { this.factoryId = id;this.factoryMenus = [];this.factoryPermissions = [];this.revision++;if (id) { const value = await request<{ permissions: string[];menus: SourceRoute[] }>('/api/system/factory-navigation', { scope: 'factory' });this.factoryPermissions = value.permissions;this.factoryMenus = routeMenus(value.menus) } },
    async logout() { try { await request<void>('/api/platform/session', { method: 'DELETE', scope: 'platform' }) } finally { this.clear() } }
  }})
