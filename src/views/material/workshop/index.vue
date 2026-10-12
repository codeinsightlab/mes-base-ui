<!-- MES-CODEGEN: generated foundation with reviewed SIMPLE business fields. -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import CrudPage from '@/components/CrudPage.vue'
import SyncButton from '@/components/business/SyncButton.vue'
import { api, sync } from '@/api/material/workshop'
import type { Field } from '@/lib/crud'
const page = ref<InstanceType<typeof CrudPage> | null>(null)
const fields = computed<Field[]>(() => [
  { key: 'id', label: '编号', kind: 'text', readonly: true },
  { key: 'code', label: '车间编码', kind: 'text', required: true, searchable: true, maxLength: 64 },
  { key: 'name', label: '车间名称', kind: 'text', required: true, searchable: true, maxLength: 255 },
  { key: 'status', label: '状态', kind: 'select', required: true, searchable: false, maxLength: 500, options: [{ label: '启用', value: 'ENABLED', tone: 'success' }, { label: '停用', value: 'DISABLED', tone: 'info' }], defaultValue: 'ENABLED' },
  { key: 'remark', label: '备注', kind: 'textarea', required: false, searchable: false, maxLength: 500 },
])
</script>
<template>
  <CrudPage list-action="list" detail-action="query" ref="page" title="车间" permission="business:workshop" :api="api" :fields="fields" id-key="id">
    <template #toolbar>
      <SyncButton permission="business:workshop:sync" scope="factory" :run="sync" @completed="page?.load()" />
    </template>
  </CrudPage>
</template>
