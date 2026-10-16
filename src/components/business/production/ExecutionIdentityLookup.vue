<script setup lang="ts">
import OperatorConfiguration from './OperatorConfiguration.vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useAuth } from '@/stores/auth'
import { resolveProductionIdentity, type ProductionIdentity } from '@/api/production/productionIdentity'

const props = defineProps<{ id?: string }>()
const auth = useAuth()
const allowed = computed(() => auth.hasPermission('business:mes:production:execution:query', 'factory'))
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
watch(() => [auth.factoryId, auth.revision, allowed.value], clear)
onBeforeUnmount(clear)
async function resolve() {
  if (!allowed.value || loading.value) return
  const ticket = ++sequence, revision = auth.revision, factoryId = auth.factoryId
  loading.value = true
  result.value = null
  error.value = ''
  try {
    const identity = await resolveProductionIdentity(code.value)
    if (ticket === sequence && revision === auth.revision && factoryId === auth.factoryId && allowed.value) result.value = identity
  } catch(failure) {
    if (ticket === sequence) error.value = failure instanceof Error ? failure.message : '身份查询失败'
  } finally {
    if (ticket === sequence) loading.value = false
  }
}
function open() {
  clear()
  visible.value = true
  if (props.id) {
    code.value = 'EXE:' + props.id
    void resolve()
  }
}
</script>

<template>
  <el-button v-if="allowed" :link="Boolean(id)" type="primary" @click="open">{{ id ? '身份码' : '扫码查询' }}</el-button>
  <el-dialog v-model="visible" title="生产执行身份查询" width="min(640px, 94vw)" append-to-body @closed="clear">
    <el-form @submit.prevent="resolve">
      <el-form-item label="执行身份码">
        <el-input v-model="code" placeholder="EXE:100001" maxlength="23" :disabled="loading" />
      </el-form-item>
      <el-button type="primary" :loading="loading" :disabled="!code || !allowed" @click="resolve">查询</el-button>
    </el-form>
    <p class="secondary">查询当前工厂的生产执行身份，不创建业务单据。</p>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-descriptions v-if="result" :column="1" border>
      <el-descriptions-item label="身份码">{{ result.qrCode }}</el-descriptions-item>
      <el-descriptions-item label="执行编号">{{ result.executionNo }}</el-descriptions-item>
      <el-descriptions-item label="工单">{{ result.workorderCode }}（{{ result.workorderId }}）</el-descriptions-item>
      <el-descriptions-item label="产出产品">{{ result.productCode }} · {{ result.productName }}</el-descriptions-item>
      <el-descriptions-item label="工艺版本">{{ result.routingCode }} / V{{ result.routingVersion }}（{{ result.routingId }}）</el-descriptions-item>
      <el-descriptions-item label="执行状态">{{ result.status }}</el-descriptions-item>
      <el-descriptions-item label="计划执行数量">{{ result.targetQty }}</el-descriptions-item>
    </el-descriptions>
    <OperatorConfiguration v-if="result" :execution-id="result.executionId" :context-label="result.executionNo" />
  </el-dialog>
</template>
