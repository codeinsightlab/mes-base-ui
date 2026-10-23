import { computed, onScopeDispose, reactive, watch } from 'vue'
import { api as workorders } from '@/api/production/workorder'
import { api as executions } from '@/api/production/mesProductionExecution'
import { qualityTreatment } from '@/api/quality/qualityTreatment'
import { recentReports } from '@/api/production/workspace'
import type { WorkspaceResource } from './useWorkspaceStatus'

export const businessWorkspacePermissions = {
  orders: 'workorder:list', executions: 'business:mes:production:execution:list',
  reports: 'business:production:report:detail', defects: 'business:quality:defect:read'
}
export const businessWorkspaceLoaders = {
  drafts: () => workorders.list({ status: 'DRAFT', offset: 0, limit: 6 }),
  released: () => workorders.list({ status: 'RELEASED', offset: 0, limit: 1 }),
  ready: () => executions.list({ status: 'READY', offset: 0, limit: 6 }),
  running: () => executions.list({ status: 'RUNNING', offset: 0, limit: 1 }),
  reports: recentReports,
  defects: qualityTreatment.recent
}
interface Access {
  factoryId: string; revision: number
  hasPermission: (code: string, scope: 'factory') => boolean
}
const resource = <T>() => reactive({ state: 'idle', value: null, error: '', updatedAt: '' }) as WorkspaceResource<T>

/** Factory, permission and lifecycle changes synchronously invalidate old data. */
export function useBusinessWorkspace(access: Access, loaders = businessWorkspaceLoaders) {
  const drafts = resource<Awaited<ReturnType<typeof loaders.drafts>>>()
  const released = resource<Awaited<ReturnType<typeof loaders.released>>>()
  const ready = resource<Awaited<ReturnType<typeof loaders.ready>>>()
  const running = resource<Awaited<ReturnType<typeof loaders.running>>>()
  const reports = resource<Awaited<ReturnType<typeof loaders.reports>>>()
  const defects = resource<Awaited<ReturnType<typeof loaders.defects>>>()
  const resources = [drafts, released, ready, running, reports, defects]
  const permissions = () => Object.values(businessWorkspacePermissions).map(p => access.hasPermission(p, 'factory')).join(',')
  let sequence = 0, disposed = false
  const loading = computed(() => resources.some(r => r.state === 'loading'))
  function clear() {
    sequence++
    for (const target of resources) { target.value = null; target.state = 'idle'; target.error = ''; target.updatedAt = '' }
  }
  async function reload() {
    if (disposed) return
    const ticket = ++sequence, factory = access.factoryId, revision = access.revision, grants = permissions()
    const current = () => !disposed && ticket === sequence && factory === access.factoryId && revision === access.revision && grants === permissions()
    async function load<T>(target: WorkspaceResource<T>, permission: string, fetch: () => Promise<T>) {
      target.error = ''
      if (!factory) { target.value = null; target.updatedAt = ''; target.state = 'idle'; return }
      if (!access.hasPermission(permission, 'factory')) { target.value = null; target.updatedAt = ''; target.state = 'forbidden'; return }
      target.state = 'loading'
      try {
        const result = await fetch()
        if (!current()) return
        target.value = result; target.state = 'ready'; target.updatedAt = new Date().toLocaleTimeString('zh-CN', { hour12: false })
      } catch (e) {
        if (!current()) return
        target.value = null; target.updatedAt = ''
        target.state = 'error'; target.error = e instanceof Error ? e.message : '读取失败，请重试'
      }
    }
    await Promise.all([
      load(drafts, businessWorkspacePermissions.orders, loaders.drafts),
      load(released, businessWorkspacePermissions.orders, loaders.released),
      load(ready, businessWorkspacePermissions.executions, loaders.ready),
      load(running, businessWorkspacePermissions.executions, loaders.running),
      load(reports, businessWorkspacePermissions.reports, loaders.reports),
      load(defects, businessWorkspacePermissions.defects, loaders.defects)
    ])
  }
  watch(() => [access.factoryId, access.revision, permissions()], () => { clear(); void reload() }, { immediate: true, flush: 'sync' })
  onScopeDispose(() => {
    disposed = true; clear()
  })
  return { drafts, released, ready, running, reports, defects, loading, reload }
}
