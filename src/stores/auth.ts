import { defineStore } from 'pinia'
import { ApiError, request } from '@/lib/request'
import { readSession, removeSession, saveSession } from '@/lib/sessionStorage'
import type { PermissionScope } from '@/lib/request'
import { routeMenus, type SourceRoute } from '@/lib/sourceMenus'
import type { WorkspaceAccess } from '@/lib/workspaces'
import type { PasswordPolicy } from '@/utils/passwordPolicy'

export interface Menu {
  id: string;
  name: string;
  path: string;
  permission: string;
  kind: string;
  children: Menu[];
  component?: string;
  hidden?: boolean;
  isCache?: boolean;
  query?: string;
  icon?: string;
  link?: string
}

const restores = new WeakMap<object, Promise<void>>()
const switches = new WeakMap<object, object>()
export const useAuth = defineStore('auth', {
  state: () => {
    const saved = readSession()
    return {
      passwordPolicy: { minLength: 12, maxLength: 128, maxBytes: 72 } as PasswordPolicy,
      workspaceAccess: null as WorkspaceAccess | null,
      token: saved?.token ?? '',
      avatar: '',
      username: '',
      factoryId: '',
      savedFactoryId: saved?.factoryId ?? '',
      factorySwitching: false,
      sessionReady: false,
      sessionError: '',
      revision: 0,
      platformMenus: [] as Menu[],
      factoryMenus: [] as Menu[],
      platformPermissions: [] as string[],
      factoryPermissions: [] as string[],
      factories: [] as { factoryId: string; name: string }[],
      expiresAt: saved?.expiresAt ?? ''
    }
  },
  getters: { loggedIn: s => !!s.token }, actions: {
    hasPermission(code: string, scope: PermissionScope = 'factory') {
      return (scope === 'platform' ? this.platformPermissions : this.factoryPermissions).includes(code)
    },
    clear() {
      this.factorySwitching = false
      this.workspaceAccess = null
      removeSession()
      this.token = ''
      this.avatar = ''
      this.username = ''
      this.factoryId = ''
      this.savedFactoryId = ''
      this.expiresAt = ''
      this.sessionReady = true
      this.sessionError = ''
      this.platformMenus = []
      this.factoryMenus = []
      this.platformPermissions = []
      this.factoryPermissions = []
      this.factories = []
      this.revision++
    },
    persistSession() {
      if (this.token) saveSession({ token: this.token, expiresAt: this.expiresAt, factoryId: this.factoryId })
    },
    async restoreSession() {
      if (this.token && Date.parse(this.expiresAt) <= Date.now()) this.clear()
      if (this.sessionReady) return
      if (!this.token) {
        this.sessionReady = true
        return
      }
      const pending = restores.get(this)
      if (pending) return pending
      const task = (async() => {
        this.sessionError = ''
        await this.loadNavigation()
        await this.restoreFactory()
        this.sessionReady = true
      })()
      restores.set(this, task)
      try {
        await task
      } catch(error) {
        if (this.token) this.sessionError = error instanceof Error ? error.message : '登录状态恢复失败，请重试'
        throw error
      } finally {
        restores.delete(this)
      }
    },
    async login(username: string, password: string, code?: string, uuid?: string) {
      const session = await request<{
        accessToken: string;
        expiresAt: string
      }>('/api/session', {
        method: 'POST',
        body: { username, password, code, uuid },
        scope: 'platform',
        public: true
      })
      this.token = session.accessToken
      this.expiresAt = session.expiresAt
      this.username = username
      this.factoryId = ''
      this.savedFactoryId = ''
      this.revision++
      try {
        await this.loadNavigation()
        await this.restoreFactory()
        this.persistSession()
        this.sessionReady = true
      } catch(e) {
        this.clear()
        throw e
      }
    },
    async loadNavigation() {
      const revision = this.revision
      const [info, response] = await Promise.all([request<{
        user: { userName: string; avatar: string };
        permissions: string[];
        passwordPolicy: PasswordPolicy;
        workspaces: WorkspaceAccess
      }>('/api/session/info', { scope: 'platform' }), request<{
        data: SourceRoute[]
      }>('/api/session/menus', { scope: 'platform' })])
      if (revision !== this.revision) throw new ApiError('CONTEXT_CHANGED', '上下文已切换，请重新加载')
      this.workspaceAccess = info.workspaces
      this.passwordPolicy = info.passwordPolicy
      this.username = info.user.userName
      this.platformPermissions = info.permissions
      this.avatar = info.user.avatar
      this.platformMenus = routeMenus(response.data)
      this.factoryMenus = []
      this.factoryPermissions = []
    },
    async restoreFactory() {
      const revision = this.revision
      const [factories, context] = await Promise.all([
        request<typeof this.factories>('/api/foundation/factories', {
          scope: 'platform', query: { offset: 0, limit: 100 }
        }),
        request<{ factoryId: string | null }>('/api/foundation/context', { scope: 'platform' })
      ])
      if (revision !== this.revision) throw new ApiError('CONTEXT_CHANGED', '上下文已切换，请重新加载')
      this.factories = factories
      await this.selectFactory(context.factoryId ?? '', false)
    },
    async refreshNavigation() {
      await this.loadNavigation()
      await this.restoreFactory()
    },
    async selectFactory(id: string, remember = true) {
      if (this.factorySwitching) throw new ApiError('FACTORY_SWITCHING', '工厂切换正在进行')
      this.factorySwitching = true
      const switchMarker = {}
      switches.set(this, switchMarker)
      this.factoryMenus = []
      this.factoryPermissions = []
      const revision = ++this.revision
      try {
        if (id && remember) {
          const context = await request<{ factoryId: string }>('/api/foundation/preference', {
            method: 'PUT', body: { factoryId: id }, scope: 'platform'
          })
          if (revision !== this.revision) throw new ApiError('CONTEXT_CHANGED', '上下文已切换，请重新加载')
          if (context.factoryId !== id) throw new ApiError('INVALID_RESPONSE', '工厂切换响应不一致')
        }
        if (revision !== this.revision) throw new ApiError('CONTEXT_CHANGED', '上下文已切换，请重新加载')
        this.factoryId = id
        this.savedFactoryId = id
        const selectedRevision = ++this.revision
        this.persistSession()
        if (id) {
          const value = await request<{ permissions: string[]; menus: SourceRoute[] }>(
            '/api/factory/navigation', { scope: 'factory' }
          )
          if (selectedRevision !== this.revision || this.factoryId !== id) {
            throw new ApiError('CONTEXT_CHANGED', '上下文已切换，请重新加载')
          }
          this.factoryPermissions = value.permissions
          this.factoryMenus = routeMenus(value.menus)
        }
      } finally {
        if (switches.get(this) === switchMarker) {
          this.factorySwitching = false
          switches.delete(this)
        }
      }
    },
    async logout() {
      try {
        await request<void>('/api/session', { method: 'DELETE', scope: 'platform' })
      } finally {
        this.clear()
      }
    }
  }
})
