<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useAuth } from '@/stores/auth'
import { stockDocuments, type LineLabel, type StockDocumentDirection } from '@/api/wm/stockDocuments'
import type { Row } from '@/lib/crud'
import { formatQuantity } from '@/lib/quantity'
import { businessSourceLabel } from '@/lib/businessSource'
import MaterialSelect from '@/components/business/MaterialSelect.vue'
import WarehouseSelect from '@/components/business/WarehouseSelect.vue'
import StockSourceSelect from '@/components/business/warehouse/StockSourceSelect.vue'
import QuantityInput from '@/components/business/material/QuantityInput.vue'
import PurchasePriceInput from '@/components/business/purchase/PurchasePriceInput.vue'
const props = defineProps<{ header: Row; items: Row[]; writable: boolean; saving: boolean; canIssueLine: boolean; originalLines: Map<string, Row> }>()
const emit = defineEmits<{ remove: [number]; 'show-action': [unknown]; 'read-line': [Row]; validity: [object, boolean] }>()
const auth = useAuth(), labels = ref<LineLabel[]>([]), loading = ref(false), error = ref('')
let generation = 0
const pendingText = computed(() => loading.value ? '读取中…' : error.value ? '名称读取失败' : '名称待确认')
const byLine = computed(() => new Map(labels.value.map(row => [row.lineId, row])))
const label = (row: Row) => byLine.value.get(String(row.id))
async function loadLabels() {
  const ticket = ++generation
  labels.value = []; error.value = ''; loading.value = false
  if (!props.header.id || !props.items.length) return
  if (!auth.hasPermission('business:wm:stock:document:query', 'factory') && !auth.hasPermission('business:mes:material:issue:item:list', 'factory')) return
  loading.value = true
  try {
    const rows = await stockDocuments.lineLabels(String(props.header.id), props.header.direction as StockDocumentDirection, !auth.hasPermission('business:wm:stock:document:query', 'factory'))
    if (ticket === generation) labels.value = rows
  } catch(reason) {
    if (ticket === generation) error.value = reason instanceof Error ? reason.message : '名称读取失败'
  } finally { if (ticket === generation) loading.value = false }
}
function resetIdentity(row: Row) { row.stockId = null; row.batchNo = null; row.binCode = null; row.unitId = null }
function setQuantityValidity(row: object, valid: boolean) { emit('validity', row, valid) }
watch(() => [props.header.id, props.header.revision, auth.factoryId, auth.revision, auth.factoryPermissions.join('|')], loadLabels, { immediate: true })
onBeforeUnmount(() => { generation++; labels.value = [] })
</script>
<template>
  <div>
    <div v-if="error" class="reference-error" role="alert"><span>物料、仓库和单位名称读取失败，单据数量仍可查看。{{ error }}</span><el-button link type="primary" @click="loadLabels">重试</el-button></div>
    <el-table :data="items" border stripe>
      <el-table-column type="index" label="#" width="60" />
      <el-table-column label="物料 / 产品" :min-width="writable ? 340 : 190"><template #default="{row}"><MaterialSelect v-if="writable" v-model="row.materialId" @update:model-value="resetIdentity(row)" /><div v-else class="reference"><strong>{{ label(row)?.materialName || pendingText }}</strong><small>{{ label(row)?.materialCode }}</small></div></template></el-table-column>
      <el-table-column label="仓库" :min-width="writable ? 280 : 180"><template #default="{row}"><WarehouseSelect v-if="writable" v-model="row.warehouseId" source="LOCAL" @update:model-value="resetIdentity(row)" /><div v-else class="reference"><span>{{ label(row)?.warehouseName || pendingText }}</span><small>{{ label(row)?.warehouseCode }}<template v-if="label(row)?.warehouseSource"> · {{ businessSourceLabel(label(row)?.warehouseSource) }}</template></small></div></template></el-table-column>
      <el-table-column label="批次 / 库位" min-width="240"><template #default="{row}"><StockSourceSelect v-if="writable" v-model="row.stockId" :material-id="(row.materialId as string | null)" :warehouse-id="(row.warehouseId as string | null)" :batch-no="(row.batchNo as string | null)" :bin-code="(row.binCode as string | null)" :receipt="header.direction==='IN'" @selected="(s,unit)=>{row.materialId=s.materialId;row.warehouseId=s.warehouseId;row.batchNo=s.batchNo;row.binCode=s.binCode;row.unitId=unit}" /><div v-else class="reference"><span>{{ row.batchNo || '无批次' }}</span><small>{{ row.binCode ? '库位：' + row.binCode : '无库位' }}</small></div></template></el-table-column>
      <el-table-column v-if="!writable" label="基本单位" min-width="110"><template #default="{row}">{{ label(row)?.unitName || pendingText }}</template></el-table-column>
      <el-table-column label="数量" :min-width="writable ? 320 : 110"><template #default="{row}"><QuantityInput v-if="writable" v-model="row.quantity" show-unit :material-id="(row.materialId as string | null)" required positive :unchanged-value="originalLines.get(String(row.id))?.materialId===row.materialId && originalLines.get(String(row.id))?.stockId===row.stockId && originalLines.get(String(row.id))?.unitId===row.unitId ? originalLines.get(String(row.id))?.quantity as string : null" @validity="setQuantityValidity(row,$event)" /><span v-else>{{ formatQuantity(row.quantity as string) }}</span></template></el-table-column>
      <el-table-column v-if="header.documentType==='PURCHASE_RECEIPT'" label="成交单价 / 参考价" min-width="180"><template #default="{row}"><PurchasePriceInput :header="header" :row="row" :disabled="!writable" @change="Object.assign(row,$event)" /></template></el-table-column>
      <el-table-column v-if="header.documentType==='PURCHASE_RECEIPT'" label="成交金额（元）" min-width="130"><template #default="{row}">{{ row.amount ?? '—' }}</template></el-table-column>
      <el-table-column label="备注" min-width="160"><template #default="{row}"><el-input v-if="writable" v-model="row.remark" maxlength="500" /><span v-else>{{ row.remark || '—' }}</span></template></el-table-column>
      <el-table-column v-if="!writable" label="库存记录" width="120" fixed="right"><template #default="{row}"><el-button v-if="row.stockActionId&&auth.hasPermission('business:wm:stock:action:query','factory')" link type="primary" @click="$emit('show-action', row.stockActionId)">查看变动</el-button><span v-else>{{ row.stockActionId ? '已记录' : '—' }}</span></template></el-table-column>
      <el-table-column v-if="writable || header.documentType === 'MATERIAL_ISSUE' && canIssueLine" label="操作" width="100" fixed="right"><template #default="{row,$index}"><el-button v-if="writable" link type="danger" :disabled="saving" @click="$emit('remove', $index)">移除</el-button><el-button v-else-if="row.id" link type="primary" @click="$emit('read-line', row)">查看明细</el-button></template></el-table-column>
    </el-table>
  </div>
</template>
<style scoped>
.reference { display: flex; flex-direction: column; gap: var(--ui-space-1); line-height: 1.5; overflow-wrap: anywhere; }
.reference strong { font-weight: 500; }
.reference small { color: var(--ui-text-secondary); }
.reference-error { display: flex; align-items: center; gap: var(--ui-space-2); margin-bottom: var(--ui-space-3); color: var(--el-color-danger); }
</style>
