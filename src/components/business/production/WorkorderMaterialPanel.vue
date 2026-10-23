<script setup lang="ts">
import QuantityText from '@/components/business/production/QuantityText.vue'
import { onBeforeUnmount, reactive, ref, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import { useAuth } from '@/stores/auth'
import MaterialSelect from '@/components/business/MaterialSelect.vue'
import WarehouseSelect from '@/components/business/WarehouseSelect.vue'
import { workorderMaterial, type WorkorderMaterial } from '@/api/production/workorderMaterial'
const props=defineProps<{workorderId:string;readonly?:boolean}>(), auth=useAuth()
const data=ref<WorkorderMaterial|null>(null), error=ref(''), busy=ref(false), editing=ref(false)
const form=reactive({materialId:'',totalRequiredQty:'',warehouseIds:[] as string[],workCenter:'',enabled:true})
const canWrite=()=>!props.readonly&&auth.hasPermission('workorder:material:update','factory')
let generation=0
function clear(){generation++;data.value=null;error.value='';busy.value=false;editing.value=false;Object.assign(form,{materialId:'',totalRequiredQty:'',warehouseIds:[],workCenter:'',enabled:true})}
async function load(){const g=++generation;busy.value=true;error.value='';try{const result=await workorderMaterial.get(props.workorderId);if(g!==generation)return;data.value=result;if(result)Object.assign(form,{materialId:result.materialId,totalRequiredQty:result.totalRequiredQty,warehouseIds:JSON.parse(result.warehouseIds),workCenter:result.workCenter,enabled:result.status==='ENABLED'})}catch(e){if(g===generation)error.value=e instanceof Error?e.message:'读取用料失败'}finally{if(g===generation)busy.value=false}}
async function closeEditor(done:()=>void){try{await ElMessageBox.confirm('关闭并放弃未保存的用料编辑？','关闭用料维护',{type:'warning'});generation++;editing.value=false;done()}catch{return}}
async function save(){if(!canWrite()||busy.value)return;if(!/^\d{1,14}(\.\d{1,2})?$/.test(form.totalRequiredQty)&&form.totalRequiredQty!==data.value?.totalRequiredQty){error.value='材料数量最多两位小数';return}const g=generation;busy.value=true;error.value='';try{const result=await workorderMaterial.save(props.workorderId,{...form,warehouseIds:[...form.warehouseIds],expectedRevision:data.value?.revision??'0'});if(g!==generation)return;data.value=result;editing.value=false}catch(e){if(g===generation)error.value=(e instanceof Error?e.message:'保存结果未知')+'；请刷新核对当前版本后继续维护'}finally{if(g===generation)busy.value=false}}
watch(()=>[props.workorderId,auth.factoryId,auth.revision,canWrite()],()=>{clear();void load()},{immediate:true,flush:'sync'})
onBeforeUnmount(clear)
</script>
<template>
 <section class="panel" aria-label="本地单材料用料需求">
  <div class="table-toolbar"><strong>本地单材料用料需求</strong><el-button :disabled="busy" @click="load">刷新用料</el-button><el-button v-if="canWrite()" :disabled="busy" @click="editing=true">维护用料</el-button></div>
  <el-alert v-if="error" :title="error" type="error" :closable="false"/>
  <p v-if="!data" class="secondary">尚未维护MES用料；只有旧工单可继续使用原配置兼容来源。本页面保存后该工单仅使用MES需求，停用也不会回退旧配置。</p>
  <el-descriptions v-else :column="3" border><el-descriptions-item label="材料 / 单位">{{data.materialId}} / {{data.unitId}}</el-descriptions-item><el-descriptions-item label="需求 / 计划依据"><QuantityText :value="data.totalRequiredQty" /> / <QuantityText :value="data.plannedQty" /></el-descriptions-item><el-descriptions-item label="版本 / 状态">{{data.revision}} / {{data.status}}</el-descriptions-item></el-descriptions>
  <el-dialog v-model="editing" title="维护工单单材料需求" width="min(720px,94vw)" append-to-body :before-close="closeEditor"><el-form v-if="canWrite()" label-width="120px" :disabled="busy">
   <el-form-item label="单材料"><MaterialSelect v-model="form.materialId"/></el-form-item>
   <el-form-item label="材料总需求"><el-input v-model="form.totalRequiredQty" placeholder="基本单位数量，最多2位小数"/></el-form-item>
   <el-form-item label="允许领料仓库"><WarehouseSelect source="LOCAL" v-for="(_,index) in form.warehouseIds" :key="index" v-model="form.warehouseIds[index]"/><el-button @click="form.warehouseIds.push('')">添加仓库</el-button><el-button :disabled="!form.warehouseIds.length" @click="form.warehouseIds.pop()">移除末项</el-button></el-form-item>
   <el-form-item label="工作中心"><el-input v-model="form.workCenter" maxlength="100"/></el-form-item><el-form-item label="需求启用"><el-switch v-model="form.enabled"/></el-form-item>
   <el-alert title="材料基本单位与工单计划依据由服务端固定。已有领料意图或投产事实后，禁止更改用料。" type="info" :closable="false"/>
   <el-button type="primary" :loading="busy" @click="save">保存工单用料</el-button>
  </el-form></el-dialog>
 </section>
</template>
