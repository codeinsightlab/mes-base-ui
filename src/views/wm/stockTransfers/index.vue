<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import MasterDetailDocument from '@/components/document/MasterDetailDocument.vue'
import MaterialSelect from '@/components/business/MaterialSelect.vue'
import WarehouseSelect from '@/components/business/WarehouseSelect.vue'
import StockSourceSelect from '@/components/business/warehouse/StockSourceSelect.vue'
import QuantityInput from '@/components/business/material/QuantityInput.vue'
import { ApiError } from '@/lib/request'
import { stockTransfers, transferView, transferCommand, type TransferCommand } from '@/api/wm/stockTransfers'
import { stockDocumentPermission as p, type ApprovalIntent } from '@/api/wm/stockDocuments'
import { useAuth } from '@/stores/auth'
import { useClosureCommand } from '@/composables/useClosureCommand'
import { usePageMessageBox } from '@/lib/pageMessageBox'
import { normalizedQuantityInput, positiveQuantity } from '@/lib/production/quantityRules'
import type { WmInventoryVo } from '@/api/wm/wmInventory'
import type { CrudApi, Field, Row } from '@/lib/crud'
const document = ref<InstanceType<typeof MasterDetailDocument> | null>(null), pendingCreate = ref<TransferCommand | null>(null)
const auth = useAuth(), message = usePageMessageBox(), error = ref(''), busy = ref(false), currentId = ref('')
const intent = useClosureCommand<ApprovalIntent>(() => `stock-transfer-post:${auth.username}:${auth.factoryId}:${currentId.value}`)
const route = useRoute()
let generation = 0, detailAttempt = 0, linkAttempt = 0
const readonly = computed(() => auth.runtimeMode !== 'LOCAL')
const unsupported = async(): Promise<never> => { throw Error('请使用调拨整单保存') }
const headerApi: CrudApi = { list: stockTransfers.list, detail: async id => (await transferView(await stockTransfers.detail(id))).header, create: unsupported, update: unsupported, remove: unsupported }
const itemApi: CrudApi = { list: unsupported, detail: unsupported, create: unsupported, update: unsupported, remove: unsupported }
async function create(raw: unknown) {
  const key = `stock-transfer-create:${auth.username}:${auth.factoryId}`, g = generation
  const saved = sessionStorage.getItem(key)
  const body = transferCommand(raw)
  if (saved) {
    const pending = JSON.parse(saved)
    if (JSON.stringify({ ...body, requestId: pending.requestId }) !== JSON.stringify(pending)) throw Error('存在待核实的原调拨创建请求，请恢复原明细后重试，勿另建调拨')
    body.requestId = pending.requestId
  } else body.requestId = crypto.randomUUID()
  sessionStorage.setItem(key, JSON.stringify(body))
  pendingCreate.value = body
  try {
    const result = await stockTransfers.create(body)
    if (g === generation) { sessionStorage.removeItem(key); pendingCreate.value = null }
    return transferView(result)
  } catch(e) {
    if (!saved && e instanceof ApiError && e.status >= 400 && e.status < 500 && g === generation) { sessionStorage.removeItem(key); pendingCreate.value = null }
    throw e
  }
}
const aggregateApi = {
  detail: async(id: string) => {
    const g = generation, attempt = ++detailAttempt, factory = auth.factoryId, revision = auth.revision
    const pair = await stockTransfers.detail(id)
    if (g !== generation || attempt !== detailAttempt || factory !== auth.factoryId || revision !== auth.revision) throw Error('当前上下文已变化，请重新读取调拨')
    currentId.value = pair.outbound.document.id; intent.clear(); intent.restore(); error.value = ''
    return transferView(pair)
  },
  create,
  update: async(id: string, raw: unknown) => transferView(await stockTransfers.update(id, transferCommand(raw)))
}
const fields: Field[] = [
  { key: 'documentNo', label: '调拨出库单号', kind: 'text', readonly: true, searchable: true, columnMinWidth: 220 },
  { key: 'targetDocumentNo', label: '关联入库单号', kind: 'text', readonly: true, columnMinWidth: 220 },
  { key: 'status', label: '状态', kind: 'select', readonly: true, searchable: true, options: [{ value: 'DRAFT', label: '草稿' }, { value: 'POSTED', label: '已审核' }, { value: 'CANCELLED', label: '已作废' }] },
  { key: 'reason', label: '调拨依据', kind: 'textarea', required: true },
  { key: 'remark', label: '备注', kind: 'textarea' },
  { key: 'createRequestId', label: '原创建UUID', kind: 'text', hidden: true }
]
const itemFields: Field[] = ['sourceStockId', 'targetStockId', 'targetWarehouseId', 'targetBinCode', 'quantity', 'remark'].map(key => ({ key, label: key, kind: 'text' }))
const validities = new WeakMap<object, boolean>()
function validate(items: Row[]) {
  if (!items.length) return '请添加调拨明细'
  for (const [index, line] of items.entries()) {
    if (!line.sourceStockId || !line.targetWarehouseId) return `第${index + 1}行请选择源库存与目标仓库`
    if (line.targetStockId && line.sourceStockId === line.targetStockId) return `第${index + 1}行请选择不同的源、目标库存`
    const quantity = normalizedQuantityInput(String(line.quantity ?? ''))
    if (!validities.get(line) || !positiveQuantity(quantity)) return `第${index + 1}行请输入符合物料单位规则的正数量`
    line.quantity = quantity
  }
  return null
}
function resetStock(line: Row) { line.sourceStockId = null; line.targetStockId = null; line.batchNo = null; line.unitId = null }
function sourceSelected(line: Row, stock: WmInventoryVo, unit: string) {
  line.materialId = stock.materialId; line.batchNo = stock.batchNo; line.unitId = unit; line.targetStockId = null
}
function targetSelected(line: Row, stock: WmInventoryVo) { line.targetBinCode = stock.binCode }
function targetWarehouseChanged(line: Row) { line.targetStockId = null; line.targetBinCode = null }
async function act(row: Row, refresh: () => Promise<void>, dirty: boolean, cancel = false) {
  if (readonly.value || busy.value || dirty || row.status !== 'DRAFT' || !auth.hasPermission(p + (cancel ? ':cancel' : ':post'), 'factory')) return
  const g = generation
  try { await message.confirm(cancel ? '作废双边调拨草稿，不改变库存。确认作废？' : '审核将同时扣减源库存并增加目标库存，两边在同一事务生效。确认审核？', cancel ? '作废调拨' : '审核调拨') } catch { return }
  if (g !== generation) return
  currentId.value = String(row.id);busy.value = true;error.value = ''
  try {
    if (cancel) { if (intent.pending.value) return; await stockTransfers.cancel(String(row.id), String(row.revision)); if (g === generation) await refresh() } else await intent.run(() => ({ requestId: crypto.randomUUID(), expectedRevision: String(row.revision) }), body => stockTransfers.approve(String(row.id), body), refresh)
  } catch(e) { if (g === generation) error.value = e instanceof Error ? e.message : '调拨操作失败' } finally { if (g === generation) busy.value = false }
}
function restoreCreate() {
  const saved = sessionStorage.getItem(`stock-transfer-create:${auth.username}:${auth.factoryId}`)
  try { pendingCreate.value = saved ? JSON.parse(saved) as TransferCommand : null } catch { error.value = '原创建请求无法读取，请联系管理员核实，勿另建调拨' }
}
async function recoverCreate() {
  if (!pendingCreate.value || busy.value || readonly.value || !auth.hasPermission(p + ':create', 'factory')) return
  const g = generation; busy.value = true; error.value = ''
  try {
    const result = await stockTransfers.create(pendingCreate.value)
    if (g !== generation) return
    sessionStorage.removeItem(`stock-transfer-create:${auth.username}:${auth.factoryId}`); pendingCreate.value = null
    await document.value?.open({ id: result.outbound.document.id })
  } catch(e) { if (g === generation) error.value = e instanceof Error ? e.message : '创建结果未知，请继续核实原请求' } finally { if (g === generation) busy.value = false }
}
async function openLinkedTransfer() {
  const attempt = ++linkAttempt, g = generation, id = route.query.documentId
  if (typeof id !== 'string' || !/^[1-9]\d*$/.test(id) || !auth.factoryId || !auth.hasPermission(p + ':query', 'factory')) return
  if (document.value?.hasUnsavedChanges()) {
    try { await message.confirm('放弃当前未保存的调拨修改并打开关联调拨？', '未保存的修改') } catch { return }
  }
  if (g !== generation || attempt !== linkAttempt) return
  await document.value?.open({ id })
}
function clear() { generation++; detailAttempt++; linkAttempt++; intent.clear(); error.value = ''; busy.value = false; currentId.value = ''; pendingCreate.value = null }
watch(() => [auth.factoryId, auth.revision, auth.factoryPermissions.join('|')], () => { clear(); restoreCreate() }, { flush: 'sync' })
onMounted(() => { restoreCreate(); void openLinkedTransfer() })
watch(() => route.query.documentId, openLinkedTransfer)
onBeforeUnmount(clear)
</script>
<template>
  <div>
    <el-alert title="本厂LOCAL库存同步调拨：保持物料、基本单位、批次；选择源库存、目标仓库及可选库位；目标物料、基本单位、批次继承源库存。保存自动解析目标身份或建立零余额身份及双边草稿，审核原子记账。" type="info" :closable="false" />
    <el-alert v-if="error || intent.error.value" :title="error || intent.error.value" type="error" :closable="false" />
    <el-alert v-if="pendingCreate" :title="'待核实的原创建UUID：'+pendingCreate.requestId" type="warning" :closable="false" />
    <el-button v-if="pendingCreate" :loading="busy" @click="recoverCreate">核实原调拨创建请求</el-button>
    <MasterDetailDocument
      ref="document"
      :creatable="!pendingCreate"
      title="库存调拨"
      :header-api="headerApi"
      :item-api="itemApi"
      :aggregate-api="aggregateApi"
      :header-fields="fields"
      :item-fields="itemFields"
      :header-permission="p"
      :item-permission="p"
      :deletable="false"
      revision-field="revision"
      parent-key="documentId"
      :header-readonly="row => readonly || !!row.status && row.status !== 'DRAFT' || !!intent.pending.value"
      :items-readonly="row => readonly || !!row.status && row.status !== 'DRAFT' || !!intent.pending.value"
      :validate-aggregate-items="validate"
    >
      <template #header-actions="{row, refresh, dirty}">
        <span v-if="row.targetDocumentId">关联入库单 {{ row.targetDocumentNo }}（{{ row.targetDocumentId }}）</span>
        <el-button v-if="row.id" :disabled="busy" @click="refresh">刷新双边单据</el-button>
        <el-button v-if="row.status==='DRAFT' && auth.hasPermission(p+':post','factory')" type="primary" :loading="busy" :disabled="dirty || readonly" @click="act(row,refresh,dirty)">{{ intent.pending.value ? '核实原审核请求' : '审核调拨' }}</el-button>
        <el-button v-if="row.status==='DRAFT' && auth.hasPermission(p+':cancel','factory')" type="danger" plain :disabled="busy || dirty || readonly || !!intent.pending.value" @click="act(row,refresh,dirty,true)">作废草稿</el-button>
        <el-alert v-if="intent.pending.value" :title="'原审核UUID：'+intent.pending.value.requestId+'；结果未知时仅核实原请求。'" type="warning" :closable="false" />
      </template>
      <template #items="{items,writable,add,remove,saving}">
        <el-button :disabled="!writable" @click="add({materialId:null,sourceWarehouseId:null,targetWarehouseId:null,sourceStockId:null,targetStockId:null,targetBinCode:null,quantity:'',remark:''})">添加调拨明细</el-button>
        <el-table :data="items">
          <el-table-column label="物料" min-width="180"><template #default="{row}"><MaterialSelect v-if="writable" v-model="row.materialId" @update:model-value="resetStock(row)" /><span v-else>{{ row.materialId }}</span></template></el-table-column>
          <el-table-column label="源仓库 / 库存" min-width="240"><template #default="{row}"><template v-if="writable"><WarehouseSelect v-model="row.sourceWarehouseId" source="LOCAL" @update:model-value="resetStock(row)" /><StockSourceSelect v-model="row.sourceStockId" :material-id="row.materialId" :warehouse-id="row.sourceWarehouseId" @selected="(stock,unit)=>sourceSelected(row,stock,unit)" /></template><span v-else>{{ row.warehouseId }} / {{ row.sourceStockId }}</span></template></el-table-column>
          <el-table-column label="源批次 / 基本单位" min-width="150"><template #default="{row}">{{ row.sourceStockId ? row.batchNo ?? '无批次' : '未选来源' }} / {{ row.unitId ?? '未选来源' }}</template></el-table-column>
          <el-table-column label="目标仓库 / 库位" min-width="240"><template #default="{row}"><template v-if="writable"><WarehouseSelect v-model="row.targetWarehouseId" source="LOCAL" @update:model-value="targetWarehouseChanged(row)" /><el-input v-model="row.targetBinCode" :disabled="!!row.targetStockId" maxlength="64" placeholder="目标库位（可选）" /></template><span v-else>{{ row.targetWarehouseId }} / {{ row.targetBinCode || '无库位' }}</span></template></el-table-column>
          <el-table-column label="已有目标库存（可选）" min-width="240"><template #default="{row}"><template v-if="writable"><StockSourceSelect v-model="row.targetStockId" :material-id="row.materialId" :warehouse-id="row.targetWarehouseId" :disabled="!row.sourceStockId" @selected="stock=>targetSelected(row,stock)" /><span class="secondary">留空时保存自动解析目标身份；无需手工预建零库存。</span></template><span v-else>{{ row.targetStockId }}</span></template></el-table-column>
          <el-table-column label="数量（基本单位）" min-width="160"><template #default="{row}"><QuantityInput v-if="writable" v-model="row.quantity" :material-id="row.materialId" required positive @validity="validities.set(row,$event)" /><span v-else>{{ row.quantity }}</span></template></el-table-column>
          <el-table-column label="备注" min-width="160"><template #default="{row}"><el-input v-if="writable" v-model="row.remark" maxlength="500" /><span v-else>{{ row.remark }}</span></template></el-table-column>
          <el-table-column v-if="writable" label="操作" width="80"><template #default="{$index}"><el-button link type="danger" :disabled="saving" @click="remove($index)">移除</el-button></template></el-table-column>
        </el-table>
      </template>
    </MasterDetailDocument>
  </div>
</template>
