<!-- MES-CODEGEN: generated foundation with reviewed SIMPLE business fields. -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import CrudPage from '@/components/CrudPage.vue'
import SyncButton from '@/components/business/SyncButton.vue'
import { api, sync } from '@/api/material/safetyStock'
import type { Field } from '@/lib/crud'
import { useBasicDataReferences } from '@/lib/basicDataReferences'
import { api as materialIdApi } from '@/api/material/material'
const page = ref<InstanceType<typeof CrudPage> | null>(null)
const { options: materialIdOptions, reload: materialIdReload } = useBasicDataReferences(materialIdApi, 'business:material')
const fields = computed<Field[]>(() => [
  { key: 'id', label: '编号', kind: 'text', readonly: true },
  { key: 'materialId', label: '物料产品', kind: 'select', required: true, searchable: false, maxLength: 500, options: materialIdOptions.value },
  { key: 'minQty', label: '最低库存量', kind: 'decimal', required: true, searchable: false, maxLength: 500, defaultValue: '0.0000' },
  { key: 'maxQty', label: '最高库存量', kind: 'decimal', required: false, searchable: false, maxLength: 500 },
  { key: 'status', label: '状态', kind: 'select', required: true, searchable: false, maxLength: 500, options: [{ label: '启用', value: 'ENABLED', tone: 'success' }, { label: '停用', value: 'DISABLED', tone: 'info' }], defaultValue: 'ENABLED' },
])
</script>
<template>
  <CrudPage list-action="list" detail-action="query" @changed="materialIdReload()" ref="page" title="安全库存" permission="business:safety:stock" :api="api" :fields="fields" id-key="id">
    <template #toolbar>
      <SyncButton permission="business:safety:stock:sync" scope="factory" :run="sync" @completed="page?.load()" />
    </template>
  </CrudPage>
</template>
