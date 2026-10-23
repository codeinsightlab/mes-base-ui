<script setup lang="ts">
import { usePageMessageBox } from '@/lib/pageMessageBox'

import PageDialog from '@/components/page/PageDialog.vue'

import { computed, ref, watch } from 'vue'

import { useAuth } from '@/stores/auth'
import { useClosureCommand } from '@/composables/useClosureCommand'
import { api, type Order, type Cancellation, type CancelCommand } from '@/api/production/workorder'
const ElMessageBox = usePageMessageBox()

const props=defineProps<{order:Order;history?:boolean}>(), emit=defineEmits<{changed:[]}>()
const auth=useAuth(), visible=ref(false), reason=ref(''), fact=ref<Cancellation|null>(null), historyError=ref('')
const allowed=computed(()=>auth.hasPermission('production:workorder:cancel','factory'))
const command=useClosureCommand<CancelCommand>(()=>`workorder-cancel:${auth.username}:${auth.factoryId}:${props.order.id}`)
const canCancel=computed(()=>allowed.value && (!!command.pending.value || (props.order.source!=='EXTERNAL' && auth.runtimeMode==='LOCAL' && ['DRAFT','RELEASED'].includes(props.order.status))))
let generation=0
watch(()=>[auth.factoryId,auth.revision,auth.username,allowed.value,props.order.id],()=>{
 generation++;visible.value=false;fact.value=null;historyError.value='';reason.value='';command.clear()
 if(allowed.value)command.restore()
},{immediate:true,flush:'sync'})
watch(()=>[props.order.status,props.order.id,auth.factoryId,auth.revision],async()=>{
 const g=++generation;fact.value=null
 if(!props.history||props.order.status!=='CANCELLED'||!auth.hasPermission('workorder:query','factory'))return
 try{const result=await api.cancellation(props.order.id);if(g===generation)fact.value=result}catch(e){if(g===generation)historyError.value=e instanceof Error?e.message:'作废事实读取失败'}
},{immediate:true})
async function execute(){
 if(!canCancel.value||command.busy.value)return
 if(!command.pending.value){
  if(!reason.value.trim()||reason.value.length>500){command.error.value='请填写作废原因（最多500字）';return}
  const g=generation
  try{await ElMessageBox.confirm('作废将终止后续生产，不退料、不冲销报工、不返还库存；历史事实及Execution原状态保留。确认作废？','正式作废工单',{type:'warning'})}catch{return}
  if(g!==generation||!canCancel.value)return
 }
 await command.run(()=>({requestId:crypto.randomUUID(),reason:reason.value,expectedRevision:props.order.revision}),c=>api.cancel(props.order.id,c),async()=>{visible.value=false;emit('changed')})
}
</script>
<template>
 <el-button v-if="canCancel" link type="danger" @click="visible=true">{{command.pending.value?'核实原作废请求':'作废工单'}}</el-button>
 <el-alert v-if="historyError" :title="historyError" type="error" :closable="false" />
 <div v-if="history && order.status==='CANCELLED'" class="secondary">所属工单已作废；Execution原状态及历史保留，禁止新增正向生产。<span v-if="fact">作废人 {{fact.cancelledBy}} · {{fact.cancelledAt}} · 原状态 {{fact.previousStatus}} · 原因：{{fact.reason}}</span></div>
 <PageDialog v-model="visible" title="正式作废工单" width="min(600px,94vw)" :close-on-click-modal="false">
  <el-alert title="只终止未来活动，不自动逆向库存、报工、质量或仓储事实。请通过正式单据处理实际差额和未决事项。" type="warning" :closable="false" />
  <el-form label-width="90px"><el-form-item label="作废原因" required><el-input v-model="reason" type="textarea" maxlength="500" :disabled="!!command.pending.value" /></el-form-item></el-form>
  <p v-if="command.pending.value">原请求：{{command.pending.value.requestId}}；原因：{{command.pending.value.reason}}。结果未知时仅核实原UUID。</p>
  <el-alert v-if="command.error.value" :title="command.error.value" type="error" :closable="false" />
  <template #footer><el-button @click="visible=false">关闭</el-button><el-button type="danger" :loading="command.busy.value" @click="execute">{{command.pending.value?'核实原请求':'确认作废'}}</el-button></template>
 </PageDialog>
</template>
