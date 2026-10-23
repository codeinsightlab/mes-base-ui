<script setup lang="ts">
import { executionStatusLabel } from '@/lib/production/executionState'
import { menuPathForComponent } from '@/lib/menuWorkspaces'
import QuantityText from '@/components/business/production/QuantityText.vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useAuth } from '@/stores/auth'
import { productionClosure as api,type ClosureSummary } from '@/api/production/productionClosure'
const props=defineProps<{id:string}>(),emit=defineEmits<{changed:[]}>(),auth=useAuth()
const inboundPath=computed(()=>menuPathForComponent(auth.factoryMenus,'wm/stockDocuments/index'))
const visible=ref(false),data=ref<ClosureSummary|null>(null),loading=ref(false),loadError=ref('')
const can=(p:string)=>auth.hasPermission(p,'factory'),readable=computed(()=>can('business:mes:production:execution:query'))
const receiptLabel=computed(()=>data.value?({PENDING:'待入库',PARTIAL:'部分入库',FULLY_RECEIVED:'完全入库'}[data.value.receiptState]??'入库状态待确认'):'')
const canRecheck=computed(()=>!!data.value&&(data.value.status==='RUNNING'||(data.value.status==='FULLY_RECEIVED'&&!!data.value.orderBlockedReason))&&can('business:production:execution:complete'))
const rechecking=ref(false),recheckMessage=ref('')
let generation=0,attempt=0
function clear(){generation++;attempt++;visible.value=false;data.value=null;loading.value=false;loadError.value='';rechecking.value=false;recheckMessage.value=''}
watch(()=>[props.id,auth.revision,auth.factoryId,auth.factoryPermissions.join('|')],clear,{flush:'sync'})
onBeforeUnmount(clear)
async function load(){if(!readable.value)return;const g=generation,n=++attempt;loading.value=true;loadError.value='';try{const summary=await api.summary(props.id);if(g!==generation||n!==attempt)return;data.value=summary}catch(e){if(g===generation&&n===attempt)loadError.value=e instanceof Error?e.message:'入库摘要读取失败'}finally{if(g===generation&&n===attempt)loading.value=false}}
function open(){if(!readable.value)return;clear();visible.value=true;void load()}
async function recheck(){
 if(!canRecheck.value||rechecking.value||loading.value)return
 const g=generation,n=++attempt,previous=data.value!.status
 rechecking.value=true;loadError.value='';recheckMessage.value=''
 try{
  const result=await api.recheckReceipt(props.id)
  if(g!==generation||n!==attempt)return
  data.value=result
  recheckMessage.value=result.receiptState==='FULLY_RECEIVED'?'执行已完全入库；工单是否完结以当前工单状态和阻断原因为准。':'复查后尚未满足完全入库条件，请查看执行及工单阻断原因。'
  if(result.status!==previous)emit('changed')
 }catch(e){if(g===generation&&n===attempt)loadError.value=e instanceof Error?e.message:'复查结果尚未确认，请刷新摘要核实'}
 finally{if(g===generation&&n===attempt)rechecking.value=false}
}
function close(done:()=>void){clear();done()}
</script>
<template>
 <el-button v-if="readable" link type="primary" @click="open">入库进度</el-button>
 <el-drawer v-model="visible" title="生产数量与入库收尾" size="min(1160px,96vw)" append-to-body destroy-on-close :before-close="close">
  <el-alert v-if="loadError" :title="loadError" type="error" :closable="false"/>
  <div v-if="!data" v-loading="loading"><el-button v-if="loadError" @click="load">重试读取</el-button></div>
  <section v-if="data" v-loading="loading">
   <el-alert title="报工只登记生产事实。正常品及不良品入库审核后，系统分别核对执行与工单收尾条件；一张单据审核成功不代表整张工单已完结。" type="info" :closable="false"/>
   <h3>{{data.executionId}} · {{executionStatusLabel(data.status)}} · {{receiptLabel}}</h3>
   <el-descriptions :column="3" border>
    <el-descriptions-item label="计划目标"><QuantityText :value="data.targetQty" /></el-descriptions-item><el-descriptions-item label="末道有效净产出 G"><QuantityText :value="data.effective" /></el-descriptions-item>
    <el-descriptions-item label="正常品已入库 R"><QuantityText :value="data.receivedQty" /></el-descriptions-item><el-descriptions-item label="有效不良损失 D"><QuantityText :value="data.defectQty" /></el-descriptions-item><el-descriptions-item label="执行入库状态">{{receiptLabel}}</el-descriptions-item>
   </el-descriptions>
   <el-alert v-if="data.orderBlockedReason" :title="'工单未完结：'+data.orderBlockedReason" type="warning" :closable="false"/>
   <el-alert v-if="data.blockedReason" :title="data.blockedReason" type="warning" :closable="false"/>
   <el-alert v-if="data.completion" :title="'入库收尾记录：'+data.completion.id+'；完工时有效产出 '+data.completion.effectiveQty+'，完工时已入库 '+data.completion.inboundQty" type="success" :closable="false"/>
   <div class="table-toolbar"><el-button :disabled="rechecking||loading" @click="load">刷新入库数量</el-button><el-button v-if="canRecheck" :loading="rechecking" :disabled="loading" @click="recheck">{{data.status==='FULLY_RECEIVED'?'复查工单收尾':'复查入库收尾'}}</el-button><router-link v-if="inboundPath&&data.status!=='FULLY_RECEIVED'" :to="{path:inboundPath,query:{executionId:id}}">办理入库单</router-link></div>
   <el-alert v-if="recheckMessage" :title="recheckMessage" type="info" :closable="false"/>
  </section>
 </el-drawer>
</template>
