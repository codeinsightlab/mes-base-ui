<script setup lang="ts">
import { useStockDocumentTypes } from '@/composables/useStockDocumentTypes'
import { computed, onBeforeUnmount, onDeactivated, ref, watch } from 'vue'
import PageDialog from '@/components/page/PageDialog.vue'
import StockDocumentHeader from './StockDocumentHeader.vue'
import StockDocumentMovements from './StockDocumentMovements.vue'
import StockDocumentLines from '@/views/wm/stockDocuments/StockDocumentLines.vue'
import QuantityText from '@/components/business/production/QuantityText.vue'
import { stockDocuments, type Detail, type Header, type Line } from '@/api/wm/stockDocuments'
import { canReadStockDocument, type StockDocumentReference } from '@/lib/stockDocumentReference'
import { useAuth } from '@/stores/auth'
const auth = useAuth(), visible = ref(false), target = ref<StockDocumentReference | null>(null)
const document = ref<Header | null>(null), lines = ref<Line[]>([]), movements = ref<Detail['stockMovements']>([]), selectedLine = ref<Line | null>(null)
const { error: typesError, load: loadTypes, clear: clearTypes, label: typeLabel } = useStockDocumentTypes()
const error = ref(''), lineError = ref(''), loading = ref(false)
const originalLines = new Map()
let generation = 0
const has = (permission: string) => auth.hasPermission(permission, 'factory')
const canHeader = computed(() => has('business:wm:stock:document:query') || !!target.value?.materialIssue && has('business:mes:material:issue:query'))
const canLines = computed(() => has('business:wm:stock:document:query') || !!target.value?.materialIssue && has('business:mes:material:issue:item:list'))
const canLine = computed(() => !!target.value?.materialIssue && has('business:mes:material:issue:item:query'))
const title = computed(() => {
  const name = target.value?.materialIssue ? '来源领料单' : target.value?.direction === 'OUT' ? '来源出库单' : '来源入库单'
  return document.value?.documentNo ? name + ' · ' + document.value.documentNo : name
})
const lineHeader = computed(() => document.value ?? { id: target.value?.documentId, direction: target.value?.direction, documentType: 'MATERIAL_ISSUE' })

function clear() {
  generation++
  visible.value = false
  target.value = null
  document.value = null
  lines.value = []
  movements.value = []
  selectedLine.value = null
  clearTypes()
  error.value = ''
  lineError.value = ''
  loading.value = false
}

async function load() {
  const reference = target.value
  if (!reference || !canReadStockDocument(reference, has)) return
  const ticket = ++generation
  document.value = null
  lines.value = []
  movements.value = []
  selectedLine.value = null
  clearTypes()
  error.value = ''
  lineError.value = ''
  loading.value = true
  const jobs: Promise<void>[] = []
  if (canHeader.value) {
    jobs.push((async() => {
      try {
        const result = await stockDocuments.detail(reference.documentId, reference.direction, !has('business:wm:stock:document:query'))
        if (ticket !== generation) return
        if (result.document.id !== reference.documentId || result.document.direction !== reference.direction
          || reference.materialIssue && result.document.documentType !== 'MATERIAL_ISSUE') throw new Error('来源单据与库存流水不一致')
        document.value = result.document
        if (canLines.value) lines.value = result.lines
        if (has('business:wm:stock:document:query')) movements.value = result.stockMovements
      } catch (reason) {
        if (ticket === generation) error.value = reason instanceof Error ? reason.message : '来源单据读取失败'
      }
    })())
    jobs.push(loadTypes(reference.direction))
  } else if (canLines.value) {
    jobs.push((async() => {
      try {
        const result = await stockDocuments.materialIssueLines(reference.documentId)
        if (ticket === generation) lines.value = result
      } catch (reason) {
        if (ticket === generation) lineError.value = reason instanceof Error ? reason.message : '领料明细读取失败'
      }
    })())
  }
  if (!canLines.value && canLine.value && reference.lineId) {
    jobs.push((async() => {
      try {
        const result = await stockDocuments.materialIssueLine(reference.documentId, reference.lineId!)
        if (ticket !== generation) return
        if (result.documentId !== reference.documentId || result.id !== reference.lineId) throw new Error('领料明细与库存流水不一致')
        selectedLine.value = result
      } catch (reason) {
        if (ticket === generation) lineError.value = reason instanceof Error ? reason.message : '领料明细读取失败'
      }
    })())
  }
  await Promise.all(jobs)
  if (ticket === generation) loading.value = false
}

function open(reference: StockDocumentReference) {
  clear()
  if (!auth.factoryId || auth.factorySwitching || !canReadStockDocument(reference, has)) return
  target.value = { ...reference }
  visible.value = true
  void load()
}

watch(visible, value => {
  if (!value) clear()
}, { flush: 'sync' })
watch(() => [auth.factoryId, auth.revision, auth.factoryPermissions.join('|')], clear, { flush: 'sync' })
onBeforeUnmount(clear)
onDeactivated(clear)
defineExpose({ open, clear })
</script>
<template>
  <PageDialog v-model="visible" :title="title" append-to-body width="min(1120px, 96vw)" class="stock-source-detail">
    <div class="source-toolbar"><span class="secondary">来源单据 · 只读查看</span><el-button :loading="loading" @click="load">刷新详情</el-button></div>
    <el-alert v-if="error" :title="error" type="error" :closable="false"><el-button link @click="load">重试</el-button></el-alert>
    <el-alert v-if="typesError" :title="'单据类型名称读取失败：' + typesError" type="warning" :closable="false"><el-button link @click="load">重试</el-button></el-alert>
    <p v-if="loading" role="status">正在读取来源单据…</p>
    <section v-if="document" aria-label="来源单据基本信息"><h3>基本信息</h3><StockDocumentHeader :document="document" :type-label="typeLabel(document.documentType)" /></section>
    <section v-if="canLines && !error && !lineError && !loading" aria-label="来源单据明细"><h3>单据明细</h3><StockDocumentLines :header="lineHeader" :items="lines" :show-action-links="false" :writable="false" :saving="false" :can-issue-line="false" :original-lines="originalLines" /></section>
    <StockDocumentMovements v-if="document && has('business:wm:stock:document:query')" :movements="movements" />
    <p v-if="!canLines && document" class="secondary">当前权限不允许查看完整明细。</p>
    <el-alert v-if="lineError" :title="lineError" type="error" :closable="false"><el-button link @click="load">重试</el-button></el-alert>
    <el-descriptions v-if="selectedLine" :column="2" border><el-descriptions-item label="批次">{{ selectedLine.batchNo || '无批次' }}</el-descriptions-item><el-descriptions-item label="库位">{{ selectedLine.binCode || '无库位' }}</el-descriptions-item><el-descriptions-item label="数量"><QuantityText :value="selectedLine.quantity" /></el-descriptions-item><el-descriptions-item label="备注">{{ selectedLine.remark || '—' }}</el-descriptions-item></el-descriptions>
    <template #footer><el-button @click="clear">关闭</el-button></template>
  </PageDialog>
</template>
<style scoped>
.source-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; }
section + section { margin-top: 24px; }
h3 { margin: 0 0 12px; font-size: 14px; font-weight: 600; }
</style>
