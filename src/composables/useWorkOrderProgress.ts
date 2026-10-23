import { computed, onScopeDispose, reactive, ref, watch } from 'vue'
import { loadWorkOrderProgress, type WorkOrderProgressPage } from '@/api/production/workOrderProgress'
import type { WorkspaceResource } from './useWorkspaceStatus'

interface Access { factoryId: string; revision: number; hasPermission: (code: string, scope: 'factory') => boolean }
export function useWorkOrderProgress(access: Access, fetch = loadWorkOrderProgress) {
  const workorderCode = ref(''), productCode = ref(''), status = ref(''), page = ref(1), limit = ref(5)
  const result = reactive<WorkspaceResource<WorkOrderProgressPage>>({ state: 'idle', value: null, error: '', updatedAt: '' })
  const allowed = computed(() => access.hasPermission('workorder:list', 'factory'))
  const loading = computed(() => result.state === 'loading')
  let sequence = 0, disposed = false, previousLimit = 5
  function clear() {
    sequence++; result.value = null; result.error = ''; result.updatedAt = ''; result.state = 'idle'
  }
  async function load() {
    if (disposed) return
    if (!access.factoryId || !allowed.value) {
      clear()
      if (access.factoryId && !allowed.value) result.state = 'forbidden'
      return
    }
    const ticket = ++sequence, factory = access.factoryId, revision = access.revision
    const current = () => !disposed && ticket === sequence && factory === access.factoryId && revision === access.revision && allowed.value
    result.error = ''; result.state = 'loading'
    previousLimit = limit.value
    try {
      const value = await fetch({ workorderCode: workorderCode.value.trim(), productCode: productCode.value.trim(), status: status.value, offset: (page.value - 1) * limit.value, limit: limit.value })
      if (!current()) return
      result.value = value; result.state = 'ready'
      result.updatedAt = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    } catch (e) {
      if (!current()) return
      result.value = null; result.updatedAt = ''
      result.state = 'error'; result.error = e instanceof Error ? e.message : '工单进度读取失败'
    }
  }
  function search() { page.value = 1; return load() }
  function reset() { workorderCode.value = ''; productCode.value = ''; status.value = ''; return search() }
  function paginate() { if (previousLimit !== limit.value) page.value = 1; return load() }
  watch(() => [access.factoryId, access.revision, allowed.value], () => {
    clear()
    workorderCode.value = ''; productCode.value = ''; status.value = ''; page.value = 1; limit.value = 5
    void load()
  }, { immediate: true, flush: 'sync' })
  onScopeDispose(() => { disposed = true; clear() })
  return { workorderCode, productCode, status, page, limit, result, loading, allowed, load, search, reset, paginate }
}
