<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { useAuth } from '@/stores/auth'
import type { Row } from '@/lib/crud'
import { submitMaterialIssue, reopenRejectedIssue } from '@/api/issue/mesMaterialIssue'
const props = defineProps<{ row: Row; refresh: () => Promise<void>; dirty: boolean }>()
const auth = useAuth(), busy = ref(false), error = ref(''), message = ref('')
const allowed = computed(() => auth.hasPermission('business:mes:material:issue:update', 'factory'))
let generation = 0
function clear() { generation++; busy.value = false; error.value = ''; message.value = '' }
watch(() => [props.row.id, auth.factoryId, auth.revision, allowed.value], clear)
onBeforeUnmount(clear)
async function run(reopen = false) {
 if(!allowed.value || props.dirty || !props.row.id || busy.value) return
 const seq = ++generation; busy.value = true; error.value = ''
 try { const result = await (reopen ? reopenRejectedIssue(String(props.row.id)) : submitMaterialIssue(String(props.row.id))); if(seq !== generation) return; await props.refresh(); if(seq !== generation) return; message.value = result.status === 'CONFIRMED' ? (result.sourceExecutionMode === 'LOCAL_ONLY' ? '本地模式，领料已确认' : 'ERP领料业务已确认') : result.status === 'DRAFT' ? '已重新打开草稿，原拒绝记录保留' : '提交结果：' + result.status }
 catch(e) { if(seq === generation) error.value = e instanceof Error ? e.message : '领料提交失败' }
 finally { if(seq === generation) busy.value = false }
}
</script>
<template>
 <el-button v-if="allowed && row.id && !row.submissionId && ['DRAFT','RECORDED'].includes(String(row.status))" type="primary" :disabled="dirty || !row.executionId || busy" :loading="busy" @click="run()">提交领料</el-button>
 <el-button v-if="allowed && row.status === 'SUBMIT_REJECTED' && !row.externalReference" :disabled="dirty || busy" @click="run(true)">重新打开拒绝草稿</el-button>
 <span v-if="row.status === 'CONFIRMED'" role="status">{{ row.sourceExecutionMode === 'LOCAL_ONLY' ? '本地模式，领料已确认' : 'ERP领料业务已确认' }}</span>
 <span v-if="['SUBMITTING','SUBMIT_UNKNOWN'].includes(String(row.status))">领料结果待核实，请查询或核实原操作，不要重复创建。</span>
 <el-alert v-if="error" :title="error" type="error" :closable="false" /><p v-if="message">{{ message }}</p>
</template>
