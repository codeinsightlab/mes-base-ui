<script setup lang="ts">
import { usePageMessageBox } from '@/lib/pageMessageBox'

import { computed, ref, watch, onBeforeUnmount } from 'vue'

import CodeScanner from '@/components/scanner/CodeScanner.vue'
import { scanExecution, type ScanInputMethod } from '@/api/production/productionScan'
import type { ProductionIdentity } from '@/api/production/productionIdentity'
import ExecutionSelect from '@/components/business/production/ExecutionSelect.vue'
import { useAuth } from '@/stores/auth'
import { ApiError } from '@/lib/request'
import { qualityV2 as api, wasteLabels, type Declaration, type DeclarationContext, type WasteCategory } from '@/api/quality/qualityV2'
import type { Node } from '@/api/quality/productionDefect'
const ElMessageBox = usePageMessageBox()

const props = defineProps<{ executionId?: string; nodeId?: string }>()
const emit = defineEmits<{ saved: []; pending: [value:boolean]; dirty: [value:boolean] }>()
const auth = useAuth(), allowed = computed(() => !!auth.factoryId && !auth.factorySwitching && auth.hasPermission('business:quality:defect:create', 'factory'))
const recoveryBlocked = ref(false)
const scanning=ref(false),scanIdentity=ref<ProductionIdentity|null>(null)
const execution = ref(''), node = ref(''), nodes = ref<Node[]>([]), context = ref<DeclarationContext | null>(null), type = ref(''), quantity = ref(''), category = ref<WasteCategory>('PROCESS'), remark = ref(''), error = ref(''), message = ref(''), busy = ref(false), pending = ref<Declaration | null>(null), typeOffset = ref(0)
let generation = 0, nodeAttempt = 0, contextAttempt = 0, scanAttempt=0, uncertain = false
const key = () => `mes-quality-v2-pending:${auth.username}:${auth.factoryId}`
watch(() => [type.value, quantity.value, remark.value], () => emit('dirty', !!(type.value || quantity.value || remark.value)), { flush: 'sync' })
const selected = computed(() => context.value?.types.find(t => t.id === type.value))
function clear() { recoveryBlocked.value = false;typeOffset.value = 0;generation++;nodeAttempt++;contextAttempt++;scanAttempt++;scanning.value=false;scanIdentity.value=null;execution.value = '';node.value = '';nodes.value = [];context.value = null;type.value = '';quantity.value = '';remark.value = '';error.value = '';message.value = '';pending.value = null;busy.value = false;uncertain = false;emit('pending', false) }
function restore() {
  try {
    const saved = sessionStorage.getItem(key())
    if (!saved) return
    const candidate = JSON.parse(saved) as Partial<Declaration>
    if (!candidate || typeof candidate.requestId !== 'string' || typeof candidate.executionId !== 'string'
      || typeof candidate.nodeId !== 'string' || typeof candidate.defectTypeId !== 'string'
      || typeof candidate.quantity !== 'string' || typeof candidate.occurredAt !== 'string'
      || typeof candidate.expectedTypeRevision !== 'number'
      || !['PROCESS', 'MATERIAL', 'BOTH'].includes(candidate.wasteCategory ?? '')) {
      throw new Error('原意图格式不完整')
    }
    pending.value = candidate as Declaration
    uncertain = true
    execution.value = pending.value.executionId
    node.value = pending.value.nodeId
    emit('pending', true)
  } catch {
    recoveryBlocked.value = true
    error.value = '原请求无法读取，请保留会话并联系管理员核对，勿重复申报'
  }
}
watch(() => [auth.factoryId, auth.revision, allowed.value, props.executionId, props.nodeId], () => { clear();if (!allowed.value) return;execution.value = props.executionId ?? '';node.value = props.nodeId ?? '';restore();void loadNodes();if (node.value) void loadContext() }, { immediate: true, flush: 'sync' })
onBeforeUnmount(clear)
async function loadNodes() { const scope = generation, ticket = ++nodeAttempt;nodes.value = [];if (!execution.value || !allowed.value) return;try { const data = await api.nodes(execution.value);if (scope === generation && ticket === nodeAttempt)nodes.value = data } catch(e) { if (scope === generation && ticket === nodeAttempt)error.value = e instanceof Error ? e.message : '读取实际工序失败' } }
function changeExecution() { scanAttempt++;scanning.value=false;scanIdentity.value=null;node.value = '';context.value = null;type.value = '';contextAttempt++;void loadNodes() }
async function locateExecution(code:string,inputMethod:ScanInputMethod='TEXT') {
 if(props.executionId||!allowed.value||busy.value||scanning.value||pending.value||recoveryBlocked.value)return
 const scope=generation,ticket=++scanAttempt
 scanning.value=true;error.value=''
 try{
  if(type.value||quantity.value||remark.value){try{await ElMessageBox.confirm('定位其他执行单元将放弃尚未提交的不良内容，确认继续？','更换执行单元',{type:'warning'})}catch{return}}
  if(scope!==generation||ticket!==scanAttempt||!allowed.value||pending.value)return
  const identity=await scanExecution('DEFECT_DECLARATION',code,inputMethod)
  if(scope!==generation||ticket!==scanAttempt||!allowed.value||pending.value)return
  execution.value=identity.executionId;scanIdentity.value=identity
  node.value='';nodes.value=[];context.value=null;type.value='';quantity.value='';remark.value='';category.value='PROCESS';typeOffset.value=0;contextAttempt++
  await loadNodes()
 }catch(e){if(scope===generation&&ticket===scanAttempt)error.value=e instanceof Error?e.message:'执行扫码定位失败'}
 finally{if(scope===generation&&ticket===scanAttempt)scanning.value=false}
}
async function loadContext() { const scope = generation, ticket = ++contextAttempt;context.value = null;type.value = '';if (!execution.value || !node.value || !allowed.value) return;try { const data = await api.context(execution.value, node.value, typeOffset.value);if (scope === generation && ticket === contextAttempt)context.value = data } catch(e) { if (scope === generation && ticket === contextAttempt)error.value = e instanceof Error ? e.message : '读取申报上下文失败' } }
function changeType() { if (selected.value)category.value = selected.value.defaultWasteCategory }
function localTime() { const d = new Date();return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19) }
async function submit() {
  if (!allowed.value || busy.value || scanning.value || recoveryBlocked.value) return;if (!pending.value) { if (!selected.value || !context.value || !/^\d{1,14}(?:\.\d{1,2})?$/.test(quantity.value) || !/[1-9]/.test(quantity.value)) { error.value = '请选择不良类型并填写正数数量（最多2位小数）';return }pending.value = { requestId: crypto.randomUUID(), executionId: execution.value, nodeId: node.value, defectTypeId: selected.value.id, expectedTypeRevision: selected.value.revision, quantity: quantity.value, wasteCategory: category.value, remark: remark.value.trim() || null, occurredAt: localTime() };emit('pending', true) }
  try { sessionStorage.setItem(key(), JSON.stringify(pending.value)) } catch { error.value = '无法保存原申报意图，尚未发送请求，请恢复会话存储后原样重试';return }
  const scope = generation, storageKey = key();busy.value = true;error.value = '';message.value = '';try { const r = await api.declare(pending.value);sessionStorage.removeItem(storageKey);if (scope !== generation) return;pending.value = null;uncertain = false;quantity.value = '';remark.value = '';emit('pending', false);message.value = `已保存申报 ${r.record.declarationId}，等待授权人员核实。`;emit('saved') } catch(e) { if (scope !== generation) return;error.value = e instanceof Error ? e.message : '结果待确认';if (e instanceof ApiError && e.status >= 400 && e.status < 500 && !uncertain) { sessionStorage.removeItem(storageKey);pending.value = null;emit('pending', false) } else { uncertain = true } } finally { if (scope === generation)busy.value = false }
}
async function recover() { if (!allowed.value || !pending.value || busy.value) return;const scope = generation, storageKey = key(), id = pending.value.requestId;busy.value = true;error.value = '';try { const r = await api.request(id);sessionStorage.removeItem(storageKey);if (scope !== generation) return;pending.value = null;uncertain = false;emit('pending', false);message.value = `原请求已成功：${r.declarationId}`;emit('saved') } catch(e) { if (scope === generation)error.value = e instanceof ApiError && e.status === 404 ? '尚未查询到已提交事实，请保留原请求并使用原请求重试。' : e instanceof Error ? e.message : '查询失败，原请求仍保留' } finally { if (scope === generation)busy.value = false } }
</script>
<template>
  <section aria-label="现场逐次不良申报">
    <el-alert v-if="error" :title="error" type="error" :closable="false" /><el-alert v-if="message" :title="message" type="success" :closable="false" />
    <CodeScanner v-if="!props.executionId" button-label="扫码定位执行单元" :disabled="!allowed||busy||scanning||!!pending||recoveryBlocked" :context-key="auth.factoryId+':'+auth.revision" @confirm="locateExecution" />
    <p v-if="scanIdentity" class="secondary">{{scanIdentity.workorderCode}} · {{scanIdentity.productCode}} · 批次 {{scanIdentity.batchNo || '未记录'}} · {{scanIdentity.executionId}}</p>
    <el-form label-width="100px" :disabled="busy||scanning||!!pending||recoveryBlocked" @submit.prevent="submit">
      <el-form-item v-if="!props.executionId" label="执行单元"><ExecutionSelect v-model="execution" @update:model-value="changeExecution" /></el-form-item>
      <el-form-item v-if="!props.nodeId" label="实际工序"><el-select v-model="node" @change="typeOffset=0;loadContext()"><el-option v-for="n in nodes" :key="n.id" :value="n.id" :label="`${n.sequenceNo}. ${n.name}`" /></el-select></el-form-item>
      <template v-if="context"><el-form-item label="当前产品"><span>{{ context.productCode }} · {{ context.productName }}</span></el-form-item><el-form-item label="当前工序"><span>{{ context.operationName||'历史名称未记录' }} · #{{ context.nodeId }}</span></el-form-item>
        <el-form-item label="不良类型" required><el-button link @click="loadContext()">刷新类型配置</el-button><el-select v-model="type" @change="changeType"><el-option v-for="t in context.types" :key="t.id" :value="t.id" :label="`${t.code} · ${t.name}`" /></el-select><el-button v-if="typeOffset>0" link @click="typeOffset=Math.max(0,typeOffset-100);loadContext()">上一页类型</el-button><el-button v-if="context.typeTotal>typeOffset+100" link @click="typeOffset+=100;loadContext()">下一页类型</el-button></el-form-item>
        <el-form-item label="不良数量" required><el-input v-model="quantity" inputmode="decimal" /></el-form-item><el-form-item label="工废/料废类别"><el-select v-model="category" :disabled="!selected||!context.canOverrideWasteCategory"><el-option v-for="v in ['PROCESS','MATERIAL','BOTH']" :key="v" :value="v" :label="wasteLabels[v]" /></el-select><span v-if="!context.canOverrideWasteCategory">采用所选类型的默认工废/料废类别</span></el-form-item><el-form-item label="备注"><el-input v-model="remark" type="textarea" maxlength="500" /></el-form-item></template>
    </el-form>
    <p v-if="pending" role="status">原申报请求 {{ pending.requestId }} 待确认，刷新后仍可恢复；请勿另建重复申报。</p>
    <el-button v-if="pending" :disabled="busy" @click="recover">查询原请求结果</el-button><el-button type="primary" :loading="busy" :disabled="!allowed||scanning||recoveryBlocked||(!pending&&!selected)" @click="submit">{{ pending?'使用原请求重试':'提交本次不良' }}</el-button>
  </section>
</template>
