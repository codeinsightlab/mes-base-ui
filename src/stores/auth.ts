import { defineStore } from 'pinia'
import { ApiError, request } from '@/lib/request'
import { readSession, removeSession, saveSession } from '@/lib/sessionStorage'
import type { PermissionScope } from '@/lib/request'
import { routeMenus, type SourceRoute } from '@/lib/sourceMenus'
import type { PasswordPolicy } from '@/utils/passwordPolicy'
export interface Menu { id: string;name: string;path: string;permission: string;kind: string;children: Menu[];component?: string;hidden?: boolean;isCache?: boolean;query?: string;icon?: string;link?: string }
const restores = new WeakMap<object, Promise<void>>()
export const useAuth = defineStore('auth', { state: () => {
  const saved = readSession()
  return { passwordPolicy: { minLength: 12, maxLength: 128, maxBytes: 72 } as PasswordPolicy, token: saved?.token ?? '', avatar: '', username: '', factoryId: '', savedFactoryId: saved?.factoryId ?? '', sessionReady: false, sessionError: '', revision: 0, platformMenus: [] as Menu[], factoryMenus: [] as Menu[], platformPermissions: [] as string[], factoryPermissions: [] as string[], factories: [] as { factoryId: string;name: string }[], expiresAt: saved?.expiresAt ?? '' }
},
  getters: { loggedIn: s => !!s.token }, actions: {
    hasPermission(code:string, scope:PermissionScope = 'factory') { return (scope === 'platform' ? this.platformPermissions : this.factoryPermissions).includes(code) },
    clear() { removeSession();this.token = '';this.avatar = '';this.username = '';this.factoryId = '';this.savedFactoryId = '';this.expiresAt = '';this.sessionReady = true;this.sessionError = '';this.platformMenus = [];this.factoryMenus = [];this.platformPermissions = [];this.factoryPermissions = [];this.factories = [];this.revision++ },
    persistSession() { if (this.token) saveSession({ token: this.token, expiresAt: this.expiresAt, factoryId: this.factoryId }) },
    async restoreSession() {
      if (this.token && Date.parse(this.expiresAt) <= Date.now()) this.clear()
      if (this.sessionReady) return
      if (!this.token) { this.sessionReady = true;return }
      const pending = restores.get(this)
      if (pending) return pending
      const task = (async() => {
        this.sessionError = ''
        const revision = this.revision
        await this.loadNavigation()
        const factories = await request<typeof this.factories>('/api/foundation/factories', { scope: 'platform', query: { offset: 0, limit: 100 }})
        if (this.revision !== revision) throw new ApiError('CONTEXT_CHANGED', '上下文已切换，请重新加载')
        this.factories = factories
        const selected = this.savedFactoryId
        if (selected && factories.some(factory => factory.factoryId === selected)) await this.selectFactory(selected)
        else { this.savedFactoryId = '';this.persistSession() }
        this.sessionReady = true
      })()
      restores.set(this, task)
      try { await task } catch(error) { if (this.token) this.sessionError = error instanceof Error ? error.message : '登录状态恢复失败，请重试';throw error } finally { restores.delete(this) }
    },
    async login(username:string, password:string, code?:string, uuid?:string) { const session = await request<{ accessToken: string;expiresAt: string }>('/api/platform/session', { method: 'POST', body: { username, password, code, uuid }, scope: 'platform', public: true });this.token = session.accessToken;this.expiresAt = session.expiresAt;this.username = username;this.factoryId = '';this.savedFactoryId = '';this.revision++;try { await this.loadNavigation();this.factories = await request('/api/foundation/factories', { scope: 'platform', query: { offset: 0, limit: 100 }});this.persistSession();this.sessionReady = true } catch(e) { this.clear();throw e } },
    async loadNavigation() {
      const [info, response] = await Promise.all([request<{ user: { userName: string;avatar: string };permissions: string[];passwordPolicy: PasswordPolicy }>('/api/system/info', { scope: 'platform' }), request<{ data: SourceRoute[] }>('/api/system/getRouters', { scope: 'platform' })])
      this.passwordPolicy = info.passwordPolicy;this.username = info.user.userName;this.platformPermissions = info.permissions;this.avatar = info.user.avatar;this.platformMenus = routeMenus(response.data);this.factoryMenus = [];this.factoryPermissions = []
    },
    async refreshNavigation() { const factory = this.factoryId;await this.loadNavigation();this.revision++;if (factory) await this.selectFactory(factory) },
    async selectFactory(id:string) { this.factoryId = id;this.savedFactoryId = id;this.factoryMenus = [];this.factoryPermissions = [];this.revision++;this.persistSession();if (id) { const value = await request<{ permissions: string[];menus: SourceRoute[] }>('/api/system/factory-navigation', { scope: 'factory' });this.factoryPermissions = value.permissions;this.factoryMenus = routeMenus(value.menus) } },
    async logout() { try { await request<void>('/api/platform/session', { method: 'DELETE', scope: 'platform' }) } finally { this.clear() } }
  }})
