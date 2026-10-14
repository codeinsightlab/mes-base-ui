<script setup lang="ts">
import CrudPage from '@/components/CrudPage.vue'
import { api } from '@/api/production/mesProductionExecution'
import { fields } from '@/views/production/mesProductionExecution/fields'
import ExecutionIdentityLookup from './ExecutionIdentityLookup.vue'
import WorkOrderSelect from './WorkOrderSelect.vue'
import { computed } from 'vue'
const props = defineProps<{ workorderId?: string; embedded?: boolean }>()
defineEmits<{ changed: [] }>()
const fixed = computed(() => props.workorderId ? { workorderId: props.workorderId } : undefined)
</script>
<template>
  <CrudPage :embedded="embedded" :fixed-values="fixed" table-key="business:mes:production:execution:list"
    title="生产执行单元" permission="business:mes:production:execution" list-action="list" detail-action="query"
    :api="api" :fields="fields" id-key="id" @changed="$emit('changed')">
    <template #field-workorderId="{ draft }"><WorkOrderSelect v-model="draft.workorderId as string | null" :disabled="Boolean(draft.id)" /></template>
    <template #toolbar><ExecutionIdentityLookup /></template>
    <template #actions="{ row }"><ExecutionIdentityLookup :id="String(row.id)" /></template>
  </CrudPage>
</template>
