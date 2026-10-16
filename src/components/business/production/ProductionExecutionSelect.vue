<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import { api, type MesProductionExecutionVo } from '@/api/production/mesProductionExecution'
import { useAuth } from '@/stores/auth'
const model = defineModel<string | null>()
defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ selected: [row: MesProductionExecutionVo] }>()
const auth = useAuth(), options = ref<MesProductionExecutionVo[]>([]), error = ref('')
let generation = 0
function clear() { generation++; options.value = []; error.value = '' }
watch(() => [auth.factoryId, auth.revision, auth.factoryPermissions.join('|')], clear)
onBeforeUnmount(clear)
async function search(executionNo = '') {
 if(!auth.hasPermission('business:mes:production:execution:list', 'factory')) return
 const seq = ++generation
 try { const result = await api.list({ executionNo, limit: 100 }); if(seq === generation) options.value = result.items.filter(row => row.status === 'READY' || row.status === 'RUNNING') }
 catch(e) { if(seq === generation) error.value = e instanceof Error ? e.message : '执行身份读取失败' }
}
function changed(id: string) { const row = options.value.find(r => r.id === id); if(row) emit('selected', row) }
</script>
<template><el-select v-model="model" :disabled="disabled" filterable remote :remote-method="search" placeholder="选择待执行或生产中的执行单元" @visible-change="(v: boolean) => v && search()" @change="changed"><el-option v-for="row in options" :key="row.id" :value="row.id" :label="row.executionNo + ' · 工单 ' + row.workorderId" /></el-select><p v-if="error">{{ error }}</p></template>
