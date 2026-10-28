<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { usePageMessageBox } from '@/lib/pageMessageBox'
import { useAuth } from '@/stores/auth'
import type { Row } from '@/lib/crud'
import { stockDocuments, type MaterialIssueVoidResult, type ProductionInputBasis } from '@/api/wm/stockDocuments'

const props = defineProps<{ row: Row; basis?: ProductionInputBasis | null; refresh: () => Promise<void>; dirty: boolean }>()
const auth = useAuth(), busy = ref(false), error = ref(''), result = ref<MaterialIssueVoidResult | null>(null)
const allowed = computed(() => auth.hasPermission('business:mes:material:issue:void', 'factory'))
const available = computed(() => !!props.row.id && props.row.status === 'POSTED' && auth.runtimeMode === 'LOCAL')
const canStartVoid = computed(() => available.value && (!props.basis || props.basis.voidOperationId == null
  && props.basis.stockApplied === true))
const canReconcile = computed(() => available.value && (!props.basis
  || props.basis.voidOperationId != null && ['UNKNOWN', 'SUBMITTING'].includes(String(props.basis.voidResultStatus))))
const messageBox = usePageMessageBox()
let generation = 0
function clear() { generation++;busy.value = false;error.value = '';result.value = null }
watch(() => [props.row.id, auth.revision, auth.factoryId, auth.runtimeMode, allowed.value], clear, { flush: 'sync' })
onBeforeUnmount(clear)
async function run(reconcile: boolean) {
  if (!allowed.value || !available.value || busy.value || props.dirty || (!reconcile && !canStartVoid.value)
      || (reconcile && !canReconcile.value)) return
  const current = generation, factory = auth.factoryId, revision = auth.revision, id = String(props.row.id)
  try {
    await messageBox.confirm(reconcile ? '核实原领料撤销操作，不创建新的库存动作。' : '确认撤销已审核的生产领料？生产和库存事实由服务端核对并按正式规则处理。', '领料撤销', { type: 'warning', confirmButtonText: '确认', cancelButtonText: '取消' })
    if (current !== generation || factory !== auth.factoryId || revision !== auth.revision || !allowed.value || !available.value) return
    busy.value = true;error.value = ''
    const response = await stockDocuments.voidMaterialIssue(id, reconcile)
    if (current !== generation || factory !== auth.factoryId || revision !== auth.revision) return
    if (response.documentId !== id) { error.value = '撤销结果的单据身份不一致，请重新读取确认';return }
    result.value = response
    await props.refresh()
    if (current !== generation || factory !== auth.factoryId || revision !== auth.revision) return
    if (props.row.sourceWorkorderId) window.dispatchEvent(new CustomEvent('mes:workorder-changed', { detail: { factoryId: factory, workorderId: props.row.sourceWorkorderId }}))
    ElMessage.info('已收到服务端响应，请核对单据及原撤销操作。')
  } catch(reason) {
    if (current === generation && factory === auth.factoryId && revision === auth.revision && reason !== 'cancel' && reason !== 'close') error.value = reason instanceof Error ? reason.message : '撤销操作失败'
  } finally { if (current === generation) busy.value = false }
}
</script>
<template>
  <template v-if="allowed && available">
    <el-button v-if="canStartVoid" type="warning" :loading="busy" :disabled="dirty || result?.productionInputStatus==='VOIDED'" @click="run(false)">撤销领料</el-button>
    <el-button v-if="canReconcile" :loading="busy" :disabled="dirty" @click="run(true)">核实原撤销</el-button>
  </template>
  <div v-if="result && allowed" role="status">
    <span>单据状态：{{ result.documentStatus || '待确认' }}；生产投入状态：{{ result.productionInputStatus || '待确认' }}；撤销结果：{{ result.voidResultStatus || '待确认' }}</span>
    <span v-if="result.voidOperationId">原撤销操作：{{ result.voidOperationId }}</span>
    <span v-if="result.voidRequestedAt">请求时间：{{ result.voidRequestedAt }}</span><span v-if="result.voidFinishedAt">完成时间：{{ result.voidFinishedAt }}</span>
    <span v-if="result.message">{{ result.message }}</span>
  </div>
  <el-alert v-if="error" :title="error" type="error" :closable="false" />
</template>
