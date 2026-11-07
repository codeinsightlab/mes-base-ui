import { onBeforeUnmount, ref, watch } from 'vue'
import { api, inventoryUnitLabels } from '@/api/wm/wmInventory'
import { useAuth } from '@/stores/auth'

/** Display labels load independently; their failure never replaces the inventory page with an error. */
export function useInventoryDisplay() {
  const auth = useAuth(), unitNames = ref<Record<string, string>>({}), unitError = ref(''), unitLoading = ref(false)
  let generation = 0, attempt = 0, stockIds: string[] = [], active = true
  function clear() { generation++; attempt++; stockIds = []; unitNames.value = {}; unitError.value = ''; unitLoading.value = false }
  async function loadUnits() {
    const scope = generation, ticket = ++attempt
    if (!active || !stockIds.length || !auth.hasPermission('business:wm:inventory:list', 'factory')) return
    unitError.value = '';unitLoading.value = true
    try {
      const labels = await inventoryUnitLabels(stockIds)
      if (scope === generation && ticket === attempt && active) unitNames.value = Object.fromEntries(labels.filter(row => row.unitName).map(row => [row.stockId, row.unitName!]))
    } catch(reason) {
      if (scope === generation && ticket === attempt && active) unitError.value = reason instanceof Error ? reason.message : '单位名称读取失败'
    } finally { if (scope === generation && ticket === attempt) unitLoading.value = false }
  }
  const displayApi = { ...api, list: async(query: Record<string, string | number>) => {
    clear();const ticket = generation
    const result = await api.list(query)
    if (ticket === generation && active) { stockIds = [...new Set(result.items.map(row => row.id))];void loadUnits() }
    return result
  } }
  watch(() => [auth.factoryId, auth.revision, auth.factoryPermissions.join('|')], clear, { flush: 'sync' })
  onBeforeUnmount(clear)
  return { displayApi, unitNames, unitError, unitLoading, loadUnits, pause: () => { active = false;clear() }, resume: () => { active = true } }
}
