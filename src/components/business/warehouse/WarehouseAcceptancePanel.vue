<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import { useAuth } from '@/stores/auth'
import { warehouseAcceptance as api,type AcceptanceState,type AcceptanceFact,type AcceptanceIntent } from '@/api/wm/warehouseAcceptance'
import { api as stockApi,type WmInventoryVo } from '@/api/wm/wmInventory'
import { useClosureCommand } from '@/composables/useClosureCommand'
const props=defineProps<{receiptId:string}>(),emit=defineEmits<{changed:[]}>(),auth=useAuth()
const visible=ref(false),state=ref<AcceptanceState|null>(null),rows=ref<AcceptanceFact[]>([]),stocks=ref<WmInventoryVo[]>([]),offset=ref(0),total=ref(0),loading=ref(false),loadError=ref(''),stockOffset=ref(0),stockTotal=ref(0)
const form=reactive({stockId:'',quantity:'',reason:'',referenceId:''}),action=ref<'accept'|'reverse'>('accept')
const can=(a:string)=>auth.hasPermission('business:wm:acceptance:'+a,'factory'),readable=computed(()=>can('read'))
const command=useClosureCommand<AcceptanceIntent>(()=>`mes-acceptance:${auth.username}:${auth.factoryId}:${props.receiptId}`),{pending,busy,error}=command
let generation=0,attempt=0,stockAttempt=0
function clear(){generation++;attempt++;stockAttempt++;visible.value=false;state.value=null;rows.value=[];stocks.value=[];total.value=offset.value=stockOffset.value=stockTotal.value=0;loading.value=false;loadError.value='';Object.assign(form,{stockId:'',quantity:'',reason:'',referenceId:''});command.clear()}
watch(()=>[props.receiptId,auth.factoryId,auth.revision,auth.factoryPermissions.join('|')],clear,{flush:'sync'});onBeforeUnmount(clear)
async function stockOptions(more=false){if(!state.value||!auth.hasPermission('business:wm:inventory:list','factory'))return;const g=generation,n=++stockAttempt;try{const p=await stockApi.list({materialId:state.value.productId,warehouseId:state.value.warehouseId,batchNo:state.value.productLotCode??'',status:'ENABLED',offset:more?stocks.value.length:0,limit:20});if(g!==generation||n!==stockAttempt)return;stocks.value=more?[...stocks.value,...p.items]:p.items;stockTotal.value=p.total}catch(e){if(g===generation)loadError.value=e instanceof Error?e.message:'库存来源读取失败'}}
async function load(){const g=generation,n=++attempt;loading.value=true;loadError.value='';try{const [s,p]=await Promise.all([api.state(props.receiptId),api.history(props.receiptId,offset.value)]);if(g!==generation||n!==attempt)return;state.value=s;rows.value=p.items;total.value=p.total;await stockOptions()}catch(e){if(g===generation&&n===attempt)loadError.value=e instanceof Error?e.message:'接收状态读取失败'}finally{if(g===generation&&n===attempt)loading.value=false}}
function open(){clear();visible.value=true;command.restore();if(pending.value){action.value=pending.value.action;Object.assign(form,{stockId:pending.value.body.stockId??'',quantity:pending.value.body.quantity,reason:pending.value.body.reason,referenceId:pending.value.referenceId??''})}void load()}
async function submit(){if(!state.value||!(pending.value?.action==='reverse'||!pending.value&&action.value==='reverse'?can('reverse'):can('create')))return
 if(!pending.value&&(!/^\d{1,14}(\.\d{1,6})?$/.test(form.quantity)||!/[1-9]/.test(form.quantity)||!form.reason.trim()||(action.value==='accept'?!form.stockId:!form.referenceId))){error.value='请选择库存来源或原接收事实，并填写正数量及依据';return}
 await command.run(()=>({action:action.value,referenceId:action.value==='reverse'?form.referenceId:null,body:{requestId:crypto.randomUUID(),stockId:action.value==='accept'?form.stockId:undefined,quantity:form.quantity,reason:form.reason}}),c=>api.execute(props.receiptId,c),async()=>{Object.assign(form,{quantity:'',reason:'',referenceId:''});emit('changed');await load()})
}
function reverse(row:AcceptanceFact){if(pending.value||!can('reverse'))return;action.value='reverse';form.referenceId=row.id;form.quantity='';form.reason=''}
async function close(done:()=>void){if(form.quantity||form.reason||pending.value){try{await ElMessageBox.confirm(pending.value?'原接收请求仍待核实，关闭后保留原UUID，确认关闭？':'放弃尚未保存的接收操作？','关闭操作',{type:'warning'})}catch{return}}clear();done()}
</script>
<template>
 <el-button v-if="readable" link type="primary" @click="open">仓储接收 / 待接收</el-button>
 <el-drawer v-model="visible" title="成品实际接收与逆向历史" size="min(1160px,96vw)" append-to-body destroy-on-close :before-close="close">
  <el-alert v-if="loadError||error" :title="loadError||error" type="error" :closable="false"/>
  <template v-if="state">
   <el-descriptions :column="3" border><el-descriptions-item label="生产净交接">{{state.netHandover}}</el-descriptions-item><el-descriptions-item label="仓库实际净接收">{{state.accepted}}</el-descriptions-item><el-descriptions-item label="尚待接收">{{state.pending}}</el-descriptions-item><el-descriptions-item label="产品 / 仓库">{{state.productId}} / {{state.warehouseId}}</el-descriptions-item><el-descriptions-item label="产品批次">{{state.productLotCode??'接收时由库存来源冻结'}}</el-descriptions-item><el-descriptions-item label="原交接UUID">{{state.receiptId}}</el-descriptions-item></el-descriptions>
   <el-alert title="交接不等于入库。先在库存管理建立该产品、目标仓库与批次的零余额来源，再选择实际接收；逆向需保留足够可用库存。" type="info" :closable="false"/>
   <div class="table-toolbar"><el-button :disabled="busy" @click="load">刷新待接收数量</el-button><router-link to="/stock/wmInventory">建立 / 核对成品库存来源</router-link></div>
   <el-alert v-if="pending" :title="'原请求已冻结：'+pending.body.requestId" type="warning" :closable="false"/>
   <el-form v-if="can('create')||can('reverse')" label-width="130px" :disabled="busy||!!pending">
    <el-form-item label="接收动作"><el-select v-model="action"><el-option v-if="can('create')" value="accept" label="实际接收入库"/><el-option v-if="can('reverse')" value="reverse" label="原接收逆向"/></el-select></el-form-item>
    <el-form-item v-if="action==='accept'" label="成品库存来源"><el-select v-model="form.stockId" placeholder="选择产品 / 仓库 / 批次匹配来源"><el-option v-for="s in stocks" :key="s.id" :value="s.id" :label="s.id+' · '+s.batchNo+' / '+(s.binCode??'无库位')+' · 可用 '+s.availableQuantity"/></el-select><el-button :disabled="stocks.length>=stockTotal" @click="stockOptions(true)">更多来源</el-button></el-form-item>
    <el-form-item v-else label="原接收UUID"><el-input v-model="form.referenceId" placeholder="从下方原接收事实选择逆向"/></el-form-item>
    <el-form-item label="实际数量"><el-input v-model="form.quantity" placeholder="基本单位正数量"/></el-form-item><el-form-item label="接收 / 差额依据"><el-input v-model="form.reason" type="textarea" maxlength="500"/></el-form-item>
   </el-form>
   <el-button v-if="can('create')||can('reverse')" type="primary" :loading="busy" @click="submit">{{pending?'核实原请求':'确认实际仓储动作'}}</el-button>
   <el-table :data="rows" v-loading="loading"><el-table-column prop="quantityDelta" label="实际数量增减" width="150"/><el-table-column prop="stockId" label="库存来源" width="100"/><el-table-column show-overflow-tooltip prop="id" label="接收 / 库存动作UUID" min-width="300"/><el-table-column show-overflow-tooltip prop="referenceId" label="原接收UUID" min-width="300"/><el-table-column prop="recordedAt" label="时间" min-width="210"/><el-table-column prop="operatorUserId" label="操作人" width="100"/><el-table-column show-overflow-tooltip prop="reason" label="依据" min-width="200"/><el-table-column v-if="can('reverse')" label="操作" width="90" fixed="right"><template #default="{row}"><el-button v-if="!row.quantityDelta.startsWith('-')" link :disabled="!!pending" @click="reverse(row)">逆向</el-button></template></el-table-column></el-table>
   <div class="table-toolbar"><el-button :disabled="offset===0||loading" @click="offset-=20;load()">上一页</el-button><span>{{total}} 条</span><el-button :disabled="offset+20>=total||loading" @click="offset+=20;load()">下一页</el-button></div>
  </template>
 </el-drawer>
</template>
