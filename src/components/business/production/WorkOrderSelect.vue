<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useAuth } from '@/stores/auth'
import { api } from '@/api/production/workorder'
const model = defineModel<string | null>()
const props = defineProps<{ disabled?: boolean; source?: 'LOCAL' | 'EXTERNAL' | null; status?: string }>()
const auth = useAuth(), options = ref<{ id: string; label: string }[]>([]), loading = ref(false), error = ref('')
const allowed = computed(() => auth.hasPermission('workorder:list', 'factory'))
let ticket = 0
function clear() { ticket++; options.value = []; loading.value = false; error.value = ''; model.value = null }
watch(() => [auth.factoryId, auth.revision, props.source, props.status, allowed.value], clear)
onBeforeUnmount(() => { ticket++ })
async function search(code = '') {
  if (!allowed.value) return
  const current = ++ticket
  loading.value = true; error.value = ''
  try {
    const result = await api.list({ code, limit: 20, ...(props.source ? { source: props.source } : {}), ...(props.status ? { status: props.status } : {}) })
    if (current === ticket) options.value = result.items.filter(s => !props.source || s.workorder.source === props.source).map(s => ({ id: s.workorder.id, label: s.workorder.code + ' · ' + s.productCode + ' · ' + s.productName }))
  } catch(e) { if (current === ticket) error.value = e instanceof Error ? e.message : '工单查询失败' } finally { if (current === ticket) loading.value = false }
}
</script>
<template>
  <el-select v-if="allowed" v-model="model" filterable remote :remote-method="search" :loading="loading" :disabled="disabled" placeholder="搜索工单号" @visible-change="(v: boolean) => v && search()">
    <el-option v-for="option in options" :key="option.id" :value="option.id" :label="option.label" />
  </el-select>
  <el-input v-else v-model="model" :disabled="disabled" placeholder="工单 ID（无工单列表权限）" maxlength="19" />
  <p v-if="error" class="secondary">{{ error }}</p>
</template>
