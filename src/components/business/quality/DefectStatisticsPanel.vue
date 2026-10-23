<script setup lang="ts">
import QueryForm from '@/components/QueryForm.vue'

import { quantityColumn } from '@/lib/production/quantity'
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { qualityV2 as api, wasteLabels, type Statistics } from '@/api/quality/qualityV2'
import { useAuth } from '@/stores/auth'
import Pagination from '@/components/Pagination/index.vue'
const props = defineProps<{ executionId?: string }>(), auth = useAuth(), allowed = computed(() => auth.hasPermission('business:quality:defect:read', 'factory'))
const rows = ref<Statistics[]>([]), page = ref(1), total = ref(0), category = ref(''), attribution = ref(''), from = ref(''), to = ref(''), error = ref(''), loading = ref(false)
let ticket = 0
function clear() { ticket++;rows.value = [];total.value = 0;error.value = '';loading.value = false }
async function load() { clear();if (!allowed.value) return;const t = ticket;loading.value = true;try { const p = await api.statistics({ ...(props.executionId ? { executionId: props.executionId } : {}), ...(category.value ? { wasteCategory: category.value } : {}), ...(attribution.value ? { attribution: attribution.value } : {}), ...(from.value ? { from: from.value } : {}), ...(to.value ? { to: to.value } : {}), offset: (page.value - 1) * 20, limit: 20 });if (t === ticket) { rows.value = p.items;total.value = p.total } } catch(e) { if (t === ticket)error.value = e instanceof Error ? e.message : '统计读取失败' } finally { if (t === ticket)loading.value = false } }
watch(() => [props.executionId, auth.factoryId, auth.revision, allowed.value], () => { clear();page.value = 1 }, { flush: 'sync' })
onBeforeUnmount(clear)
</script>
<template>
  <section aria-label="不良统计"><el-divider>不良统计</el-divider><el-alert v-if="error" :title="error" type="error" /><QueryForm inline @submit="page=1;load()"><el-form-item label="工废/料废类别"><el-select v-model="category" clearable style="width:160px"><el-option v-for="v in ['PROCESS','MATERIAL','BOTH']" :key="v" :label="wasteLabels[v]" :value="v" /></el-select></el-form-item><el-form-item label="申报核实"><el-select v-model="attribution" clearable style="width:150px"><el-option label="待核实" value="UNVERIFIED" /><el-option label="独立申报" value="INDEPENDENT" /><el-option label="重复申报" value="OVERLAP" /></el-select></el-form-item><el-form-item label="起始时间"><el-date-picker v-model="from" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" /></el-form-item><el-form-item label="结束时间"><el-date-picker v-model="to" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" /></el-form-item><el-button native-type="submit" :disabled="!allowed" >查询汇总</el-button></QueryForm><p class="secondary">统计使用独立筛选条件；未指定生产执行时，统计当前工厂全部记录。</p><el-table v-loading="loading" :data="rows"><el-table-column prop="operationId" label="工序ID" /><el-table-column label="不良类型"><template #default="{row}">{{ row.typeName||'未提供类型' }}</template></el-table-column><el-table-column label="工废/料废类别"><template #default="{row}">{{ wasteLabels[row.wasteCategory] }}</template></el-table-column><el-table-column label="处置数据"><template #default="{row}">{{ row.invalidActions>0 ? '处置数量待确认' : '可计算' }}</template></el-table-column><el-table-column :formatter="quantityColumn" prop="declaredQty" label="申报数量" /><el-table-column :formatter="quantityColumn" prop="independentQty" label="独立申报" /><el-table-column :formatter="quantityColumn" prop="overlapQty" label="重复申报" /><el-table-column :formatter="quantityColumn" prop="unverifiedQty" label="待核实" /></el-table><Pagination v-model:page="page" :total="total" :limit="20" @pagination="load" /></section>
</template>
