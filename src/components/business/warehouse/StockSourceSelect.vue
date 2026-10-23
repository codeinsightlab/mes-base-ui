<script setup lang="ts">
import { usePageMessageBox } from '@/lib/pageMessageBox'

import PageDialog from '@/components/page/PageDialog.vue'

import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { api, type WmInventoryVo } from '@/api/wm/wmInventory'
import { api as materials } from '@/api/basic/material'
import { useAuth } from '@/stores/auth'
const ElMessageBox = usePageMessageBox()

const props=defineProps<{modelValue?:string|null;materialId?:string|null;warehouseId?:string|null;disabled?:boolean;receipt?:boolean}>()
const emit=defineEmits<{'update:modelValue':[string|null];selected:[WmInventoryVo,string]}>()
const auth=useAuth(),rows=ref<WmInventoryVo[]>([]),loading=ref(false),error=ref(''),offset=ref(0),total=ref(0)
const creating=ref(false),batch=ref(''),bin=ref('')
let generation=0
const allowed=computed(()=>auth.runtimeMode==='LOCAL'&&!!props.materialId&&!!props.warehouseId&&auth.hasPermission('business:wm:inventory:list','factory'))
function clear(){generation++;rows.value=[];error.value='';loading.value=false;creating.value=false;batch.value='';bin.value='';offset.value=total.value=0}
async function load(more=false){
 if(!allowed.value)return
 const g=++generation;loading.value=true;error.value=''
 try{const r=await api.list({materialId:props.materialId!,warehouseId:props.warehouseId!,status:'ENABLED',offset:more?offset.value+20:0,limit:20});if(g!==generation)return;offset.value=more?offset.value+20:0;rows.value=more?[...rows.value,...r.items]:r.items;total.value=r.total}
 catch(e){if(g===generation)error.value=e instanceof Error?e.message:'来源读取失败'}finally{if(g===generation)loading.value=false}
}
async function selected(id:string|null){
 emit('update:modelValue',id);if(!id)return
 const g=++generation;loading.value=true
 try{const [s,m]=await Promise.all([api.detail(id),materials.detail(props.materialId!)]);if(g===generation)emit('selected',s,m.unitId)}catch(e){if(g===generation)error.value=e instanceof Error?e.message:'来源校验失败'}finally{if(g===generation)loading.value=false}
}
async function create(){
 if(!allowed.value||loading.value||!auth.hasPermission('business:wm:inventory:create','factory'))return
 const g=++generation;loading.value=true
 try{const s=await api.create({materialId:props.materialId,warehouseId:props.warehouseId,batchNo:batch.value||null,binCode:bin.value||null,status:'ENABLED',remark:'入库单受控零余额来源'});if(g!==generation)return;rows.value=[s,...rows.value];await selected(s.id);batch.value='';bin.value='';creating.value=false}catch(e){if(g===generation)error.value=e instanceof Error?e.message:'零余额来源创建失败'}finally{if(g===generation)loading.value=false}
}
async function close(done?:()=>void){
 const g=generation
 if(batch.value||bin.value){try{await ElMessageBox.confirm('放弃未保存的库存来源信息？','未保存的修改',{type:'warning'})}catch{return}}
 if(g!==generation)return
 generation++;loading.value=false;creating.value=false;batch.value='';bin.value='';if(done)done()
}
watch(()=>[auth.revision,auth.factoryId,auth.factoryPermissions.join('|'),props.materialId,props.warehouseId],clear)
onBeforeUnmount(clear)
</script>
<template>
 <div><el-select :model-value="modelValue" :disabled="disabled||!allowed" :loading="loading" placeholder="选择确切库存来源" clearable @visible-change="(v:boolean)=>v&&load()" @update:model-value="selected">
 <el-option v-if="modelValue&&!rows.some(r=>r.id===modelValue)" :value="modelValue" :label="'库存 '+modelValue" />
 <el-option v-for="r in rows" :key="r.id" :value="r.id" :label="`${r.id} · ${r.batchNo||'无批次'} / ${r.binCode||'无库位'} · 可用 ${r.availableQuantity??r.quantity}`" />
 </el-select>
 <el-button v-if="rows.length<total" link :disabled="loading" @click="load(true)">加载更多</el-button>
 <el-button v-if="receipt&&allowed&&auth.hasPermission('business:wm:inventory:create','factory')" link :disabled="disabled" @click="creating=true">建立零余额来源</el-button>
 <el-text v-if="error" type="danger">{{error}}</el-text>
 <PageDialog v-model="creating" title="建立零余额库存来源" width="480px" append-to-body :before-close="close" @closed="batch='';bin=''">
  <el-alert title="这里只建立库存身份，余额为0；正式过账成功后才增加库存。" :closable="false" type="info" />
  <el-form label-position="top"><el-form-item label="实际批次"><el-input v-model="batch" maxlength="128" /></el-form-item><el-form-item label="实际库位"><el-input v-model="bin" maxlength="64" /></el-form-item></el-form>
  <template #footer><el-button @click="close()">取消</el-button><el-button type="primary" :loading="loading" @click="create">建立来源</el-button></template>
 </PageDialog></div>
</template>
