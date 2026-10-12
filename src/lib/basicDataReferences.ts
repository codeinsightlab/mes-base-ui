import { onUnmounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useAuth } from '@/stores/auth'
import type { CrudApi, Field } from '@/lib/crud'

/** Options use each resource's read permission and discard results after a factory change. */
export function useBasicDataReferences(api: CrudApi, permission: string) {
  const auth = useAuth()
  const options = ref<NonNullable<Field['options']>>([])
  let generation = 0
  onUnmounted(() => generation++)
  const reload = async() => {
    const current = ++generation
    const revision = auth.revision
    if (!auth.hasPermission(permission + ':list', 'factory')) {
      options.value = []
      return
    }
    const rows = []
    try {
      for (let offset = 0; ; offset += 100) {
        const page = await api.list({ offset, limit: 100 })
        if (auth.revision !== revision || current !== generation) return
        rows.push(...page.items)
        if (rows.length >= page.total || page.items.length === 0) break
      }
      options.value = rows.map(row => ({ value: String(row.id), label: `${row.code} · ${row.name}` }))
    } catch (error) {
      if (auth.revision !== revision || current !== generation) return
      options.value = []
      ElMessage.error(error instanceof Error ? error.message : '引用数据加载失败')
    }
  }
  watch(() => [auth.revision, auth.hasPermission(permission + ':list', 'factory')], () => { options.value = []; void reload() }, { immediate: true })
  return { options, reload }
}
