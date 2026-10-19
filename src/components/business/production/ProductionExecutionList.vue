<script setup lang="ts">
import ExecutionRoutePreview from './ExecutionRoutePreview.vue'
import BusinessDirectorySelect from '@/components/business/directory/BusinessDirectorySelect.vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/stores/auth'
import OperatorConfiguration from './OperatorConfiguration.vue'
import ProductionClosurePanel from './ProductionClosurePanel.vue'
import ExecutionActions from './ExecutionActions.vue'
import ExecutionRoutingSelect from './ExecutionRoutingSelect.vue'
import { ref, watch, onBeforeUnmount } from 'vue'
import { api as workorders } from '@/api/production/workorder'
import CrudPage from '@/components/CrudPage.vue'
import { api } from '@/api/production/mesProductionExecution'
import { fields } from '@/views/production/mesProductionExecution/fields'
import ExecutionIdentityLookup from './ExecutionIdentityLookup.vue'
import WorkOrderSelect from './WorkOrderSelect.vue'
import { computed } from 'vue'
const props = defineProps<{ workorderId?: string; embedded?: boolean }>()
const emit = defineEmits<{ changed: [] }>()
const router = useRouter(), auth = useAuth()
const refresh = ref(0), cancelled=ref(false)
let ticket=0
watch(()=>[props.workorderId,auth.factoryId,auth.revision],async()=>{
 const t=++ticket;cancelled.value=!!props.workorderId
 if(!props.workorderId||!auth.hasPermission('workorder:query','factory'))return
 try{const d=await workorders.detail(props.workorderId);if(t===ticket)cancelled.value=d.workorder.status==='CANCELLED'}catch{if(t===ticket)cancelled.value=true}
},{immediate:true})
onBeforeUnmount(()=>ticket++)
function changed() { refresh.value++; emit('changed') }
const fixed = computed(() => props.workorderId ? { workorderId: props.workorderId } : undefined)
</script>
<template>
  <el-alert v-if="cancelled" title="所属工单已作废或不可读取，禁止新增生产；历史Execution原状态保留。" type="warning" :closable="false" />
  <CrudPage :readonly="cancelled" :key="refresh" :embedded="embedded" :fixed-values="fixed" table-key="business:mes:production:execution:list"
    :editable-row="row=>row.workorderStatus!=='CANCELLED'" :action-column-width="220" title="生产执行单元" permission="business:mes:production:execution" list-action="list" detail-action="query"
    :api="api" :fields="fields" id-key="id" @changed="$emit('changed')">
    <template #search-routingId="{ search }"><BusinessDirectorySelect v-model="search.routingId as string | null" resource="routings" placeholder="搜索工艺名称或编码" /></template>
    <template #field-workorderId="{ draft }"><WorkOrderSelect :source="auth.runtimeMode==='LOCAL'?'LOCAL':auth.runtimeMode==='ERP'?'EXTERNAL':null" v-model="draft.workorderId as string | null" :disabled="Boolean(draft.id)" /></template>
    <template #field-routingId="{ draft }"><ExecutionRoutingSelect v-model="draft.routingId as string | null" :workorder-id="draft.workorderId as string | null" :disabled="draft.status !== 'READY'" /></template>
    <template #toolbar><ExecutionIdentityLookup /></template>
    <template #cell-status="{row}">{{row.status}}<el-tag v-if="row.workorderStatus==='CANCELLED'" type="danger">所属工单已作废</el-tag></template>
    <template #cell-routingId="{row}"><span :title="'工艺版本 ID：'+row.routingId">{{ row.routingCode || '工艺名称未记录' }} / V{{ row.routingVersion ?? '未记录' }} · {{ row.routingName || '名称未记录' }}</span></template>
    <template #cell-createBy="{row}"><span :title="'用户 ID：'+row.createBy">{{ row.createByName || (row.createBy ? '用户 '+row.createBy+'（名称未记录）' : '—') }}</span></template>
    <template #cell-updateBy="{row}"><span :title="'用户 ID：'+row.updateBy">{{ row.updateByName || (row.updateBy ? '用户 '+row.updateBy+'（名称未记录）' : '—') }}</span></template>
    <template #actions="{ row }"><el-popover placement="bottom-end" trigger="click" :width="300"><template #reference><el-button link type="primary">更多操作</el-button></template><div class="execution-actions"><ExecutionRoutePreview :execution-id="String(row.id)" /><el-button v-if="auth.hasPermission('business:production:report:quantity','factory')" link type="primary" @click="router.push({path:'/production/productionReport',query:{executionId:String(row.id),workorderId:String(row.workorderId)}})">查看生产数量</el-button><OperatorConfiguration v-if="row.workorderStatus!=='CANCELLED'" :execution-id="String(row.id)" :context-label="String(row.executionNo)" /><ExecutionIdentityLookup :id="String(row.id)" /><ExecutionActions v-if="row.workorderStatus!=='CANCELLED'" :id="String(row.id)" @changed="changed" /><ProductionClosurePanel :id="String(row.id)" @changed="changed" /></div></el-popover></template>
  </CrudPage>
</template>

<style scoped>
.execution-actions { display: flex; flex-wrap: wrap; gap: var(--ui-space-2); }
</style>
