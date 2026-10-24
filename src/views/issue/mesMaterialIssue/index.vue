<script setup lang="ts">
import { useAuth } from '@/stores/auth'
import { ref, watch, onMounted, onActivated } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ProductionExecutionSelect from '@/components/business/production/ProductionExecutionSelect.vue'
import MaterialIssueErpAction from '@/components/business/MaterialIssueErpAction.vue'
import MaterialIssueVoidAction from '@/components/business/MaterialIssueVoidAction.vue'
import MasterDetailDocument from '@/components/document/MasterDetailDocument.vue'
import MaterialSelect from '@/components/business/MaterialSelect.vue'
import WarehouseSelect from '@/components/business/WarehouseSelect.vue'
import { api as headerApi } from '@/api/issue/mesMaterialIssue'
import { api as itemApi } from '@/api/issue/mesMaterialIssueItem'
import { headerFields, itemFields } from '../fields'
const auth = useAuth()
const route = useRoute(), router = useRouter(), document = ref<InstanceType<typeof MasterDetailDocument> | null>(null)
function openLinkedIssue() { const id = route.query.issueId; if (typeof id === 'string' && /^[1-9]\d*$/.test(id)) void document.value?.open({id}); else if (route.query.view === 'list') void document.value?.back() }
onMounted(openLinkedIssue)
watch(() => route.query.issueId, openLinkedIssue)
onActivated(() => { if (route.query.view === 'list' && !route.query.issueId) void document.value?.back() })
</script>
<template>
  <el-alert title="新增生产领料请按BOM与库存来源保存正式出库草稿，随后在出入库单独立审核。已保存的旧领料事实保持只读，不自动补扣库存。" type="info" :closable="false" />
  <el-button v-if="auth.hasPermission('business:mes:material:issue:update','factory')" @click="router.push('/production/productionInput')">新增正式领料草稿 / 便捷投产</el-button>
  <MasterDetailDocument :creatable="false" ref="document"
    title="领料出库"
    :header-readonly="() => true"
    :header-api="headerApi"
    :item-api="itemApi"
    :header-fields="headerFields"
    :item-fields="itemFields"
    parent-key="issueId"
    header-permission="business:mes:material:issue"
    item-permission="business:mes:material:issue:item"
    header-table-key="business:mes:material:issue:list"
    item-table-key="business:mes:material:issue:item:list"
  >
    <template #header-actions="{ row, refresh, dirty }"><MaterialIssueVoidAction :row="row" :refresh="refresh" :dirty="dirty" /><MaterialIssueErpAction :row="row" :refresh="refresh" :dirty="dirty" /></template>
    <template #field-executionId="{ draft, disabled }"><ProductionExecutionSelect v-model="draft.executionId as string | null" :disabled="!!disabled || !!draft.id" @selected="e => { draft.workorderId = e.workorderId; draft.productId = e.productId; draft.routingId = e.routingId }" /></template>
    <template #field-status="{ draft }">
      <el-select v-model="draft.status as string" disabled>
        <el-option label="草稿" value="DRAFT" /><el-option label="已记录" value="RECORDED" />
        <el-option v-if="['SUBMITTING','SUBMIT_UNKNOWN','SUBMIT_REJECTED','CONFIRMED','VOID_PENDING','VOID_UNKNOWN','VOIDED'].includes(String(draft.status))" :label="String(draft.status)" :value="String(draft.status)" disabled />
      </el-select>
    </template>
    <template #field-productId="{ draft, disabled }"><MaterialSelect v-model="draft.productId as string | null" :disabled="!!disabled" /></template>
    <template #field-materialId="{ draft, disabled }"><MaterialSelect v-model="draft.materialId as string | null" :disabled="!!disabled" /></template>
    <template #field-warehouseId="{ draft, disabled }"><WarehouseSelect v-model="draft.warehouseId as string | null" :disabled="!!disabled" /></template>
  </MasterDetailDocument>
</template>
