<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import type { Row } from '@/lib/crud'
import { useAuth } from '@/stores/auth'
import { useClosureCommand } from '@/composables/useClosureCommand'
import { stockDocuments, stockDocumentPermission as p, type PostIntent, type CancellationBasis } from '@/api/wm/stockDocuments'
const props=defineProps<{row:Row;dirty:boolean;refresh:()=>Promise<void>}>()
const emit=defineEmits<{pending:[string|null]}>()
const auth=useAuth(),basis=ref<CancellationBasis|null>(null),error=ref(''),cancelBusy=ref(false)
const intent=useClosureCommand<PostIntent>(()=>`stock-document-post:${auth.username}:${auth.factoryId}:${props.row.id}`)
const canPost=computed(()=>!!props.row.id&&auth.hasPermission(p+':post','factory')&&(!!intent.pending.value||props.row.status==='DRAFT'&&auth.runtimeMode==='LOCAL'))
watch(()=>intent.pending.value, value=>emit('pending',value?String(props.row.id):null),{immediate:true})
let generation=0
function clear(){generation++;basis.value=null;error.value='';cancelBusy.value=false;intent.clear()}
async function loadBasis(){
 const g=++generation;basis.value=null;if(!props.row.sourceWorkorderId)return
 try{const r=await stockDocuments.basis(String(props.row.sourceWorkorderId));if(g===generation)basis.value=r}catch(e){if(g===generation)error.value=e instanceof Error?e.message:'补入库依据读取失败'}
}
watch(()=>[auth.factoryId,auth.revision,auth.factoryPermissions.join('|'),props.row.id],()=>{clear();intent.restore();void loadBasis()},{immediate:true})
watch(()=>props.row.sourceWorkorderId,()=>void loadBasis())
async function post(){
 if(!canPost.value||intent.busy.value)return
 if(props.dirty&&!intent.pending.value){error.value='请先保存主单，再核对并过账';return}
 const g=generation
 try{await ElMessageBox.confirm(`${props.row.documentType==='OTHER_RECEIPT'?'增加':'减少'}所选库存。全部明细在同一事务过账；成功后单据与库存事实不可编辑。`, '正式过账', {type:'warning',confirmButtonText:'确认过账',cancelButtonText:'取消'})}catch{return}
 if(g!==generation||!canPost.value)return
 await intent.run(()=>({requestId:crypto.randomUUID(),expectedRevision:String(props.row.revision)}),c=>stockDocuments.post(String(props.row.id),c),async()=>{await props.refresh();await loadBasis()})
}
async function cancel(){
 if(props.row.status!=='DRAFT'||props.dirty||cancelBusy.value||intent.pending.value||!auth.hasPermission(p+':cancel','factory'))return
 const g=generation
 try{await ElMessageBox.confirm('作废草稿不改变库存，确认作废？','作废草稿',{type:'warning'})}catch{return}
 if(g!==generation)return
 cancelBusy.value=true
 try{await stockDocuments.cancel(String(props.row.id),String(props.row.revision));if(g===generation)await props.refresh()}catch(e){if(g===generation)error.value=e instanceof Error?e.message:'作废失败'}finally{if(g===generation)cancelBusy.value=false}
}
onBeforeUnmount(clear)
</script>
<template>
 <div class="stock-document-actions">
  <el-tag v-if="row.status" :type="row.status==='POSTED'?'success':row.status==='CANCELLED'?'info':'warning'">{{row.status==='POSTED'?'已过账':row.status==='CANCELLED'?'已作废':'草稿'}}</el-tag>
  <span v-if="row.documentNo">{{row.documentNo}}</span>
  <el-button v-if="row.id" :disabled="intent.busy.value||cancelBusy" @click="refresh">刷新单据</el-button>
  <el-button v-if="row.status==='DRAFT'&&auth.hasPermission(p+':cancel','factory')" type="danger" plain :disabled="dirty||!!intent.pending.value" :loading="cancelBusy" @click="cancel">作废草稿</el-button>
  <el-button v-if="canPost" type="primary" :loading="intent.busy.value" @click="post">{{intent.pending.value?'核实原过账请求':'正式过账'}}</el-button>
  <router-link v-if="row.sourceWorkorderId" :to="{path:'/production/workorder',query:{workorderId:String(row.sourceWorkorderId)}}">查看关联工单 {{row.sourceWorkorderId}}</router-link>
  <p v-if="basis">已交接 {{basis.handedOver}}，已实际接收 {{basis.accepted}}，已人工补入 {{basis.manuallyReceived}}，本次可补上限 {{basis.remaining}}。仍须逐行填写实际清点依据。</p>
  <el-alert v-if="intent.pending.value" :title="'原过账UUID：'+intent.pending.value.requestId+'。结果未知时只核实此请求，不另建意图。'" type="warning" :closable="false" />
  <el-alert v-if="error||intent.error.value" :title="error||intent.error.value" type="error" :closable="false" />
 </div>
</template>
<style scoped>.stock-document-actions{flex:1;min-width:0;max-width:100%;display:flex;align-items:center;flex-wrap:wrap;gap:8px}.stock-document-actions p{flex-basis:100%;max-width:100%;white-space:normal;overflow-wrap:anywhere;margin:var(--ui-space-1) 0}</style>
