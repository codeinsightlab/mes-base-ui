<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import { api, type MesProductionExecutionVo } from '@/api/production/mesProductionExecution'
import { useAuth } from '@/stores/auth'
const model = defineModel<string | null>()
const props=withDefaults(defineProps<{ disabled?: boolean; statuses?: string[] }>(),{statuses:()=>['READY','RUNNING']})
const emit = defineEmits<{ selected: [row: MesProductionExecutionVo] }>()
const auth = useAuth(), options = ref<MesProductionExecutionVo[]>([]), error = ref('')
let generation = 0
function clear() { generation++; options.value = []; error.value = '' }
watch(() => [auth.factoryId, auth.revision, auth.factoryPermissions.join('|')], clear)
onBeforeUnmount(clear)
async function search(id = '') {
 if(!auth.hasPermission('business:mes:production:execution:list', 'factory')) return
 const seq = ++generation
 if(id&&!/^[1-9]\d{0,18}$/.test(id)){options.value=[];error.value='请输入有效的执行ID';return}
 error.value=''
 try { const result = await api.list({ ...(id?{id}:{}), limit: 100 }); if(seq === generation) options.value = result.items.filter(row => props.statuses.includes(row.status)) }
 catch(e) { if(seq === generation) error.value = e instanceof Error ? e.message : '执行身份读取失败' }
}
function changed(id: string) { const row = options.value.find(r => r.id === id); if(row) emit('selected', row) }
</script>
<template><el-select v-model="model" clearable :disabled="disabled" filterable remote :remote-method="search" placeholder="输入执行ID精确查询" @visible-change="(v: boolean) => v && search()" @change="changed"><el-option v-for="row in options" :key="row.id" :value="row.id" :label="row.id + ' · 工单 ' + row.workorderId" /></el-select><p v-if="error">{{ error }}</p></template>
