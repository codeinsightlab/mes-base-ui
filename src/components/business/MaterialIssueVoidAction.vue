<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import { useAuth } from '@/stores/auth'
import type { Row } from '@/lib/crud'
import { voidMaterialIssue } from '@/api/issue/mesMaterialIssue'
const props = defineProps<{ row: Row; refresh: () => Promise<void>; dirty: boolean }>()
const auth = useAuth(), busy = ref(false), error = ref('')
const allowed = computed(() => auth.hasPermission('business:mes:material:issue:void', 'factory'))
const pending = computed(() => ['VOID_PENDING','VOID_UNKNOWN'].includes(String(props.row.status)))
const available = computed(() => !!props.row.id && (pending.value || (!props.row.voidOperationId && ['DRAFT','RECORDED'].includes(String(props.row.status)))))
async function run() {
 if (!allowed.value || !available.value || busy.value || props.dirty) return
 const revision = auth.revision, factory = auth.factoryId, id = String(props.row.id)
 try {
  await ElMessageBox.confirm(pending.value ? '查询同一作废操作的外部结果，不重复执行冲销。' : '确认作废当前领料单？历史记录将保留，外部来源未核实的单据会由服务端拒绝。', '领料作废', {type:'warning', confirmButtonText:'确认', cancelButtonText:'取消'})
  if (revision !== auth.revision || factory !== auth.factoryId || !allowed.value) return
  busy.value = true; error.value = ''
  const result = await voidMaterialIssue(id, pending.value)
  if (revision !== auth.revision || factory !== auth.factoryId) return
  await props.refresh()
  if (revision !== auth.revision || factory !== auth.factoryId) return
  if (result.status === 'VOIDED' && result.workorderId)
    window.dispatchEvent(new CustomEvent('mes:workorder-changed', { detail: { factoryId: factory, workorderId: result.workorderId } }))
  ElMessage.info(result.status === 'VOIDED' ? '领料单已作废' : result.status === 'VOID_UNKNOWN' ? '外部结果待核实，单据仍阻止产品修改' : result.voidResultStatus === 'REJECTED' ? '外部拒绝作废，单据仍有效' : '作废处理中')
 } catch (reason) {
  if (revision === auth.revision && factory === auth.factoryId && reason !== 'cancel' && reason !== 'close') error.value = reason instanceof Error ? reason.message : '作废失败'
 } finally { busy.value = false }
}
</script>
<template>
 <el-button v-if="allowed && available" type="warning" :loading="busy" :disabled="dirty || row.externalEffect === 'UNVERIFIED' || !row.sourceExecutionMode" @click="run">{{ pending ? '核实作废结果' : '作废' }}</el-button>
 <span v-if="available && (row.externalEffect === 'UNVERIFIED' || !row.sourceExecutionMode)">外部来源未核实，不能自动本地作废</span>
 <span v-if="row.status === 'VOIDED'">已作废 · {{ row.voidExecutionMode }}</span>
 <span v-else-if="row.voidResultStatus === 'REJECTED'">ERP 拒绝作废，单据仍有效</span>
 <span v-else-if="pending">{{ row.status === 'VOID_UNKNOWN' ? '外部结果待核实' : '作废处理中' }}</span>
 <el-alert v-if="error" :title="error" type="error" :closable="false" />
</template>
