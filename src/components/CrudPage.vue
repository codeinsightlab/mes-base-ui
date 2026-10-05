<script setup lang="ts">
import { computed, reactive, ref, watch, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuth } from '@/stores/auth'
import { commandFromDraft, formatValue } from '@/lib/crud'
import type { CrudApi, Field, Row } from '@/lib/crud'
import type { PermissionScope } from '@/lib/request'
const props=withDefaults(defineProps<{title:string;permission:string;permissionScope?:PermissionScope;api:CrudApi;fields:Field[];idKey?:string;readonly?:boolean;searchable?:boolean}>(),{idKey:'id',permissionScope:'factory',searchable:true})
const auth=useAuth();const rows=ref<Row[]>([]),total=ref(0),page=ref(1),limit=ref(20),loading=ref(false),saving=ref(false),error=ref(''),dialog=ref(false),editId=ref<string|null>(null)
const draft=reactive<Row>({}),search=reactive<Record<string,string>>({});let generation=0
const columns=computed(()=>props.fields.filter(f=>!f.hidden&&f.kind!=='password'&&f.key!=='factoryId'))
const searchFields=computed(()=>props.searchable?props.fields.filter(f=>['code','name'].includes(f.key)):[])
const editable=computed(()=>props.fields.filter(f=>!f.readonly&&(!f.showWhen||draft[f.showWhen.key]===f.showWhen.value)&&!(editId.value&&f.kind==='password')))
const can=(action:string)=>auth.hasPermission(props.permission+':'+action,props.permissionScope)
const writeAllowed=computed(()=>editId.value?can('update')||can('write'):can('create')||can('write'))
async function load(){const current=++generation;loading.value=true;error.value='';try{const q:Record<string,string|number>={offset:(page.value-1)*limit.value,limit:limit.value};for(const [k,v]of Object.entries(search))if(v.trim())q[k]=v.trim();const result=await props.api.list(q);if(current!==generation)return;rows.value=result.items;total.value=result.total}catch(e){if(current===generation){rows.value=[];total.value=0;error.value=e instanceof Error?e.message:'加载失败'}}finally{if(current===generation)loading.value=false}}
async function open(row?:Row){error.value='';editId.value=row?String(row[props.idKey]):null;Object.keys(draft).forEach(k=>delete draft[k]);if(row){try{Object.assign(draft,props.api.detail?await props.api.detail(editId.value!):row)}catch(e){error.value=e instanceof Error?e.message:'资源加载失败';return}}dialog.value=true}
async function save(){if(!writeAllowed.value||saving.value)return;for(const field of editable.value){if(field.required&&(draft[field.key]===null||draft[field.key]===undefined||String(draft[field.key]).trim()==='')){ElMessage.warning('请填写'+field.label);return}}
 saving.value=true;try{const body=commandFromDraft(props.fields,draft,!!editId.value,props.idKey);if(editId.value)await props.api.update(editId.value,body);else await props.api.create(body);dialog.value=false;ElMessage.success('已保存');await load()}catch(e){ElMessage.error(e instanceof Error?e.message:'保存失败')}finally{saving.value=false}}
