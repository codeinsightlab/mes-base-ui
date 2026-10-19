<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { capability, preview, sync, type SyncResult, type Capability, type Preview, type PreviewKind } from '@/api/production/e10Preview'
import { useAuth } from '@/stores/auth'

const props = defineProps<{ kind: PreviewKind; permission: string }>()
const emit = defineEmits<{ supported: [value: boolean]; completed: [] }>()
const auth = useAuth()
const allowed = computed(() => auth.runtimeMode === 'ERP' && auth.hasPermission(props.permission, 'factory'))
const support = ref<Capability | null>(null), result = ref<Preview | null>(null)
const analysis = ref<SyncResult | null>(null)
const visible = ref(false), busy = ref(false), error = ref('')
let sequence = 0
function clear() {
  sequence++; visible.value = false; busy.value = false; support.value = null; result.value = null; analysis.value = null; error.value = ''
  emit('supported', false)
}
watch(() => [auth.revision, auth.factoryId, allowed.value, props.kind, props.permission], async () => {
  clear()
  if (!allowed.value) return
  const attempt = sequence
  try {
    const response = await capability(props.kind)
    if (attempt !== sequence) return
    support.value = response; emit('supported', response.supported)
  } catch (failure) {
    if (attempt === sequence) error.value = failure instanceof Error ? failure.message : '同步准备检查失败'
  }
}, { immediate: true, flush: 'sync' })
watch(visible, value => {
  if (!value) { sequence++; busy.value = false; result.value = null; analysis.value = null; error.value = '' }
}, { flush: 'sync' })
onBeforeUnmount(clear)
async function read(pageNo = 1) {
  if (!allowed.value || !support.value?.supported || !visible.value || busy.value) return
  const attempt = ++sequence
  busy.value = true; error.value = ''; result.value = null; analysis.value = null
  try {
    const response = await preview(props.kind, pageNo)
    if (attempt === sequence && allowed.value && visible.value) result.value = response
  } catch (failure) {
    if (attempt === sequence) error.value = failure instanceof Error ? failure.message : 'ERP候选读取失败'
  } finally {
    if (attempt === sequence) busy.value = false
  }
}
async function run(commit = false) {
  if (!allowed.value || !support.value?.supported || !visible.value || busy.value || commit && !support.value.writeEnabled) return
  const attempt = ++sequence
  busy.value = true; error.value = ''; result.value = null; analysis.value = null
  try {
    const response = await sync(props.kind, commit)
    if (attempt !== sequence || !allowed.value || !visible.value) return
    analysis.value = response
    if (commit) emit('completed')
  } catch (failure) {
    if (attempt === sequence) {
      error.value = failure instanceof Error ? failure.message : '同步执行失败，请按运行标识核实结果'
      if (commit) emit('completed')
    }
  } finally { if (attempt === sequence) busy.value = false }
}
</script>

<template>
  <el-button v-if="allowed && support?.supported" @click="visible = true">ERP同步准备</el-button>
  <span v-if="allowed && !visible && error" role="alert">{{ error }}</span>
  <el-dialog v-model="visible" title="ERP同步准备" width="min(1100px, 94vw)" destroy-on-close>
    <el-alert title="同步按当前工厂的受管身份和映射契约执行；缺少证据的记录会被阻断。Dry Run 不写业务数据。" type="warning" :closable="false" />
    <ul><li v-for="reason in support?.blockers" :key="reason">{{ reason }}</li></ul>
    <div class="table-toolbar">
      <el-button :loading="busy" :disabled="busy" @click="read()">只读查询ERP候选</el-button>
      <el-button :loading="busy" :disabled="busy" @click="run()">Dry Run 校验</el-button>
      <el-button v-if="support?.writeEnabled" type="primary" :disabled="busy || analysis?.status !== 'DRY_RUN' || analysis.creatable + analysis.updatable + analysis.unchanged === 0" :loading="busy" @click="run(true)">正式同步（重新校验）</el-button>
      <span class="secondary">按当前工厂连接读取一页；显示编码相同的候选均保留，需核实身份。</span>
    </div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" role="alert" />
    <template v-if="result">
      <p role="status">第 {{ result.pageNo }} 页，读取 {{ result.fetched }} 条；新增 {{ result.created }}、更新 {{ result.updated }}。状态：仅预览。</p>
      <el-table :data="result.candidates" max-height="420" empty-text="本页无候选数据">
        <el-table-column prop="code" label="ERP编码" min-width="160" />
        <el-table-column prop="name" label="名称" min-width="160" />
        <el-table-column prop="site" label="据点" min-width="110" />
        <template v-if="kind === 'workorder'">
          <el-table-column prop="productCode" label="ERP品号" min-width="140" />
          <el-table-column prop="unitCode" label="ERP单位" min-width="100" />
          <el-table-column prop="plannedQty" label="计划数量" min-width="120" />
          <el-table-column prop="processCode" label="ERP工艺" min-width="120" />
        </template>
        <el-table-column prop="externalStatus" label="ERP原状态" min-width="110" />
      </el-table>
      <div class="table-toolbar">
        <el-button :disabled="busy || result.pageNo <= 1" @click="read(result.pageNo - 1)">上一页</el-button>
        <el-button :disabled="busy || !result.possiblyMore || result.pageNo >= 10000" @click="read(result.pageNo + 1)">下一页</el-button>
        <span class="secondary">分页排序尚未验收，翻页不能作为全量同步依据。</span>
      </div>
    </template>
    <template v-if="analysis">
      <el-alert v-if="analysis.failureReason" :title="analysis.failureReason" type="error" :closable="false" />
      <p role="status">状态：{{ analysis.status }}；工厂 {{ analysis.factoryId }} / {{ analysis.provider }} / {{ analysis.binding }} / 版本 {{ analysis.configurationVersion }}</p>
      <p>读取 {{ analysis.fetched }}，重复 {{ analysis.duplicates }}；可新增 {{ analysis.creatable }}，可更新 {{ analysis.updatable }}，无变化 {{ analysis.unchanged }}，冲突 {{ analysis.conflicts }}，阻断 {{ analysis.blocked }}。</p>
      <p>实际新增 {{ analysis.created }}、更新 {{ analysis.updated }}；运行标识 {{ analysis.runToken }}。逐条事务，部分成功不会回滚已提交项。</p>
      <el-table :data="analysis.items" max-height="420" empty-text="无候选数据">
        <el-table-column prop="code" label="ERP编码" min-width="140" />
        <el-table-column prop="externalId" label="外部身份" min-width="160" />
        <el-table-column prop="action" label="结果" min-width="150" />
        <el-table-column prop="productId" label="MES产品" min-width="100" />
        <el-table-column prop="routingId" label="MES路线版本ID" min-width="130" />
        <el-table-column prop="quantity" label="数量" min-width="100" />
        <el-table-column label="原因" min-width="320"><template #default="{row}">{{ row.reasons.join('；') || '校验通过' }}</template></el-table-column>
      </el-table>
    </template>
    <template #footer><el-button @click="visible = false">关闭</el-button></template>
  </el-dialog>
</template>
