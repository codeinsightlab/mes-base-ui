<script setup lang="ts">
import { businessSourceLabel } from '@/lib/businessSource'
// EXTRA_CODE_REASON: inventory needs Material/Warehouse reference selection.
import MaterialSelect from '@/components/business/MaterialSelect.vue'
import WarehouseSelect from '@/components/business/WarehouseSelect.vue'
import CrudPage from '@/components/CrudPage.vue'
import LocalStockPanel from '@/components/business/warehouse/LocalStockPanel.vue'
import QuantityText from '@/components/business/production/QuantityText.vue'
import DateTimeText from '@/components/DateTimeText.vue'
import { useAuth } from '@/stores/auth'
const stockPanel = ref<InstanceType<typeof LocalStockPanel> | null>(null)
const auth = useAuth()
const { displayApi, unitNames, unitError, unitLoading, loadUnits, pause, resume } = useInventoryDisplay()
import type { Field } from '@/lib/crud'
import { onActivated, onDeactivated, ref } from 'vue'
import DocumentFields from '@/components/document/DocumentFields.vue'
import { useInventoryDisplay } from './useInventoryDisplay'
import { sync } from '@/api/wm/wmInventory'
import SyncButton from '@/components/business/SyncButton.vue'
const page = ref<InstanceType<typeof CrudPage> | null>(null)

const fields: Field[] = ([
  { key: 'materialId', label: '物料 / 产品', kind: 'text', required: true, searchable: true, hidden: true },
  { key: 'warehouseId', label: '仓库', kind: 'text', required: true, searchable: true, hidden: true },
  { key: 'materialName', label: '物料 / 产品', kind: 'text', readonly: true, columnMinWidth: 240 },
  { key: 'warehouseName', label: '仓库', kind: 'text', readonly: true, columnMinWidth: 220 },
  { key: 'batchNo', label: '批次', kind: 'text', searchable: true, maxLength: 128, columnMinWidth: 200 },
  { key: 'binCode', label: '库位', kind: 'text', maxLength: 64, hidden: true },
  { key: 'quantity', label: '数量 / 基本单位', kind: 'decimal', readonly: true, columnMinWidth: 220 },
  { key: 'availableQuantity', label: '可用数量', kind: 'decimal', readonly: true, hidden: true },
  { key: 'unitName', label: '基本单位', kind: 'text', readonly: true, hidden: true },
  { key: 'warehouseSource', label: '库存来源', kind: 'text', readonly: true, hidden: true },
  { key: 'status', label: '状态', kind: 'select', columnMinWidth: 90, required: true, defaultValue: 'ENABLED', searchable: true, options: [{ label: '启用', value: 'ENABLED', tone: 'success' }, { label: '停用', value: 'DISABLED', tone: 'info' }] },
  { key: 'remark', label: '备注', kind: 'textarea', maxLength: 500, columnVisible: false },
  { key: 'createTime', label: '创建时间', kind: 'datetime', readonly: true, hidden: true },
  { key: 'updateTime', label: '修改时间', kind: 'datetime', readonly: true, hidden: true },
  { key: 'id', label: '库存标识', kind: 'text', readonly: true, hidden: true }
] as Field[]).map(field => ({ ...field, columnMovable: false }))
const editorFields = ['materialId', 'warehouseId', 'batchNo', 'binCode', 'status', 'remark'].flatMap(key => fields.filter(field => field.key === key)).map(field => ({ ...field, hidden: false }))
let deactivated = false
onDeactivated(() => { deactivated = true;pause() })
onActivated(() => { if (deactivated) { deactivated = false;resume();void page.value?.load() } })

</script>

<template>
  <CrudPage
    ref="page"
    table-key="business:wm:inventory:list"
    title="库存管理"
    record-label="库存记录"
    permission="business:wm:inventory"
    list-action="list"
    detail-action="query"
    :action-column-width="180"
    :api="displayApi"
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
    <template #editor="{draft,saving,readonly,save}">
      <p class="inventory-editor-note">维护物料、仓库及批次信息；数量通过入库、出库和库存调整更新。</p>
      <DocumentFields :fields="editorFields" :draft="draft" :disabled="saving || readonly" @submit="save">
        <template #field-materialId="{draft,disabled}"><MaterialSelect v-model="(draft.materialId as string | null)" :disabled="disabled" /></template>
        <template #field-warehouseId="{draft,disabled}"><WarehouseSelect v-model="(draft.warehouseId as string | null)" source="LOCAL" :disabled="disabled" /></template>
      </DocumentFields>
    </template>
    <template #cell-materialName="{row}"><span class="inventory-reference">{{ row.materialName || '物料名称待确认' }}</span></template>
    <template #cell-warehouseName="{row}"><div class="inventory-reference">{{ row.warehouseName || '仓库名称待确认' }}<small>{{ businessSourceLabel(row.warehouseSource) }}<template v-if="row.warehouseSource==='EXTERNAL'"> · 库存仅供参考</template></small></div></template>
    <template #cell-batchNo="{row}"><div class="inventory-reference">{{ row.batchNo || '无批次' }}<small>{{ row.binCode ? '库位：' + row.binCode : '无库位' }}</small></div></template>
    <template #cell-quantity="{row}"><div class="inventory-quantities"><div><small>实存</small><QuantityText :value="row.quantity" /></div><div><small>可用</small><QuantityText :value="row.availableQuantity" /></div></div><small class="inventory-unit">{{ unitNames[String(row.id)] || (unitLoading ? '读取中…' : unitError ? '单位读取失败' : '单位待确认') }}</small></template>
    <template #cell-createTime="{row}"><DateTimeText :value="row.createTime" /></template>
    <template #cell-updateTime="{row}"><DateTimeText :value="row.updateTime" /></template>
    <template #toolbar>
      <span v-if="auth.runtimeMode==='ERP'" class="secondary">外部库存仅供参考，以 ERP 为准。</span>
      <div v-if="unitError" class="inventory-unit-error" role="alert"><span>单位名称读取失败，库存数量仍可查看。{{ unitError }}</span><el-button link type="primary" @click="loadUnits">重试</el-button></div>
      <SyncButton v-if="auth.runtimeMode==='ERP'" permission="business:wm:inventory:sync" scope="factory" :run="sync" @completed="page?.load()" />
    </template>
    <template #actions="{ row }"><el-button v-if="auth.hasPermission('business:wm:inventory:query', 'factory')" text type="primary" @click="stockPanel?.open(String(row.id))">查看库存</el-button></template>
  </CrudPage>
  <LocalStockPanel ref="stockPanel" @changed="page?.load()" />
</template>

<style scoped>
.inventory-reference { display: flex; flex-direction: column; gap: var(--ui-space-1); white-space: normal; overflow-wrap: anywhere; line-height: 1.5; }
.inventory-reference small, .inventory-quantities small, .inventory-unit { color: var(--ui-text-secondary); font-size: 12px; }
.inventory-quantities { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: var(--ui-space-3); }
.inventory-quantities > div { display: flex; flex-direction: column; gap: var(--ui-space-1); }
.inventory-unit { display: block; margin-top: var(--ui-space-1); white-space: normal; overflow-wrap: anywhere; }
.inventory-unit-error { display: flex; align-items: center; flex-wrap: wrap; gap: var(--ui-space-2); color: var(--el-color-danger); }
.inventory-editor-note { margin: 0 0 var(--ui-space-4); color: var(--ui-text-secondary); line-height: 1.5; }
</style>
