import { onScopeDispose, ref, watch } from 'vue'
import { getDruidSnapshot, listDruidSources, type DruidCatalog, type DruidSnapshot } from '@/api/monitor/druid'
interface Access { revision: number; hasPermission: (code: string, scope: 'platform') => boolean }
export function useDruidMonitor(access: Access, loaders = { catalog: listDruidSources, snapshot: getDruidSnapshot }) {
  const catalog = ref<DruidCatalog | null>(null), snapshot = ref<DruidSnapshot | null>(null), selected = ref('')
  const pageNum = ref(1), pageSize = ref(20), loading = ref(false), detailLoading = ref(false), error = ref(''), detailError = ref('')
  let run = 0, detailRun = 0, disposed = false
  async function select(id: string) {
    const current = ++detailRun, revision = access.revision
    selected.value = id;snapshot.value = null;detailError.value = ''
    if (!id || !access.hasPermission('monitor:druid:list', 'platform')) { detailLoading.value = false;return }
    detailLoading.value = true
    try {
      const data = await loaders.snapshot(id)
      if (disposed || current !== detailRun || revision !== access.revision) return
      snapshot.value = data
    } catch(e) { if (!disposed && current === detailRun && revision === access.revision)detailError.value = e instanceof Error ? e.message : '数据源读取失败' } finally { if (!disposed && current === detailRun && revision === access.revision)detailLoading.value = false }
  }
  async function reload() {
    const current = ++run, revision = access.revision
    ++detailRun;detailLoading.value = false;snapshot.value = null;catalog.value = null;error.value = '';detailError.value = ''
    if (!access.hasPermission('monitor:druid:list', 'platform')) { selected.value = '';loading.value = false;error.value = '当前账号未授权查看数据源监控';return }
    loading.value = true
    try {
      const data = await loaders.catalog(pageNum.value, pageSize.value)
      if (disposed || current !== run || revision !== access.revision) return
      catalog.value = data
      await select(data.rows.some(source => source.id === selected.value) ? selected.value : data.rows[0]?.id ?? '')
    } catch(e) { if (!disposed && current === run && revision === access.revision)error.value = e instanceof Error ? e.message : '数据源目录读取失败' } finally { if (!disposed && current === run && revision === access.revision)loading.value = false }
  }
  watch(() => access.revision, () => { selected.value = '';pageNum.value = 1;void reload() }, { immediate: true })
  onScopeDispose(() => { disposed = true;++run;++detailRun })
  return { catalog, snapshot, selected, pageNum, pageSize, loading, detailLoading, error, detailError, select, reload }
}
