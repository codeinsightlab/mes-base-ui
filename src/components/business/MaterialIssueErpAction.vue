<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { useAuth } from '@/stores/auth'
import type { Row } from '@/lib/crud'
import { queryIssueErp, reconcileIssueErp, type ErpIssueQueryView } from '@/api/issue/mesMaterialIssue'
const props = defineProps<{ row: Row; refresh: () => Promise<void>; dirty: boolean }>()
const auth = useAuth(), busy = ref(false), error = ref(''), view = ref<ErpIssueQueryView | null>(null)
const queryAllowed = computed(() => auth.hasPermission('business:mes:material:issue:erp:query', 'factory'))
const reconcileAllowed = computed(() => auth.hasPermission('business:mes:material:issue:erp:reconcile', 'factory'))
let generation = 0
function clear() { generation++; view.value = null; error.value = ''; busy.value = false }
watch(() => [props.row.id, auth.revision, auth.factoryId, queryAllowed.value, reconcileAllowed.value], clear)
onBeforeUnmount(clear)
async function run(reconcile: boolean) {
  if (!props.row.id || props.dirty || busy.value || !(reconcile ? reconcileAllowed.value : queryAllowed.value)) return
  const seq = ++generation, id = String(props.row.id)
  busy.value = true; error.value = ''
  try {
    const result = await (reconcile ? reconcileIssueErp(id) : queryIssueErp(id))
    if (seq !== generation) return
    view.value = result
    if (reconcile) {
      await props.refresh()
      if (seq !== generation) return
      if (props.row.workorderId) window.dispatchEvent(new CustomEvent('mes:workorder-changed', { detail: { factoryId: auth.factoryId, workorderId: props.row.workorderId }}))
    }
  } catch(reason) { if (seq === generation) error.value = reason instanceof Error ? reason.message : 'ERP状态操作失败' } finally { if (seq === generation) busy.value = false }
}
</script>
<template>
  <el-button v-if="row.id && queryAllowed" :loading="busy" :disabled="dirty" @click="run(false)">{{ ['SUBMITTING','SUBMIT_UNKNOWN'].includes(String(row.status)) ? '查询原领料结果' : '查询 ERP 状态' }}</el-button>
  <el-button v-if="row.id && reconcileAllowed" :loading="busy" :disabled="dirty" @click="run(true)">{{ ['SUBMITTING','SUBMIT_UNKNOWN'].includes(String(row.status)) ? '核实原领料结果' : '核实并同步' }}</el-button>
  <div v-if="view && (queryAllowed || reconcileAllowed)" role="status">
    <span>{{ view.result.executionMode }} · {{ view.result.outcome }} · {{ view.result.documentStatus }}</span>
    <span v-if="view.result.externalCode">ERP单号：{{ view.result.externalCode }}</span>
    <span>{{ view.result.message }}</span>
    <span v-if="view.lastOutcome">最近核实：{{ view.lastOutcome }} · {{ view.lastMessage }}</span>
  </div>
  <el-alert v-if="error" :title="error" type="error" :closable="false" />
</template>
