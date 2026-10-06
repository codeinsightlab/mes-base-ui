import { computed, onScopeDispose, reactive, watch } from 'vue'
import { list as listOnline } from '@/api/monitor/online'
import { listJob } from '@/api/monitor/job'
import { getServer } from '@/api/monitor/server'
import { getCache } from '@/api/monitor/cache'
import { list as listOperations } from '@/api/monitor/operlog'

export interface OperationRow {
  operId: string; requestId: string | null; title: string; operName: string; requestMethod: string;
  costTime: number | null; executionScope: string; factoryId: string | null; status: number; operTime: string
}
export interface JobRow { jobId: string; jobName: string; status: string; executionScope: string; factoryId: string | null; nextValidTime: string | null }
interface ListResult<T> { rows: T[]; total: number }
interface ServiceSnapshot { cpu: { free: number }; mem: { usage: number }; jvm: { runTime: string }}
interface CacheSnapshot { info: { redis_version: string; used_memory_human: string }; dbSize: number }
export interface WorkspaceLoaders {
  online: () => Promise<number>;
  jobs: () => Promise<ListResult<JobRow>>;
  server: () => Promise<ServiceSnapshot>;
  cache: () => Promise<CacheSnapshot>;
  operations: () => Promise<ListResult<OperationRow>>
}
interface Access { revision: number; hasPermission: (code: string, scope: 'platform') => boolean }
export interface WorkspaceResource<T> { state: 'idle' | 'loading' | 'ready' | 'error' | 'forbidden'; value: T | null; error: string; updatedAt: string }
const resource = <T>() => reactive({ state: 'idle', value: null, error: '', updatedAt: '' }) as WorkspaceResource<T>
const defaultLoaders: WorkspaceLoaders = {
  online: async() => (await listOnline({})).total,
  jobs: async() => listJob({ pageNum: 1, pageSize: 5 }),
  server: async() => (await getServer()).data,
  cache: async() => (await getCache()).data,
  operations: async() => listOperations({ pageNum: 1, pageSize: 6, orderByColumn: 'operTime', isAsc: 'descending' })
}
/** Read-only, permission gated snapshots. A new context owns all subsequent results. */
export function useWorkspaceStatus(access: Access, loaders = defaultLoaders) {
  const online = resource<number>(), jobs = resource<ListResult<JobRow>>(), server = resource<ServiceSnapshot>(), cache = resource<CacheSnapshot>(), operations = resource<ListResult<OperationRow>>()
  const resources = [online, jobs, server, cache, operations]
  const loading = computed(() => resources.some(item => item.state === 'loading'))
  let run = 0
  async function reload() {
    const current = ++run, revision = access.revision
    async function load<T>(target: WorkspaceResource<T>, permission: string, fetch: () => Promise<T>) {
      target.value = null; target.error = ''; target.updatedAt = ''
      if (!access.hasPermission(permission, 'platform')) { target.state = 'forbidden'; return }
      target.state = 'loading'
      try {
        const value = await fetch()
        if (current !== run || revision !== access.revision) return
        target.value = value; target.state = 'ready'; target.updatedAt = new Date().toLocaleTimeString('zh-CN', { hour12: false })
      } catch(error) {
        if (current !== run || revision !== access.revision) return
        target.state = 'error'; target.error = error instanceof Error ? error.message : '读取失败，请重试'
      }
    }
    await Promise.all([
      load(online, 'monitor:online:list', loaders.online), load(jobs, 'monitor:job:list', loaders.jobs),
      load(server, 'monitor:server:list', loaders.server), load(cache, 'monitor:cache:list', loaders.cache),
      load(operations, 'monitor:operlog:list', loaders.operations)
    ])
  }
  watch(() => access.revision, () => { void reload() }, { immediate: true })
  onScopeDispose(() => { run++ })
  return { online, jobs, server, cache, operations, loading, reload }
}
