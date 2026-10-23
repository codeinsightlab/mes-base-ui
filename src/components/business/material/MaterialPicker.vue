<script setup lang="ts">
import PageDialog from '@/components/page/PageDialog.vue'

import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { api, type MaterialVo } from '@/api/basic/material'
import QueryForm from '@/components/QueryForm.vue'
import Pagination from '@/components/Pagination/index.vue'
import { useAuth } from '@/stores/auth'
const props = defineProps<{ unitNames?: Record<string, string> }>()
const auth = useAuth(), opened = ref(false), rows = ref<MaterialVo[]>([]), code = ref(''), name = ref(''), page = ref(1), total = ref(0), loading = ref(false), error = ref('')
const allowed = computed(() => auth.hasPermission('business:material:list', 'factory'))
let generation = 0, complete:((value:MaterialVo | null) => void) | null = null
function cancel() { generation++;opened.value = false;rows.value = [];complete?.(null);complete = null;error.value = '';loading.value = false }
async function load() {
  if (!opened.value || !allowed.value) return
  const current = ++generation;loading.value = true;error.value = ''
  try { const result = await api.list({ code: code.value, name: name.value, status: 'ENABLED', offset: (page.value - 1) * 20, limit: 20 });if (current === generation) { rows.value = result.items;total.value = result.total } } catch(reason) { if (current === generation)error.value = reason instanceof Error ? reason.message : '物料读取失败' } finally { if (current === generation)loading.value = false }
}
function choose() { cancel();if (!allowed.value) return Promise.resolve(null);opened.value = true;code.value = '';name.value = '';page.value = 1;void load();return new Promise<MaterialVo | null>(resolve => { complete = resolve }) }
function select(row:MaterialVo) { if (!allowed.value) return;const resolve = complete;complete = null;cancel();resolve?.(row) }
watch(() => [auth.revision, auth.factoryId, auth.factoryPermissions.join('|')], cancel)
onBeforeUnmount(cancel)
defineExpose({ choose, cancel })
</script>
<template>
  <PageDialog :model-value="opened" title="选择BOM组件物料" width="min(1040px,94vw)" append-to-body :before-close="()=>cancel()" destroy-on-close>
    <QueryForm inline @submit="page=1;load()"><el-form-item label="物料编码"><el-input v-model="code" clearable /></el-form-item><el-form-item label="物料名称"><el-input v-model="name" clearable /></el-form-item><el-button type="primary" native-type="submit">查询</el-button></QueryForm>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-table v-loading="loading" :data="rows" height="360" @row-dblclick="select"><el-table-column prop="code" label="物料编码" min-width="170" /><el-table-column prop="name" label="物料名称" min-width="180" /><el-table-column prop="specification" label="规格型号" min-width="150" /><el-table-column label="基本单位" min-width="110"><template #default="{row}">{{ props.unitNames?.[row.unitId] ?? row.unitId }}</template></el-table-column><el-table-column label="操作" width="90"><template #default="{row}"><el-button link type="primary" @click="select(row)">选择</el-button></template></el-table-column></el-table>
    <Pagination v-model:page="page" :total="total" :limit="20" :auto-scroll="false" @pagination="load" />
    <template #footer><el-button @click="cancel">取消</el-button></template>
  </PageDialog>
</template>
