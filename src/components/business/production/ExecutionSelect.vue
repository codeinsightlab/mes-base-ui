<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useAuth } from '@/stores/auth'
import { api, type MesProductionExecutionVo } from '@/api/production/mesProductionExecution'
const model = defineModel<string>({ default: '' })
const props = defineProps<{ workorderId?: string | null }>()
const auth = useAuth(), options = ref<MesProductionExecutionVo[]>([]), loading = ref(false), error = ref('')
const allowed = computed(() => auth.hasPermission('business:mes:production:execution:list', 'factory'))
let sequence = 0
function clear() { sequence++; options.value = []; loading.value = false; error.value = '' }
watch(() => [props.workorderId, auth.factoryId, auth.revision, allowed.value], clear, { flush: 'sync' })
onBeforeUnmount(clear)
async function search(id = '') {
  if (!allowed.value) return
  const ticket = ++sequence; loading.value = true; error.value = ''
  try { const data = await api.list({ ...(id ? { executionCode: id } : {}), ...(props.workorderId ? { workorderId: props.workorderId } : {}), offset: 0, limit: 20 }); if (ticket === sequence) options.value = data.items } catch(e) { if (ticket === sequence) error.value = e instanceof Error ? e.message : '执行单元检索失败' } finally { if (ticket === sequence) loading.value = false }
}
</script>
<template>
  <el-select v-if="allowed" v-model="model" filterable remote allow-create clearable :remote-method="search" :loading="loading" placeholder="输入执行码精确查询" @visible-change="(v: boolean) => v && search()"><el-option v-for="row in options" :key="row.executionCode" :value="row.executionCode" :label="row.executionCode" /></el-select>
  <el-input v-else v-model="model" clearable placeholder="输入 执行码" maxlength="2048" />
  <span v-if="error" class="secondary">{{ error }}</span>
</template>
