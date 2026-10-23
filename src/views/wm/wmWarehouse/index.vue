<script setup lang="ts">
import E10SyncPreview from '@/components/business/E10SyncPreview.vue'
import CrudPage from '@/components/CrudPage.vue'
import { api, warehouseTypeOptions, warehouseTypeText } from '@/api/wm/wmWarehouse'
import type { Field } from '@/lib/crud'
import { ref } from 'vue'
import { useAuth } from '@/stores/auth'
const auth = useAuth()
const page = ref<InstanceType<typeof CrudPage> | null>(null)

const fields: Field[] = [
  { key: 'source', columnMinWidth: 200, label: '来源', kind: 'text', readonly: true, options: [{ label: '本地', value: 'LOCAL' }, { label: '外部ERP（库存仅参考）', value: 'EXTERNAL' }] },
  {
    key: 'id',
    label: '编号',
    kind: 'text',
    readonly: true,
    required: true,
    searchable: false,
    maxLength: 19
  },
  {
    key: 'code',
    columnMinWidth: 200,
    label: '仓库编码',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: true,
    maxLength: 64
  },
  {
    key: 'name',
    columnMinWidth: 240,
    label: '仓库名称',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: true,
    maxLength: 255
  },
  { key: 'warehouseType', label: '仓库类型', kind: 'text', required: true, searchable: true, columnMinWidth: 180, options: [...warehouseTypeOptions], format: warehouseTypeText },
  {
    key: 'status',
    defaultValue: 'ENABLED',
    options: [{ label: '启用', value: 'ENABLED', tone: 'success' }, { label: '停用', value: 'DISABLED', tone: 'info' }],
    label: '状态',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: true,
    maxLength: 16
  },
  {
    key: 'remark',
    label: '备注',
    kind: 'text',
    readonly: false,
    required: false,
    searchable: false,
    maxLength: 500
  },
  {
    key: 'createByName',
    label: '创建人',
    kind: 'text',
    readonly: true,
    required: false,
    searchable: false,
    maxLength: 64
  },
  {
    key: 'createTime',
    label: '创建时间',
    kind: 'datetime',
    readonly: true,
    required: false,
    searchable: false,
    maxLength: 19
  },
  {
    key: 'updateByName',
    label: '修改人',
    kind: 'text',
    readonly: true,
    required: false,
    searchable: false,
    maxLength: 64
  },
  {
    key: 'updateTime',
    label: '修改时间',
    kind: 'datetime',
    readonly: true,
    required: false,
    searchable: false,
    maxLength: 19
  }
]
</script>

<template>
  <CrudPage
    ref="page"
    table-key="business:wm:warehouse:list"
    title="仓库管理"
    permission="business:wm:warehouse"
    list-action="list"
    detail-action="query"
    :api="api"
    :readonly="auth.runtimeMode !== 'LOCAL'"
    :editable-row="row => row.source === 'LOCAL'"
    :fields="fields"
    id-key="id"
  >
    <template #cell-warehouseType="{ row }"><span>{{ row.warehouseTypeLabel || warehouseTypeText(row.warehouseType) }}</span></template>
    <template #cell-source="{ row }"><span>{{ row.source === 'LOCAL' ? '本地' : row.source === 'EXTERNAL' ? '外部ERP（库存仅参考）' : '历史待核实' }}</span></template>
    <template #toolbar>
      <span class="secondary">来源由可信创建入口确定；ERP仓库仅由同步维护，库存镜像仅供参考。</span>
      <E10SyncPreview kind="warehouse" permission="business:wm:warehouse:sync" @completed="page?.load()" />
    </template>
  </CrudPage>
</template>
