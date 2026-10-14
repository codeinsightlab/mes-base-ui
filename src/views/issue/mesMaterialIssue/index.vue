<script setup lang="ts">
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
    <template #field-productId="{ draft }"><MaterialSelect v-model="draft.productId as string | null" /></template>
    <template #field-materialId="{ draft }"><MaterialSelect v-model="draft.materialId as string | null" /></template>
    <template #field-warehouseId="{ draft }"><WarehouseSelect v-model="draft.warehouseId as string | null" /></template>
  </MasterDetailDocument>
</template>
