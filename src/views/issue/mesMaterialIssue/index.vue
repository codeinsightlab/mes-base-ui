<script setup lang="ts">
import MaterialIssueErpAction from '@/components/business/MaterialIssueErpAction.vue'
import MaterialIssueVoidAction from '@/components/business/MaterialIssueVoidAction.vue'
import MasterDetailDocument from '@/components/document/MasterDetailDocument.vue'
import MaterialSelect from '@/components/business/MaterialSelect.vue'
import WarehouseSelect from '@/components/business/WarehouseSelect.vue'
import { api as headerApi } from '@/api/issue/mesMaterialIssue'
import { api as itemApi } from '@/api/issue/mesMaterialIssueItem'
import { headerFields, itemFields } from '../fields'
</script>
<template>
  <MasterDetailDocument
    title="领料出库"
    :header-readonly="row => !!row.voidOperationId || ['VOIDED','VOID_PENDING','VOID_UNKNOWN'].includes(String(row.status))"
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
    <template #field-status="{ draft }">
      <el-select v-model="draft.status as string" :disabled="!!draft.voidOperationId">
        <el-option label="草稿" value="DRAFT" /><el-option label="已记录" value="RECORDED" />
        <el-option v-if="['VOID_PENDING','VOID_UNKNOWN','VOIDED'].includes(String(draft.status))" :label="String(draft.status)" :value="String(draft.status)" disabled />
      </el-select>
    </template>
    <template #field-productId="{ draft, disabled }"><MaterialSelect v-model="draft.productId as string | null" :disabled="!!disabled" /></template>
    <template #field-materialId="{ draft, disabled }"><MaterialSelect v-model="draft.materialId as string | null" :disabled="!!disabled" /></template>
    <template #field-warehouseId="{ draft, disabled }"><WarehouseSelect v-model="draft.warehouseId as string | null" :disabled="!!disabled" /></template>
  </MasterDetailDocument>
</template>
