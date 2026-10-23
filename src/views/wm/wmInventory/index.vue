<script setup lang="ts">
// EXTRA_CODE_REASON: inventory needs Material/Warehouse reference selection.
import MaterialSelect from '@/components/business/MaterialSelect.vue'
import WarehouseSelect from '@/components/business/WarehouseSelect.vue'
import CrudPage from '@/components/CrudPage.vue'
import LocalStockPanel from '@/components/business/warehouse/LocalStockPanel.vue'
import { useAuth } from '@/stores/auth'
const stockPanel = ref<InstanceType<typeof LocalStockPanel> | null>(null)
const auth = useAuth()
import { api } from '@/api/wm/wmInventory'
import type { Field } from '@/lib/crud'
import { ref } from 'vue'
import { sync } from '@/api/wm/wmInventory'
import SyncButton from '@/components/business/SyncButton.vue'
const page = ref<InstanceType<typeof CrudPage> | null>(null)

const fields: Field[] = [
  {key:'warehouseSource',label:'仓库来源',kind:'text',readonly:true,columnMinWidth:200},
  { key: 'batchNo', label: '材料批次', kind: 'text', maxLength: 128 },
  { key: 'binCode', label: '库位', kind: 'text', maxLength: 64 },
  { key: 'materialName', columnMinWidth: 260, label: '物料', kind: 'text', readonly: true, searchable: false },
  { key: 'warehouseName', columnMinWidth: 260, label: '仓库', kind: 'text', readonly: true, searchable: false },
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
    key: 'materialId',
    hidden: true,
    label: '物料',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: true,
    maxLength: 19
  },
  {
    key: 'warehouseId',
    hidden: true,
    label: '仓库',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: true,
    maxLength: 19
  },
  {
    key: 'quantity',
    columnMinWidth: 220,
    label: '实存数量',
    kind: 'decimal',
    readonly: true,
    required: true,
    searchable: false,
    maxLength: 20
  },
  {
    key: 'availableQuantity',
    columnMinWidth: 220,
    label: '可用数量',
    kind: 'decimal',
    readonly: true,
    required: false,
    searchable: false,
    maxLength: 20
  },
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
    key: 'createBy',
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
    key: 'updateBy',
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
    table-key="business:wm:inventory:list"
    title="库存管理"
    permission="business:wm:inventory"
    list-action="list"
    detail-action="query"
    :action-column-width="280"
    :api="api"
    :readonly="auth.runtimeMode!=='LOCAL'"
    :editable-row="row => row.warehouseSource==='LOCAL'"
    :fields="fields"
    id-key="id"
  >
    <template #search-materialId="{ search }">
      <MaterialSelect :model-value="search.materialId ? String(search.materialId) : null" @update:model-value="search.materialId = $event || ''" />
    </template>
    <template #search-warehouseId="{ search }">
      <WarehouseSelect history :model-value="search.warehouseId ? String(search.warehouseId) : null" @update:model-value="search.warehouseId = $event || ''" />
    </template>
    <template #field-materialId="{ draft }">
      <MaterialSelect :model-value="draft.materialId ? String(draft.materialId) : null" @update:model-value="draft.materialId = $event" />
    </template>
    <template #field-warehouseId="{ draft }">
      <WarehouseSelect source="LOCAL" :model-value="draft.warehouseId ? String(draft.warehouseId) : null" @update:model-value="draft.warehouseId = $event" />
    </template>
    <template #cell-warehouseSource="{row}">{{ row.warehouseSource==='LOCAL'?'本地':row.warehouseSource==='EXTERNAL'?'外部ERP（库存仅参考）':'历史待核实' }}</template>
    <template #toolbar>
      <span class="secondary">外部镜像仅供参考，不作为正式库存交易依据。</span>
      <SyncButton v-if="auth.runtimeMode==='ERP'" permission="business:wm:inventory:sync" scope="factory" :run="sync" @completed="page?.load()" />
    </template>
    <template #actions="{ row }"><el-button v-if="auth.hasPermission('business:wm:inventory:query', 'factory')" text type="primary" @click="stockPanel?.open(String(row.id))">库存业务 / 流水</el-button></template>
  </CrudPage>
  <LocalStockPanel ref="stockPanel" @changed="page?.load()" />
</template>
