<script setup lang="ts">
import PageDialog from '@/components/page/PageDialog.vue'

import { executionStatusLabel } from '@/lib/production/executionState'
import QueryForm from '@/components/QueryForm.vue'

import CodeScanner from '@/components/scanner/CodeScanner.vue'
import QuantityText from '@/components/business/production/QuantityText.vue'
import OperatorConfiguration from './OperatorConfiguration.vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useAuth } from '@/stores/auth'
import { readProductionIdentity, type ProductionIdentity } from '@/api/production/productionIdentity'
import { scanExecution, type ScanInputMethod } from '@/api/production/productionScan'

const props = defineProps<{ id?: string; selectable?: boolean }>()
const emit = defineEmits<{ selected: [identity: ProductionIdentity] }>()
const auth = useAuth()
const allowed = computed(() => !!auth.factoryId && !auth.factorySwitching && auth.hasPermission('business:mes:production:execution:query', 'factory'))
const visible = ref(false), loading = ref(false), code = ref(''), error = ref('')
const result = ref<ProductionIdentity | null>(null)
let sequence = 0
function clear() {
  sequence++
  loading.value = false
  visible.value = false
  code.value = ''
  error.value = ''
  result.value = null
}
function close(done:()=>void) { clear();done() }
watch(() => [props.id, auth.factoryId, auth.revision, allowed.value], clear, {flush:'sync'})
watch(visible, value => { if(!value)clear() }, {flush:'sync'})
onBeforeUnmount(clear)
async function loadIdentity(read:()=>Promise<ProductionIdentity>) {
  if (!allowed.value || !visible.value || loading.value) return
  const ticket = ++sequence, revision = auth.revision, factoryId = auth.factoryId
  loading.value = true
  result.value = null
  error.value = ''
  try {
    const identity = await read()
    if (ticket === sequence && revision === auth.revision && factoryId === auth.factoryId && allowed.value) result.value = identity
  } catch(failure) {
    if (ticket === sequence) error.value = failure instanceof Error ? failure.message : '身份查询失败'
  } finally {
    if (ticket === sequence) loading.value = false
  }
}
function resolve(inputMethod:ScanInputMethod='TEXT') { return loadIdentity(()=>scanExecution('EXECUTION_LOOKUP',code.value,inputMethod)) }
function scanned(value: string,inputMethod:ScanInputMethod='TEXT') {
  if(!allowed.value)return
  clear()
  code.value = value
  visible.value = true
  void resolve(inputMethod)
}
function open() {
  if(!allowed.value)return
  clear()
  visible.value = true
  if (props.id) {
    void loadIdentity(()=>readProductionIdentity(props.id!))
  }
}
</script>

<template>
  <el-button v-if="allowed && id" link type="primary" @click="open">身份码</el-button>
  <CodeScanner v-else-if="allowed" button-label="扫码查询" :context-key="auth.factoryId + ':' + auth.revision" @confirm="scanned" />
  <PageDialog v-model="visible" title="生产执行身份查询" width="min(640px, 94vw)" append-to-body :before-close="close">
    <QueryForm @submit="resolve()">
      <el-form-item label="执行身份码">
        <el-input v-model="code" placeholder="工单号:品号#批次号，例如 WO001:P001#LOT001" maxlength="2048" :disabled="loading" />
      </el-form-item>
      <el-button native-type="submit" type="primary" :loading="loading" :disabled="!code || !allowed" >查询</el-button>
      <CodeScanner v-model="code" button-label="图片识别 / 录入" :disabled="loading || !allowed || !visible" :context-key="auth.factoryId + ':' + auth.revision" @confirm="(value,method)=>resolve(method)" />
    </QueryForm>
    <p class="secondary">查询当前工厂的生产执行身份，不创建业务单据。</p>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-descriptions v-if="result" :column="1" border>
      <el-descriptions-item label="身份码">{{ result.qrCode || '未生成（未记录批次）' }}</el-descriptions-item>
      <el-descriptions-item label="执行ID">{{ result.executionId }}</el-descriptions-item>
      <el-descriptions-item label="工单">{{ result.workorderCode }}（{{ result.workorderId }}）</el-descriptions-item>
      <el-descriptions-item label="产出产品">{{ result.productCode }} · {{ result.productName }}</el-descriptions-item>
      <el-descriptions-item label="生产批次">{{ result.batchNo || '未记录' }}</el-descriptions-item>
      <el-descriptions-item label="工艺版本">{{ result.routingCode }} / V{{ result.routingVersion }}（{{ result.routingId }}）</el-descriptions-item>
      <el-descriptions-item label="执行状态">{{ executionStatusLabel(result.status) }}</el-descriptions-item>
      <el-descriptions-item label="计划执行数量"><QuantityText :value="result.targetQty" /></el-descriptions-item>
    </el-descriptions>
    <el-button v-if="selectable && result" type="primary" @click="emit('selected', result); clear()">使用此执行单元</el-button>
    <OperatorConfiguration v-if="result && !selectable" :execution-id="result.executionId" :context-label="result.executionId" />
  </PageDialog>
</template>
