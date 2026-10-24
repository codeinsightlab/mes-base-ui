<script setup lang="ts">
import QuantityText from '@/components/business/production/QuantityText.vue'
import { usePageMessageBox } from '@/lib/pageMessageBox'

import { computed, onBeforeUnmount, ref, watch } from 'vue'

import type { Row } from '@/lib/crud'
import { useAuth } from '@/stores/auth'
import { useClosureCommand } from '@/composables/useClosureCommand'
import { stockDocuments, stockDocumentPermission as p, stockDocumentPurpose, type MaterialIssueBasis, type ApprovalIntent, type CancellationBasis, type ProductionBasis } from '@/api/wm/stockDocuments'
const ElMessageBox = usePageMessageBox()

const props=defineProps<{row:Row;dirty:boolean;refresh:()=>Promise<void>}>()
const emit=defineEmits<{pending:[string|null]}>()
const auth=useAuth(),basis=ref<CancellationBasis|null>(null),production=ref<ProductionBasis|null>(null),error=ref(''),cancelBusy=ref(false)
const intent=useClosureCommand<ApprovalIntent>(()=>`stock-document-post:${auth.username}:${auth.factoryId}:${props.row.id}`)
const materialIssueBasis=computed(()=>props.row.materialIssueBasis as MaterialIssueBasis|null|undefined)
const canIssueApprove=computed(()=>props.row.documentType!=='MATERIAL_ISSUE'||!props.row.materialIssueBasisError&&auth.hasPermission('business:mes:material:issue:update','factory'))
const canApprove=computed(()=>canIssueApprove.value&&!!props.row.id&&auth.hasPermission(p+':post','factory')&&(!!intent.pending.value||props.row.status==='DRAFT'&&auth.runtimeMode==='LOCAL'))
watch(()=>intent.pending.value, value=>emit('pending',value?String(props.row.id):null),{immediate:true})
let generation=0
function clear(){generation++;basis.value=null;production.value=null;error.value='';cancelBusy.value=false;intent.clear()}
async function loadBasis(){
 const g=++generation;basis.value=null;production.value=null;
 if(props.row.documentType==='MATERIAL_ISSUE')return
 if(props.row.sourceExecutionId){try{const r=await stockDocuments.productionBasis(String(props.row.sourceExecutionId));if(g===generation)production.value=r}catch(e){if(g===generation)error.value=e instanceof Error?e.message:'生产入库依据读取失败'}return}
 if(!props.row.sourceWorkorderId)return
 try{const r=await stockDocuments.basis(String(props.row.sourceWorkorderId));if(g===generation)basis.value=r}catch(e){if(g===generation)error.value=e instanceof Error?e.message:'补入库依据读取失败'}
}
watch(()=>[auth.factoryId,auth.revision,auth.factoryPermissions.join('|'),props.row.id],()=>{clear();intent.restore();void loadBasis()},{immediate:true})
watch(()=>[props.row.sourceWorkorderId,props.row.sourceExecutionId],()=>void loadBasis())
async function approve(){
 if(!canApprove.value||intent.busy.value)return
 if(props.dirty&&!intent.pending.value){error.value='请先保存主单，再核对并审核';return}
 if(!stockDocumentPurpose(props.row.documentType)?.approvalAvailable){error.value='来源业务尚未接通，禁止审核；草稿可继续保存';return}
 const g=generation
 try{await ElMessageBox.confirm(`${!['OTHER_ISSUE','MATERIAL_ISSUE'].includes(String(props.row.documentType))?'增加':'减少'}所选库存。审核通过后在同一事务执行全部明细；成功后单据与库存事实不可编辑。`, '审核单据', {type:'warning',confirmButtonText:'确认审核',cancelButtonText:'取消'})}catch{return}
 if(g!==generation||!canApprove.value)return
 if(props.row.documentType==='MATERIAL_ISSUE'&&!props.row.postRequestId){error.value='正式领料原请求身份缺失，禁止审核';return}
 await intent.run(()=>({requestId:props.row.documentType==='MATERIAL_ISSUE'?String(props.row.postRequestId):crypto.randomUUID(),expectedRevision:String(props.row.revision)}),c=>stockDocuments.approve(String(props.row.id),c),async()=>{await props.refresh();await loadBasis()})
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
  <p v-if="stockDocumentPurpose(row.documentType)">业务来源：{{stockDocumentPurpose(row.documentType)?.origin}}；关联依据：{{stockDocumentPurpose(row.documentType)?.basis}}<span v-if="!stockDocumentPurpose(row.documentType)?.approvalAvailable">。来源业务尚未接通，禁止审核。</span></p>
 <router-link v-if="row.sourceMaterialIssueId" :to="{path:'/issue/mesMaterialIssue',query:{issueId:String(row.sourceMaterialIssueId)}}">查看正式领料事实 {{row.sourceMaterialIssueId}}</router-link>
 <el-alert v-if="row.materialIssueBasisError" :title="String(row.materialIssueBasisError)" type="error" :closable="false" />
 <details v-if="materialIssueBasis"><summary>冻结领料依据</summary><p>本次产出投入：<QuantityText :value="materialIssueBasis.outputQty" />（产出基本单位）；工单：{{materialIssueBasis.workorderId}}</p><p>扫码原文：{{materialIssueBasis.code}}</p><p>工艺版本ID：{{materialIssueBasis.routingId}}；实际路径节点：{{materialIssueBasis.routingNodeIds.join(' → ')}}</p><p>原请求UUID：{{materialIssueBasis.requestId}}</p></details>
 <details v-if="row.sourceDeclarationId"><summary>质量来源</summary><p>不良记录：{{row.sourceDeclarationId}}</p><p>处置流水：{{row.sourceTreatmentId}}</p></details>
 <el-tag v-if="row.status" :type="row.status==='POSTED'?'success':row.status==='CANCELLED'?'info':'warning'">{{row.status==='POSTED'?'已审核':row.status==='CANCELLED'?'已作废':'草稿'}}</el-tag>
  <span v-if="row.documentNo">{{row.documentNo}}</span>
  <el-button v-if="row.id" :disabled="intent.busy.value||cancelBusy" @click="refresh">刷新单据</el-button>
  <el-button v-if="row.status==='DRAFT'&&auth.hasPermission(p+':cancel','factory')" type="danger" plain :disabled="dirty||!!intent.pending.value" :loading="cancelBusy" @click="cancel">作废草稿</el-button>
  <el-button v-if="canApprove" :disabled="!stockDocumentPurpose(row.documentType)?.approvalAvailable" type="primary" :loading="intent.busy.value" @click="approve">{{intent.pending.value?'核对原审核请求':'审核单据'}}</el-button>
  <router-link v-if="row.sourceWorkorderId" :to="{path:'/production/workorder',query:{workorderId:String(row.sourceWorkorderId)}}">查看关联工单 {{row.sourceWorkorderId}}</router-link>
  <p v-if="production">生产有效产出 {{production.effective}}，累计已入库 {{production.received}}，当前可入库 {{production.remaining}}。{{production.blockedReason}}</p>
  <p v-if="basis">历史补录依据：已交接 {{basis.handedOver}}，已实际接收 {{basis.accepted}}，已人工补入 {{basis.manuallyReceived}}，本次可补上限 {{basis.remaining}}。仍须逐行填写实际清点依据。</p>
  <el-alert v-if="intent.pending.value" :title="'原审核UUID：'+intent.pending.value.requestId+'。结果未知时只核实此请求，不另建意图。'" type="warning" :closable="false" />
  <el-alert v-if="error||intent.error.value" :title="error||intent.error.value" type="error" :closable="false" />
 </div>
</template>
<style scoped>.stock-document-actions{flex:1;min-width:0;max-width:100%;display:flex;align-items:center;flex-wrap:wrap;gap:8px}.stock-document-actions p{flex-basis:100%;max-width:100%;white-space:normal;overflow-wrap:anywhere;margin:var(--ui-space-1) 0}</style>
