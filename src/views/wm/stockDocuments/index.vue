<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import MasterDetailDocument from '@/components/document/MasterDetailDocument.vue'
import MaterialSelect from '@/components/business/MaterialSelect.vue'
import WarehouseSelect from '@/components/business/WarehouseSelect.vue'
import WorkOrderSelect from '@/components/business/production/WorkOrderSelect.vue'
import StockSourceSelect from '@/components/business/warehouse/StockSourceSelect.vue'
import StockDocumentActions from '@/components/business/warehouse/StockDocumentActions.vue'
import { stockDocumentApis, stockDocumentPermission as p } from '@/api/wm/stockDocuments'
import { useAuth } from '@/stores/auth'
import { request } from '@/lib/request'
import type { StockAction } from '@/api/wm/localStock'
import type { Field, Row } from '@/lib/crud'
const pendingDocument=ref<string|null>(null)
const auth=useAuth(),document=ref<InstanceType<typeof MasterDetailDocument>|null>(null)
const {headerApi,itemApi,clear}=stockDocumentApis(async()=>{await document.value?.refresh()})
const action=ref<StockAction|null>(null),actionVisible=ref(false),actionError=ref('')
let generation=0
function reset(){pendingDocument.value=null;generation++;action.value=null;actionVisible.value=false;actionError.value='';clear()}
watch(()=>[auth.factoryId,auth.revision,auth.factoryPermissions.join('|')],reset)
onBeforeUnmount(reset)
async function showAction(id:unknown){
 if(!id||!auth.hasPermission('business:wm:stock:action:query','factory'))return
 const g=++generation;action.value=null;actionError.value='';actionVisible.value=true
 try{const result=await request<StockAction>('/api/wm/wm-stock-action/'+encodeURIComponent(String(id)),{scope:'factory'});if(g===generation)action.value=result}catch(e){if(g===generation)actionError.value=e instanceof Error?e.message:'动作读取失败'}
}
const headerFields:Field[]=[
 {key:'documentNo',label:'单号',kind:'text',readonly:true,searchable:true,columnMinWidth:240},
 {key:'documentType',label:'单据类型',kind:'select',required:true,defaultValue:'OTHER_RECEIPT',searchable:true,options:[{value:'OTHER_RECEIPT',label:'其他入库'},{value:'OTHER_ISSUE',label:'其他出库'}]},
 {key:'status',label:'状态',kind:'select',readonly:true,searchable:true,options:[{value:'DRAFT',label:'草稿',tone:'warning'},{value:'POSTED',label:'已过账',tone:'success'},{value:'CANCELLED',label:'已作废',tone:'info'}]},
 {key:'sourceWorkorderId',label:'关联已作废工单（可选）',kind:'text'},
 {key:'reason',label:'处理原因 / 实物依据',kind:'textarea',required:true,maxLength:500},
 {key:'remark',label:'备注',kind:'textarea',maxLength:500},
 {key:'postedAt',label:'过账时间',kind:'datetime',readonly:true,columnMinWidth:180},
]
const itemFields:Field[]=[
 {key:'lineNo',label:'行号',kind:'number',readonly:true},
 {key:'materialId',label:'物料 / 产品',kind:'text',required:true},
 {key:'warehouseId',label:'LOCAL仓库',kind:'text',required:true},
 {key:'stockId',label:'确切库存来源',kind:'text',required:true},
 {key:'batchNo',label:'批次',kind:'text'}, {key:'binCode',label:'库位',kind:'text'},
 {key:'unitId',label:'基本单位ID',kind:'text',required:true},
 {key:'quantity',label:'本次收发数量',kind:'decimal',required:true},
 {key:'remark',label:'明细 / 实物清点依据',kind:'textarea',maxLength:500},
 {key:'stockActionId',label:'库存动作',kind:'text',readonly:true,columnMinWidth:260},
]
function resetIdentity(draft:Row){draft.stockId=null;draft.batchNo=null;draft.binCode=null;draft.unitId=null}
</script>
<template>
 <div class="stock-documents">
 <MasterDetailDocument item-version-field="revision" items-readonly-when-dirty ref="document" title="其他出入库单" :header-api="headerApi" :item-api="itemApi" :header-fields="headerFields" :item-fields="itemFields" :header-permission="p" :item-permission="p" parent-key="documentId" :header-readonly="row=>row.status!=='DRAFT'||auth.runtimeMode!=='LOCAL'||pendingDocument===row.id" :item-permission-overrides="{list:p+':query',query:p+':query',create:p+':update',update:p+':update',delete:p+':update'}">
  <template #header-actions="{row,refresh,dirty}"><StockDocumentActions :row="row" :refresh="refresh" :dirty="dirty" @pending="id=>pendingDocument=id" /></template>
  <template #field-documentType="{draft,disabled}"><el-select v-model="draft.documentType as string" :disabled="disabled||!!draft.id"><el-option label="其他入库（增加库存）" value="OTHER_RECEIPT"/><el-option label="其他出库（减少库存）" value="OTHER_ISSUE"/></el-select></template>
  <template #field-sourceWorkorderId="{draft,disabled}"><WorkOrderSelect v-model="draft.sourceWorkorderId as string|null" source="LOCAL" status="CANCELLED" :disabled="disabled||!!draft.id||draft.documentType!=='OTHER_RECEIPT'" /></template>
  <template #field-materialId="{draft,disabled}"><MaterialSelect v-model="draft.materialId as string|null" :disabled="disabled" @update:model-value="resetIdentity(draft)"/></template>
  <template #field-warehouseId="{draft,disabled}"><WarehouseSelect v-model="draft.warehouseId as string|null" source="LOCAL" :disabled="disabled" @update:model-value="resetIdentity(draft)"/></template>
  <template #field-stockId="{draft,disabled}"><StockSourceSelect v-model="draft.stockId as string|null" :material-id="draft.materialId as string|null" :warehouse-id="draft.warehouseId as string|null" :disabled="disabled" receipt @selected="(s,unit)=>{draft.materialId=s.materialId;draft.warehouseId=s.warehouseId;draft.batchNo=s.batchNo;draft.binCode=s.binCode;draft.unitId=unit}"/></template>
  <template #field-batchNo="{draft}"><el-input :model-value="draft.batchNo" disabled placeholder="来自库存来源" /></template>
  <template #field-binCode="{draft}"><el-input :model-value="draft.binCode" disabled placeholder="来自库存来源" /></template>
  <template #field-unitId="{draft}"><el-input :model-value="draft.unitId" disabled placeholder="物料基本单位" /></template>
  <template #cell-stockActionId="{row}"><el-button v-if="row.stockActionId&&auth.hasPermission('business:wm:stock:action:query','factory')" link type="primary" @click="showAction(row.stockActionId)">{{row.stockActionId}}</el-button><span v-else>{{row.stockActionId||'未过账'}}</span></template>
 </MasterDetailDocument>
 <el-dialog v-model="actionVisible" title="不可变库存动作" width="720px" @closed="generation++;action=null;actionError=''">
  <el-alert v-if="actionError" :title="actionError" type="error" :closable="false" />
  <el-descriptions v-if="action" :column="2" border><el-descriptions-item label="动作UUID">{{action.id}}</el-descriptions-item><el-descriptions-item label="过账UUID">{{action.operationId||'—'}}</el-descriptions-item><el-descriptions-item label="单据明细ID">{{action.documentLineId||'—'}}</el-descriptions-item><el-descriptions-item label="业务来源">{{action.sourceType}} / {{action.sourceId}}</el-descriptions-item><el-descriptions-item label="库存来源">{{action.stockId}}</el-descriptions-item><el-descriptions-item label="批次 / 库位">{{action.batchNo}} / {{action.binCode}}</el-descriptions-item><el-descriptions-item label="变动量">{{action.quantityDelta}}</el-descriptions-item><el-descriptions-item label="前 / 后余额">{{action.quantityBefore}} / {{action.quantityAfter}}</el-descriptions-item><el-descriptions-item label="操作人">{{action.operatorUserId}}</el-descriptions-item><el-descriptions-item label="原因">{{action.reason}}</el-descriptions-item></el-descriptions>
 </el-dialog>
 </div>
</template>

<style scoped>
.stock-documents :deep(.page-header) { flex-wrap: wrap; }
.stock-documents :deep(.page-header h1) { white-space: nowrap; }
.stock-documents :deep(.page-header-actions) { flex: 1 1 100%; min-width: 0; max-width: 100%; justify-content: flex-start; }
</style>
