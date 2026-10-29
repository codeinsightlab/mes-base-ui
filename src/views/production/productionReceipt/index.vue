<script setup lang="ts">
import PageDialog from '@/components/page/PageDialog.vue'

import QueryForm from '@/components/QueryForm.vue'

import { menuPathForComponent } from '@/lib/menuWorkspaces'
import { computed, reactive, ref, watch, onBeforeUnmount, onMounted } from 'vue'
import { useAuth } from '@/stores/auth'
import { productionReceipt as api, receiptPermissions, type Receipt } from '@/api/production/productionReceipt'
import QuantityText from '@/components/business/production/QuantityText.vue'
import { quantityColumn } from '@/lib/production/quantity'
import WarehouseAcceptancePanel from '@/components/business/warehouse/WarehouseAcceptancePanel.vue'
const auth = useAuth(), rows = ref<Receipt[]>([]), total = ref(0), offset = ref(0), error = ref(''), loading = ref(false)
const filters = reactive({ workorderId: '', executionId: '', productLotCode: '' }), requestId = ref(''), detail = ref<Awaited<ReturnType<typeof api.detail>> | null>(null), detailOpen = ref(false)
const inboundPath = computed(() => menuPathForComponent(auth.factoryMenus, 'wm/inboundDocuments/index'))
let generation = 0
function clear() { generation++;rows.value = [];total.value = offset.value = 0;error.value = '';loading.value = false;Object.assign(filters, { workorderId: '', executionId: '', productLotCode: '' });detail.value = null;detailOpen.value = false;requestId.value = '' }
async function load() { if (!auth.hasPermission(receiptPermissions.list, 'factory')) return;const g = ++generation;loading.value = true;error.value = '';try { const p = await api.page({ offset: offset.value, limit: 20, ...Object.fromEntries(Object.entries(filters).filter(([,v]) => v !== '')) });if (g === generation) { rows.value = p.items;total.value = p.total } } catch(e) { if (g === generation)error.value = e instanceof Error ? e.message : '历史读取失败' } finally { if (g === generation)loading.value = false } }
async function inspect() { if (loading.value || !requestId.value || !auth.hasPermission(receiptPermissions.detail, 'factory')) return;const g = ++generation;error.value = '';detail.value = null;detailOpen.value = true;try { const d = await api.detail(requestId.value);if (g === generation)detail.value = d } catch(e) { if (g === generation)error.value = e instanceof Error ? e.message : '原请求查询失败' } }
watch(() => [auth.factoryId, auth.revision, auth.factoryPermissions.join('|')], () => { clear();void load() }, { flush: 'sync' });onBeforeUnmount(clear);onMounted(load)
</script>
<template><div class="page"><div class="page-header"><h1>旧流程物流历史</h1><router-link v-if="inboundPath" :to="inboundPath">办理入库单</router-link></div><el-alert title="本页仅保留旧流程的历史事实。新业务已移除交接，库存按入库单审核记账，并据正式入库及数量闭合核对执行和工单收尾。" type="info" :closable="false" /><el-alert v-if="error" :title="error" type="error" :closable="false" />
  <QueryForm inline @submit="offset=0;load()"><el-form-item label="工单ID"><el-input v-model="filters.workorderId" clearable /></el-form-item><el-form-item label="执行ID"><el-input v-model="filters.executionId" clearable /></el-form-item><el-form-item label="产品批次"><el-input v-model="filters.productLotCode" clearable /></el-form-item><el-button native-type="submit">查询历史</el-button></QueryForm><div v-if="auth.hasPermission(receiptPermissions.detail,'factory')" class="table-toolbar"><el-input v-model="requestId" placeholder="原请求UUID（核实旧请求结果）" /><el-button :disabled="loading" @click="inspect">核实原记录</el-button></div><div class="table-toolbar"><el-button :disabled="loading" @click="load">刷新历史</el-button></div><el-table :data="rows" v-loading="loading"><el-table-column prop="receiptNo" label="历史单号" min-width="250" /><el-table-column prop="executionId" label="执行单元" min-width="180" /><el-table-column prop="workorderCode" label="工单" min-width="180" /><el-table-column prop="quantityDelta" label="历史数量" :formatter="quantityColumn" /><el-table-column prop="createTime" label="记录时间" min-width="190" /><el-table-column label="追溯"><template #default="{row}"><WarehouseAcceptancePanel :receipt-id="row.id" /></template></el-table-column></el-table>
  <div class="table-toolbar"><el-button :disabled="offset===0||loading" @click="offset-=20;load()">上一页</el-button><span>{{ total }}条</span><el-button :disabled="offset+20>=total||loading" @click="offset+=20;load()">下一页</el-button></div><PageDialog v-model="detailOpen" title="原请求历史事实（只读）" width="min(800px,94vw)"><template v-if="detail"><p>{{ detail.record.receiptNo }} · {{ detail.record.id }}</p><p>{{ detail.record.reason }}</p><p>原记录剩余历史数量：<QuantityText :value="detail.originalBalance" /></p><WarehouseAcceptancePanel :receipt-id="detail.record.id" /></template></PageDialog></div></template>