async function remove(row:Row){if(!(can('delete')||can('write')))return;try{await ElMessageBox.confirm('删除后无法恢复，请确认当前记录。','删除确认',{confirmButtonText:'确认删除',cancelButtonText:'取消',type:'warning'});await props.api.remove(String(row[props.idKey]));if(rows.value.length===1&&page.value>1)page.value--;ElMessage.success('已删除');await load()}catch(e){if(e==='cancel'||e==='close')return;ElMessage.error(e instanceof Error?e.message:'删除失败')}}
function searchNow(){page.value=1;load()}function reset(){Object.keys(search).forEach(k=>delete search[k]);searchNow()}
watch(()=>[props.api,auth.revision],()=>{generation++;rows.value=[];total.value=0;dialog.value=false;page.value=1;load()});onMounted(load)
defineExpose({load})
</script>
<template>
 <section class="page">
  <header class="page-heading"><div><p class="eyebrow">MES BASE · 管理工作台</p><h1>{{title}}</h1><p class="muted">{{permissionScope==='factory'?'当前工厂内的数据与操作':'平台全局管理'}} · 共 {{total}} 条记录</p></div><el-button v-if="!readonly&&(can('create')||can('write'))" type="primary" @click="open()">新增记录</el-button></header>
  <div v-if="searchFields.length" class="panel search-bar"><label v-for="field in searchFields" :key="field.key">{{field.label}}<el-input v-model="search[field.key]" clearable :placeholder="'搜索'+field.label" @keyup.enter="searchNow" /></label><div><el-button type="primary" @click="searchNow">查询</el-button><el-button @click="reset">重置</el-button></div></div>
  <div class="panel table-panel"><div class="table-toolbar"><strong>记录列表</strong><el-button text :loading="loading" @click="load">刷新列表</el-button></div>
   <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="error" />
   <el-table v-loading="loading" :data="rows" :row-key="idKey" size="default" empty-text="暂无记录，可调整筛选条件或新增" style="width:100%">
    <el-table-column v-for="field in columns" :key="field.key" :label="field.label" :prop="field.key" :min-width="field.kind==='datetime'?180:field.key===idKey?180:120" show-overflow-tooltip>
     <template #default="{row}"><el-tag v-if="field.key==='status'" effect="light" :type="field.options?.find(o=>o.value===row[field.key])?.tone ?? (row.status==='ENABLED'?'success':'info')">{{field.options?.find(o=>o.value===row[field.key])?.label ?? formatValue(row[field.key],field.kind)}}</el-tag><span v-else :class="{'tabular':field.kind==='decimal'||field.kind==='number'}">{{formatValue(row[field.key],field.kind)}}</span></template>
    </el-table-column>
    <el-table-column v-if="!readonly" label="操作" fixed="right" min-width="180"><template #default="{row}"><el-button v-if="can('update')||can('write')" text type="primary" @click="open(row)">编辑</el-button><el-button v-if="can('delete')||can('write')" text type="danger" @click="remove(row)">删除</el-button><slot name="actions" :row="row" /></template></el-table-column>
   </el-table>
   <div class="pagination"><el-pagination v-model:current-page="page" v-model:page-size="limit" :page-sizes="[10,20,50,100]" :total="total" layout="total,sizes,prev,pager,next" @current-change="load" @size-change="searchNow" /></div>
  </div>
  <el-dialog v-model="dialog" :title="editId?'编辑记录':'新增记录'" width="min(640px,92vw)" :close-on-click-modal="!saving" :close-on-press-escape="!saving" :show-close="!saving">
   <p class="form-caption">基础信息 <span>{{permissionScope==='factory'?'带 * 的字段为必填；工厂身份由当前上下文确定。':'带 * 的字段为必填；平台对象的范围按字段配置。'}}</span></p>
   <el-form label-position="top" class="form-grid" @submit.prevent="save"><el-form-item v-for="field in editable" :key="field.key" :label="field.label" :required="field.required" :class="{'span-2':field.kind==='textarea'||field.key==='remark'}">
    <el-select v-if="field.options" v-model="draft[field.key] as any" placeholder="请选择" clearable><el-option v-for="option in field.options" :key="option.value" :label="option.label" :value="option.value"/></el-select>
    <el-switch v-else-if="field.kind==='boolean'" v-model="draft[field.key] as any" />
    <el-input v-else v-model="draft[field.key] as any" :type="field.kind==='password'?'password':field.kind==='textarea'||field.key==='remark'?'textarea':field.kind==='datetime'?'datetime-local':field.kind==='date'?'date':field.kind==='number'?'number':'text'" :inputmode="field.kind==='decimal'?'decimal':undefined" :show-password="field.kind==='password'" :maxlength="field.maxLength" :disabled="!!editId&&field.key===idKey" :placeholder="'请输入'+field.label" />
   </el-form-item></el-form>
   <template #footer><el-button :disabled="saving" @click="dialog=false">取消</el-button><el-button type="primary" :loading="saving" :disabled="!writeAllowed" @click="save">保存</el-button></template>
  </el-dialog>
 </section>
</template>
