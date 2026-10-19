<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import { useAuth } from '@/stores/auth'
import { productionClosure as api,type ClosureSummary,type ReleaseState,type ReleaseFact,type ClosureAction,type ClosureIntent } from '@/api/production/productionClosure'
import { useClosureCommand } from '@/composables/useClosureCommand'
const props=defineProps<{id:string}>(),emit=defineEmits<{changed:[]}>(),auth=useAuth()
const visible=ref(false),data=ref<ClosureSummary|null>(null),release=ref<ReleaseState|null>(null),history=ref<ReleaseFact[]>([]),offset=ref(0),total=ref(0),loading=ref(false),loadError=ref('')
const action=ref<ClosureAction>('release'),form=reactive({quantity:'',reason:''})
const can=(p:string)=>auth.hasPermission(p,'factory'),readable=computed(()=>can('business:mes:production:execution:query')),releaseRead=computed(()=>can('business:quality:release:read'))
const options=computed(()=>[{value:'release' as const,label:'累计数量放行',permission:'business:quality:release:create'},{value:'revoke' as const,label:'撤回当前放行',permission:'business:quality:release:revoke'},{value:'complete' as const,label:'严格正式完工',permission:'business:production:execution:complete'}].filter(o=>data.value?.status==='RUNNING'&&can(o.permission)&&(o.value==='complete'||releaseRead.value)))
const command=useClosureCommand<ClosureIntent>(()=>`mes-closure:${auth.username}:${auth.factoryId}:${props.id}`),{pending,busy,error}=command
let generation=0,attempt=0
function clear(){generation++;attempt++;visible.value=false;data.value=null;release.value=null;history.value=[];total.value=offset.value=0;loading.value=false;loadError.value='';Object.assign(form,{quantity:'',reason:''});command.clear()}
watch(()=>[props.id,auth.revision,auth.factoryId,auth.factoryPermissions.join('|')],clear,{flush:'sync'})
onBeforeUnmount(clear)
async function load(){const g=generation,n=++attempt;loading.value=true;loadError.value='';try{const [s,r,h]=await Promise.all([api.summary(props.id),releaseRead.value?api.release(props.id):null,releaseRead.value?api.history(props.id,offset.value):null]);if(g!==generation||n!==attempt)return;data.value=s;release.value=r;history.value=h?.items??[];total.value=h?.total??0}catch(e){if(g===generation&&n===attempt)loadError.value=e instanceof Error?e.message:'闭环摘要读取失败'}finally{if(g===generation&&n===attempt)loading.value=false}}
function open(){clear();visible.value=true;command.restore();action.value=pending.value?.action??options.value[0]?.value??'release';if(pending.value)Object.assign(form,{quantity:pending.value.body.quantity??'',reason:pending.value.body.reason});void load()}
async function submit(){if(!data.value||!options.value.some(o=>o.value===(pending.value?.action??action.value)))return
 if(!pending.value&&(!form.reason.trim()||(action.value==='release'&&!/^\d{1,14}(\.\d{1,6})?$/.test(form.quantity)))){error.value='请填写合法数量及确认依据';return}
 await command.run(()=>({action:action.value,body:{requestId:crypto.randomUUID(),reason:form.reason,...(action.value==='complete'?{expectedBasisHash:data.value!.basisHash}:{quantity:action.value==='revoke'?'0':form.quantity,expectedReleaseId:release.value?.currentReleaseId??null})}}),c=>api.execute(props.id,c),async()=>{Object.assign(form,{quantity:'',reason:''});emit('changed');await load()})
}
async function close(done:()=>void){if(form.reason||form.quantity||pending.value){try{await ElMessageBox.confirm(pending.value?'原请求待核实，关闭后仍保留原UUID，确认关闭？':'放弃未保存的闭环操作？','关闭操作',{type:'warning'})}catch{return}}clear();done()}
</script>
<template>
 <el-button v-if="readable" link type="primary" @click="open">放行、交接与完工</el-button>
 <el-drawer v-model="visible" title="生产闭环与严格完工" size="min(1160px,96vw)" append-to-body destroy-on-close :before-close="close">
  <el-alert v-if="loadError||error" :title="loadError||error" type="error" :closable="false"/>
  <section v-if="data" v-loading="loading">
   <h3>{{data.executionNo}} · {{data.status}}</h3>
   <el-descriptions :column="3" border>
    <el-descriptions-item label="计划目标">{{data.targetQty}}</el-descriptions-item><el-descriptions-item label="末道有效产出 E">{{data.effective}}</el-descriptions-item><el-descriptions-item label="当前可信放行 Q">{{data.released}}</el-descriptions-item>
    <el-descriptions-item label="生产净交接 R">{{data.received}}</el-descriptions-item><el-descriptions-item label="仓储净接收">{{data.accepted}}</el-descriptions-item><el-descriptions-item label="未交接有效产出">{{data.remainingHandover}}</el-descriptions-item>
    <el-descriptions-item label="待仓库实际接收">{{data.pendingAcceptance}}</el-descriptions-item><el-descriptions-item label="历史超产出差额">{{data.outputExcess}}</el-descriptions-item><el-descriptions-item label="历史超放行差额">{{data.releaseExcess}}</el-descriptions-item>
   </el-descriptions>
   <el-alert v-if="data.blockedReason&&!data.completion" :title="data.blockedReason" type="warning" :closable="false"/>
   <el-alert v-if="release&&!release.basisValid&&release.currentReleaseId" title="原放行依据已变化或已撤回。历史事实保留，返工成功不会自动重新放行。" type="warning" :closable="false"/>
   <el-alert v-if="data.completion" :title="'正式完工事实：'+data.completion.id+'；完工时有效产出 '+data.completion.effectiveQty+'，实际接收 '+data.completion.acceptedQty" type="success" :closable="false"/>
   <div class="table-toolbar"><el-button :disabled="busy" @click="load">刷新闭环数量</el-button><router-link :to="{path:'/production/productionReceipt',query:{executionId:id}}">生产交接与仓库接收</router-link></div>
   <el-alert v-if="pending" :title="'保留原请求 '+pending.body.requestId+'，请核实原请求结果'" type="warning" :closable="false"/>
   <el-form v-if="options.length" label-width="130px" :disabled="busy||!!pending">
    <el-form-item label="正式命令"><el-select v-model="action"><el-option v-for="o in options" :key="o.value" :value="o.value" :label="o.label"/></el-select></el-form-item>
    <el-form-item v-if="action==='release'" label="累计授权总数量"><el-input v-model="form.quantity" placeholder="覆盖当前授权总量，不是追加增量"/></el-form-item>
    <el-form-item label="确认依据"><el-input v-model="form.reason" type="textarea" maxlength="500"/></el-form-item>
   </el-form>
   <el-button v-if="options.length" type="primary" :loading="busy" @click="submit">{{pending?'核实原请求':'确认正式命令'}}</el-button>
   <h3 v-if="releaseRead">不可变放行历史</h3>
   <el-table v-if="releaseRead" :data="history"><el-table-column prop="sequenceNo" label="序号" width="70"/><el-table-column prop="actionType" label="动作" width="110"/><el-table-column prop="quantity" label="累计授权数量" width="150"/><el-table-column show-overflow-tooltip prop="id" label="请求UUID" min-width="280"/><el-table-column prop="operatorUserId" label="操作人" width="100"/><el-table-column prop="recordedAt" label="记录时间" min-width="210"/><el-table-column show-overflow-tooltip prop="reason" label="依据" min-width="200"/></el-table>
   <div v-if="releaseRead" class="table-toolbar"><el-button :disabled="offset===0||loading" @click="offset-=20;load()">上一页</el-button><span>{{total}} 条</span><el-button :disabled="offset+20>=total||loading" @click="offset+=20;load()">下一页</el-button></div>
  </section>
 </el-drawer>
</template>
