<script setup lang="ts">
import { usePageMessageBox } from '@/lib/pageMessageBox'

import PageDrawer from '@/components/page/PageDrawer.vue'

import { menuPathForComponent } from '@/lib/menuWorkspaces'
import { computed, onBeforeUnmount, onDeactivated, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useAuth } from '@/stores/auth'
import { ApiError } from '@/lib/request'
import { api, type WmInventoryVo } from '@/api/wm/wmInventory'
import { localStock, stockOperations, type StockOperation, type StockCommand, type StockAction } from '@/api/wm/localStock'
const ElMessageBox = usePageMessageBox()

const emit = defineEmits<{ changed: [] }>()
const router = useRouter()
const auth = useAuth(), visible = ref(false), stockId = ref(''), stock = ref<WmInventoryVo | null>(null)
const operation = ref<StockOperation>('receipt'), error = ref(''), busy = ref(false), loading = ref(false)
const rows = ref<StockAction[]>([]), total = ref(0), offset = ref(0)
const form = reactive({ quantity: '', reason: '', issueId: '' })
const pending = ref<{ operation: StockOperation; command: StockCommand } | null>(null)
const granted = computed(() => stockOperations.filter(o => auth.hasPermission('business:wm:stock:' + o.value, 'factory')))
const options = computed(() => (pending.value || auth.runtimeMode === 'LOCAL' && stock.value?.warehouseSource === 'LOCAL' ? granted.value : []).filter(o => o.value !== 'receipt' || pending.value?.operation === 'receipt'))
const inboundPath = computed(() => menuPathForComponent(auth.factoryMenus, 'wm/stockDocuments/index'))
const readable = computed(() => auth.hasPermission('business:wm:stock:action:list', 'factory'))
let generation = 0, attempt = 0, uncertain = false
const key = () => `mes-stock-pending:${auth.username}:${auth.factoryId}:${stockId.value}`
function clear() { generation++; attempt++; stock.value = null; rows.value = []; total.value = offset.value = 0; error.value = ''; busy.value = loading.value = false; pending.value = null; uncertain = false; Object.assign(form, { quantity: '', reason: '', issueId: '' }) }
async function load() {
  const scope = generation, ticket = ++attempt; loading.value = true; error.value = ''
  try {
    const [current, actions] = await Promise.all([api.detail(stockId.value), readable.value ? localStock.actions(stockId.value, offset.value) : Promise.resolve({ items: [], total: 0 })])
    if (scope !== generation || ticket !== attempt) return
    stock.value = current; rows.value = actions.items; total.value = actions.total
    if (!pending.value && !options.value.some(o => o.value === operation.value)) operation.value = options.value[0]?.value ?? 'receipt'
  } catch(e) { if (scope === generation && ticket === attempt) error.value = e instanceof Error ? e.message : '库存读取失败' } finally { if (scope === generation && ticket === attempt) loading.value = false }
}
function open(id: string) {
  clear(); stockId.value = id; operation.value = options.value[0]?.value ?? 'receipt'; visible.value = true
  const saved = sessionStorage.getItem(key())
  if (saved) { try { pending.value = JSON.parse(saved); uncertain = true; operation.value = pending.value!.operation } catch { error.value = '原请求无法读取，请核实库存流水后处理'; return } }
  void load()
}
defineExpose({ open })
async function submit() {
  if (busy.value || !stock.value || !options.value.some(o => o.value === operation.value)) return
  if (!pending.value) {
    if (!/^-?\d{1,14}(\.\d{1,6})?$/.test(form.quantity) || !form.reason.trim() || operation.value === 'return' && !form.issueId) { error.value = '请填写精确数量、业务原因及退料原领料编号'; return }
    pending.value = { operation: operation.value, command: { requestId: crypto.randomUUID(), stockId: stockId.value, quantity: form.quantity, expectedQuantity: stock.value.quantity, expectedAvailable: stock.value.availableQuantity ?? stock.value.quantity, reason: form.reason, issueId: operation.value === 'return' ? form.issueId : null }}
    sessionStorage.setItem(key(), JSON.stringify(pending.value))
  }
  const scope = generation, storageKey = key(); busy.value = true; error.value = ''
  try {
    await localStock.execute(pending.value.operation, pending.value.command)
    if (scope !== generation) return
    sessionStorage.removeItem(storageKey); pending.value = null; uncertain = false; Object.assign(form, { quantity: '', reason: '', issueId: '' }); offset.value = 0; emit('changed'); await load()
  } catch(e) {
    if (scope !== generation) return
    error.value = e instanceof Error ? e.message : '结果未知，请使用原请求重查'
    if (!uncertain && e instanceof ApiError && e.status >= 400 && e.status < 500) { sessionStorage.removeItem(storageKey); pending.value = null } else uncertain = true
  } finally { if (scope === generation) busy.value = false }
}
async function beforeClose(done: () => void) {
  if (busy.value) return
  const scope = generation
  if (form.quantity || form.reason || pending.value) { try { await ElMessageBox.confirm(pending.value ? '原请求已保留，下次打开可核实。关闭面板？' : '放弃未提交的库存操作？', '关闭确认') } catch { return } }
  if (scope !== generation) return
  clear(); done()
}
async function openInbound() { if (!inboundPath.value) return;const path = inboundPath.value;await beforeClose(() => { visible.value = false;void router.push({ path }) }) }
async function openIssues() {
  await beforeClose(() => {
    visible.value = false
    void router.push({ path: '/issue/mesMaterialIssue', query: { view: 'list' }})
  })
}
watch(() => [auth.factoryId, auth.revision, granted.value.map(o => o.value).join(','), readable.value], () => { clear(); visible.value = false }, { flush: 'sync' })
onBeforeUnmount(clear)
onDeactivated(() => { visible.value = false; clear() })
const label = (value: string) => ({ OPENING: '期初建账', RECEIPT: '历史原材料入库', ISSUE: '生产领料', RETURN: '生产退料', GAIN: '盘盈', LOSS: '盘亏', CORRECTION: '业务纠错', REVERSAL: '原操作撤销', PRODUCT_RECEIPT: '历史成品入库', PRODUCT_REVERSAL: '历史成品入库逆向' }[value] ?? value)
</script>
<template>
  <PageDrawer v-model="visible" title="LOCAL 库存业务与流水" size="min(1120px, 96vw)" :before-close="beforeClose" @closed="clear">
    <el-alert v-if="stock && auth.runtimeMode!=='LOCAL' && !pending" title="当前工厂模式不允许新增LOCAL库存动作；历史流水仍可读取" type="info" :closable="false" />
    <el-alert v-if="stock && stock.warehouseSource !== 'LOCAL'" title="外部镜像或未核实来源仅供参考，不允许新增本地库存动作" type="warning" :closable="false" />
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <div v-loading="loading">
      <el-descriptions v-if="stock" :column="2" border>
        <el-descriptions-item label="库存来源">{{ stock.id }}</el-descriptions-item><el-descriptions-item label="物料 / 仓库">{{ stock.materialId }} / {{ stock.warehouseId }}</el-descriptions-item>
        <el-descriptions-item label="批次 / 库位">{{ stock.batchNo || '—' }} / {{ stock.binCode || '—' }}</el-descriptions-item><el-descriptions-item label="实存 / 可用">{{ stock.quantity }} / {{ stock.availableQuantity ?? stock.quantity }}</el-descriptions-item>
      </el-descriptions>
      <el-alert title="数量使用物料基本单位。业务入库统一使用入库单。退料仅支持未开工且无报工、质量和库存收发事实的原领料；退料不改变产品投产额度。整单撤销请到原领料单核实。" type="info" :closable="false" />
      <el-alert v-if="pending" :title="'原请求已冻结：' + pending.command.requestId + '，请使用原请求核实结果'" type="warning" :closable="false" />
      <el-form v-if="options.length" label-width="110px" :disabled="busy || !!pending">
        <el-form-item label="业务动作"><el-select v-model="operation"><el-option v-for="o in options" :key="o.value" :value="o.value" :label="o.label" /></el-select></el-form-item>
        <el-form-item v-if="operation === 'return'" label="原领料编号"><el-input v-model="form.issueId" placeholder="MES 原领料 ID" /></el-form-item>
        <el-form-item label="数量增减量"><el-input v-model="form.quantity" placeholder="盘亏填写正数；业务纠错使用有符号增减量" /></el-form-item>
        <el-form-item label="依据 / 凭据"><el-input v-model="form.reason" type="textarea" maxlength="500" placeholder="期初依据、入库来源、外部凭据或调整原因" /></el-form-item>
      </el-form>
      <div class="table-toolbar"><el-button v-if="options.length" type="primary" :loading="busy" :disabled="!stock || loading" @click="submit">{{ pending ? '核实原请求' : '确认库存动作' }}</el-button><el-button :disabled="busy" @click="load">刷新余额与流水</el-button><el-button v-if="inboundPath" :disabled="busy" @click="openInbound">办理入库单</el-button><el-button type="primary" plain :disabled="busy" @click="openIssues">原领料状态及撤销</el-button></div>
      <el-alert v-if="!readable" title="当前账号未获库存流水查询权限" type="info" :closable="false" />
      <el-table v-if="readable" :data="rows" empty-text="暂无库存动作；历史余额不会自动补记流水">
        <el-table-column label="动作" min-width="120"><template #default="{row}">{{ label(row.actionType) }}</template></el-table-column>
        <el-table-column prop="unitId" label="基本单位 ID" min-width="120" /><el-table-column prop="quantityDelta" label="实存增减" min-width="130" /><el-table-column prop="availableDelta" label="可用增减" min-width="130" />
        <el-table-column prop="quantityBefore" label="实存前" min-width="130" /><el-table-column prop="quantityAfter" label="实存后" min-width="130" />
        <el-table-column prop="availableBefore" label="可用前" min-width="130" /><el-table-column prop="availableAfter" label="可用后" min-width="130" />
        <el-table-column show-overflow-tooltip prop="batchNo" label="批次" min-width="130" /><el-table-column show-overflow-tooltip prop="binCode" label="库位" min-width="100" />
        <el-table-column show-overflow-tooltip prop="sourceId" label="来源单据" min-width="130" /><el-table-column show-overflow-tooltip prop="operatorUserId" label="操作者" min-width="100" />
        <el-table-column show-overflow-tooltip prop="occurredAt" label="业务时间" min-width="200" /><el-table-column show-overflow-tooltip prop="reason" label="业务依据" min-width="240" />
        <el-table-column show-overflow-tooltip prop="id" label="请求 UUID" min-width="300" /><el-table-column show-overflow-tooltip prop="referenceActionId" label="原动作" min-width="300" />
      </el-table>
      <div v-if="readable" class="table-toolbar"><el-button :disabled="offset === 0 || loading" @click="offset -= 20; load()">上一页</el-button><span>{{ offset + 1 }} / {{ total }}</span><el-button :disabled="offset + 20 >= total || loading" @click="offset += 20; load()">下一页</el-button></div>
    </div>
  </PageDrawer>
</template>
