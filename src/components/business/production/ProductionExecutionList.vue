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
const activeActions = ref<string | null>(null)
const canQuery = computed(() => auth.hasPermission('business:mes:production:execution:query', 'factory'))
const canQuantity = computed(() => auth.hasPermission('business:production:report:quantity', 'factory'))
const canAssign = computed(() => auth.hasPermission('business:mes:execution:assignment:list', 'factory'))
watch(() => [auth.factoryId, auth.revision, auth.factoryPermissions.join('|'), props.workorderId], () => { activeActions.value = null })
function setActionsVisible(id: string, visible: boolean) {
  if (visible) activeActions.value = id
  else if (activeActions.value === id) activeActions.value = null
}
function actionClicked(event: MouseEvent) {
  if (event.target instanceof Element && event.target.closest('button')) activeActions.value = null
}
let ticket=0
watch(()=>[props.workorderId,auth.factoryId,auth.revision],async()=>{
 const t=++ticket;cancelled.value=!!props.workorderId
 if(!props.workorderId||!auth.hasPermission('workorder:query','factory'))return
 try{const d=await workorders.detail(props.workorderId);if(t===ticket)cancelled.value=d.workorder.status==='CANCELLED'}catch{if(t===ticket)cancelled.value=true}
},{immediate:true})
onBeforeUnmount(()=>ticket++)
function changed() { activeActions.value = null; refresh.value++; emit('changed') }
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
    <template #actions="{ row }">
      <el-popover v-if="canQuery || canQuantity || (canAssign && row.workorderStatus !== 'CANCELLED')"
        placement="bottom-end" trigger="click" :width="240" :persistent="true"
        :visible="activeActions === String(row.id)" @update:visible="setActionsVisible(String(row.id), $event)">
        <template #reference><el-button link type="primary" :aria-expanded="activeActions === String(row.id)" @keydown.esc="activeActions = null">更多操作 <span class="execution-actions-chevron" aria-hidden="true"></span></el-button></template>
        <div class="execution-actions" @click="actionClicked" @keydown.esc="activeActions = null">
          <div class="execution-actions-context" :title="String(row.executionNo)">{{ row.executionNo }}</div>
          <section v-if="canQuery || canQuantity" class="execution-actions-group" aria-label="执行查看">
            <h3>执行查看</h3>
            <ExecutionRoutePreview :execution-id="String(row.id)" />
            <el-button v-if="canQuantity" link type="primary" @click="router.push({path:'/production/productionReport',query:{executionId:String(row.id),workorderId:String(row.workorderId)}})">查看生产数量</el-button>
            <ExecutionIdentityLookup :id="String(row.id)" />
          </section>
          <section v-if="row.workorderStatus !== 'CANCELLED' && (canAssign || canQuery)" class="execution-actions-group" aria-label="生产操作">
            <h3>生产操作</h3>
            <OperatorConfiguration :execution-id="String(row.id)" :context-label="String(row.executionNo)" />
            <ExecutionActions :id="String(row.id)" @changed="changed" />
          </section>
          <section v-if="canQuery" class="execution-actions-group" aria-label="生产闭环">
            <h3>生产闭环</h3>
            <ProductionClosurePanel :id="String(row.id)" @changed="changed" />
          </section>
        </div>
      </el-popover>
    </template>
  </CrudPage>
</template>

<style scoped>
.execution-actions { max-height: 70vh; overflow-y: auto; }
.execution-actions-context { padding: 0 var(--ui-space-2) var(--ui-space-2); color: var(--ui-text-secondary); font-family: var(--ui-font-mono); font-size: var(--ui-text-xs); overflow-wrap: anywhere; }
.execution-actions-group { display: flex; flex-direction: column; gap: var(--ui-space-1); border-top: 1px solid var(--ui-border-soft); padding: var(--ui-space-2) 0; }
.execution-actions-group:last-child { padding-bottom: 0; }
.execution-actions-group h3 { margin: 0; padding: 0 var(--ui-space-2) var(--ui-space-1); color: var(--ui-text-secondary); font-size: var(--ui-text-xs); font-weight: 500; }
.execution-actions-group :deep(.el-button) { display: flex; justify-content: flex-start; width: 100%; min-height: var(--ui-space-8); height: auto; margin: 0; padding: var(--ui-space-2); border: 0; border-radius: var(--ui-radius-sm); color: var(--ui-text); font-size: var(--ui-text-sm); font-weight: 400; text-align: left; white-space: normal; }
.execution-actions-group :deep(.el-button:hover), .execution-actions-group :deep(.el-button:focus-visible) { color: var(--mes-primary); background: var(--el-color-primary-light-9); }
.execution-actions-chevron::after { content: "⌄"; margin-left: var(--ui-space-1); }
</style>
