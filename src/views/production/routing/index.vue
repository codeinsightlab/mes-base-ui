<script setup lang="ts">
import { usePageMessageBox } from '@/lib/pageMessageBox'

import PageDialog from '@/components/page/PageDialog.vue'
import PageDrawer from '@/components/page/PageDrawer.vue'

import QueryForm from '@/components/QueryForm.vue'

import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import CodeText from '@/components/CodeText.vue'
import Pagination from '@/components/Pagination/index.vue'
import RightToolbar from '@/components/RightToolbar/index.vue'
import SyncButton from '@/components/business/SyncButton.vue'
import { api, sync, type ReferenceOption, type RoutingDetail, type RoutingVo } from '@/api/production/routing'
import { contentError } from '@/lib/production/routingGraph'
import RoutingGraphPreview from '@/components/business/RoutingGraphPreview.vue'
import type { RoutingNode, RoutingProduct } from '@/api/production/routing'
import { parseTime } from '@/utils/ruoyi'
import { useAuth } from '@/stores/auth'
const ElMessageBox = usePageMessageBox()

const auth = useAuth()
const can = (action: string) => auth.hasPermission('routing:' + action, 'factory')
const filters = reactive({ code: '', name: '', status: '' })
const rows = ref<RoutingVo[]>([]), total = ref(0), page = ref(1), pageSize = ref(20)
const loading = ref(false), busy = ref(false), error = ref(''), drawerError = ref('')
const showSearch = ref(true), drawer = ref(false), createDialog = ref(false), copyDialog = ref(false)
const detail = ref<RoutingDetail | null>(null)
const materialIds = ref<string[]>([]), operationOptions = ref<ReferenceOption[]>([]), materialOptions = ref<ReferenceOption[]>([])
const metadata = reactive({ name: '', description: '' }), createForm = reactive({ code: '', name: '', description: '' })
const copyForm = reactive({ code: '', name: '' })
const graphDialog = ref(false)
const savedContent = ref('')
const contentFingerprint = () => JSON.stringify({ materials: [...materialIds.value].sort(), nodes: detail.value?.nodes.map(({ nodeCode, displayOrder, operationId, isKey, description }) => ({ nodeCode, displayOrder, operationId, isKey, description })), edges: detail.value?.edges.map(({ fromNodeCode, toNodeCode }) => ({ fromNodeCode, toNodeCode })) })
const connection = reactive({ from: '', to: '' })

const pendingContent = computed(() => !!detail.value && contentFingerprint() !== savedContent.value)
const pendingMetadata = computed(() => !!detail.value && (metadata.name !== detail.value.routing.name || metadata.description !== (detail.value.routing.description ?? '')))
const editable = computed(() => detail.value?.routing.status === 'DRAFT' && can('update'))
let sequence = 0, listSequence = 0, operationSequence = 0, materialSequence = 0
const alive = (attempt: number, revision: number) => attempt === sequence && revision === auth.revision
const labels = { DRAFT: '草稿', PUBLISHED: '已发布', DISABLED: '停用' } as const
const tone = (status: RoutingVo['status']) => status === 'PUBLISHED' ? 'success' : status === 'DRAFT' ? 'warning' : 'disabled'
function productLabel(product: RoutingProduct) {
  if (!product.currentMaterialCode || !product.currentMaterialName)
    return `${product.currentMaterialCode ?? '品号待确认'} · ${product.currentMaterialName ?? '名称待确认'}（物料ID ${product.materialId}）`
  return `${product.currentMaterialCode} · ${product.currentMaterialName}`
}
function clear() {
  sequence++; listSequence++; operationSequence++; materialSequence++
  rows.value = []; total.value = 0; detail.value = null; materialIds.value = []
  drawer.value = createDialog.value = copyDialog.value = graphDialog.value = false
  operationOptions.value = []; materialOptions.value = []; loading.value = busy.value = false
  error.value = drawerError.value = ''; page.value = 1; connection.from = ''; connection.to = ''
}
watch(() => [auth.revision, auth.factoryId, ...['list', 'query', 'create', 'update', 'publish', 'copy', 'version'].map(can)], () => {
  clear(); if (can('list')) void load()
}, { flush: 'sync' })
onBeforeUnmount(clear)
async function beforeCloseDetail(done: () => void) {
  const attempt = sequence, revision = auth.revision
  if (pendingContent.value || pendingMetadata.value) {
    try { await ElMessageBox.confirm('有未保存修改，确认放弃并关闭？', '关闭工艺路线详情', { type: 'warning' }) } catch { return }
  }
  if (alive(attempt, revision)) done()
}
function closeDetail() {
  sequence++; operationSequence++; materialSequence++
  busy.value = false; detail.value = null
  graphDialog.value = copyDialog.value = false
  operationOptions.value = []; materialOptions.value = []
}
async function load() {
  if (!can('list')) return
  const attempt = ++listSequence, revision = auth.revision
  loading.value = true; error.value = ''
  try {
    const query: Record<string, string | number> = { offset: (page.value - 1) * pageSize.value, limit: pageSize.value }
    for (const [key, value] of Object.entries(filters)) if (value) query[key] = value
    const result = await api.list(query)
    if (attempt !== listSequence || revision !== auth.revision) return
    rows.value = result.items; total.value = result.total
  } catch(failure) {
    if (attempt === listSequence && revision === auth.revision) error.value = failure instanceof Error ? failure.message : '读取失败'
  } finally { if (attempt === listSequence && revision === auth.revision) loading.value = false }
}
function accept(value: RoutingDetail) {
  connection.from = ''; connection.to = ''
  detail.value = value; materialIds.value = value.products.map(item => item.materialId)
  savedContent.value = contentFingerprint()
  metadata.name = value.routing.name; metadata.description = value.routing.description ?? ''
  operationOptions.value = [...new Map(value.nodes.filter(node => node.operationCode).map(node => [node.operationId, { id: node.operationId, code: node.operationCode!, name: node.operationName ?? '' }])).values()]
  materialOptions.value = value.products.map(product => ({ id: product.materialId, code: product.currentMaterialCode ?? `物料ID ${product.materialId}`, name: product.currentMaterialName ?? '名称待确认' }))
}
async function open(id: string) {
  if (!can('query')) return
  const attempt = ++sequence, revision = auth.revision
  drawer.value = true; detail.value = null; drawerError.value = ''; busy.value = true
  try {
    const value = await api.detail(id)
    if (!alive(attempt, revision)) return
    accept(value)
    if (editable.value) { void searchOperations(''); void searchMaterials('') }
  } catch(failure) {
    if (alive(attempt, revision)) drawerError.value = failure instanceof Error ? failure.message : '读取详情失败'
  } finally { if (alive(attempt, revision)) busy.value = false }
}
function mergeOptions(old: ReferenceOption[], incoming: ReferenceOption[]) {
  const selected = new Set([...materialIds.value, ...(detail.value?.nodes.map(step => step.operationId) ?? [])])
  return [...new Map([...old.filter(option => selected.has(option.id)), ...incoming].map(option => [option.id, option])).values()]
}
async function searchOperations(search: string) {
  if (!editable.value) return
  const attempt = ++operationSequence, revision = auth.revision, owner = sequence
  try {
    const options = await api.operations(search)
    if (attempt === operationSequence && alive(owner, revision) && editable.value) operationOptions.value = mergeOptions(operationOptions.value, options)
  } catch(failure) { if (attempt === operationSequence && alive(owner, revision)) drawerError.value = failure instanceof Error ? failure.message : '工序查询失败' }
}
async function searchMaterials(search: string) {
  if (!editable.value) return
  const attempt = ++materialSequence, revision = auth.revision, owner = sequence
  try {
    const options = await api.materials(search)
    if (attempt === materialSequence && alive(owner, revision) && editable.value) materialOptions.value = mergeOptions(materialOptions.value, options)
  } catch(failure) { if (attempt === materialSequence && alive(owner, revision)) drawerError.value = failure instanceof Error ? failure.message : '物料查询失败' }
}
async function saveMetadata() {
  if (!editable.value || !detail.value || busy.value || !metadata.name.trim()) return
  const row = detail.value.routing, attempt = sequence, revision = auth.revision
  busy.value = true; drawerError.value = ''
  try {
    const updated = await api.update(row.id, { name: metadata.name, description: metadata.description || null, revision: row.revision })
    if (!alive(attempt, revision)) return
    detail.value!.routing = updated; ElMessage.success('名称与说明已保存'); await load()
  } catch(failure) { if (alive(attempt, revision)) drawerError.value = failure instanceof Error ? failure.message : '保存失败' } finally { if (alive(attempt, revision)) busy.value = false }
}
async function saveContent() {
  if (!editable.value || !detail.value || busy.value) return
  const invalid = contentError(materialIds.value, detail.value.nodes, detail.value.edges)
  if (invalid) { drawerError.value = invalid; return }
  const row = detail.value.routing, attempt = sequence, revision = auth.revision
  busy.value = true; drawerError.value = ''
  try {
    const updated = await api.saveContent(row.id, { revision: row.revision, materialIds: materialIds.value, nodes: detail.value.nodes, edges: detail.value.edges })
    if (!alive(attempt, revision)) return
    accept(updated); ElMessage.success('产品与工艺拓扑已保存'); await load()
  } catch(failure) { if (alive(attempt, revision)) drawerError.value = failure instanceof Error ? failure.message : '保存失败' } finally { if (alive(attempt, revision)) busy.value = false }
}
function addNode() {
  if (!editable.value || !detail.value || detail.value.nodes.length >= 100) return
  let number = 10
  while (detail.value.nodes.some(node => node.nodeCode === 'N' + number)) number += 10
  detail.value.nodes.push({ nodeCode: 'N' + number, operationId: '', displayOrder: detail.value.nodes.length, isKey: false, description: null })
}
function renameNode(node: RoutingNode, code: string) {
  if (!editable.value || !detail.value) return
  for (const edge of detail.value.edges) { if (edge.fromNodeCode === node.nodeCode) edge.fromNodeCode = code; if (edge.toNodeCode === node.nodeCode) edge.toNodeCode = code }
  node.nodeCode = code
}
function removeNode(index: number) {
  if (!editable.value || !detail.value) return
  const code = detail.value.nodes[index]!.nodeCode
  detail.value.nodes.splice(index, 1)
  detail.value.edges = detail.value.edges.filter(edge => edge.fromNodeCode !== code && edge.toNodeCode !== code)
}
function keyNode(index: number, value: boolean) { if (detail.value && editable.value) detail.value.nodes.forEach((node, i) => { node.isKey = i === index && value }) }
function addConnection() {
  if (!editable.value || !detail.value || busy.value) return
  const edge = { fromNodeCode: connection.from, toNodeCode: connection.to }
  const invalid = contentError(materialIds.value, detail.value.nodes, [...detail.value.edges, edge])
  if (invalid) { drawerError.value = invalid; return }
  detail.value.edges.push(edge); connection.from = ''; connection.to = ''; drawerError.value = ''
}
function removeConnection(index: number) { if (editable.value && !busy.value && detail.value) detail.value.edges.splice(index, 1) }
async function create() {
  if (!can('create') || busy.value || !createForm.code.trim() || !createForm.name.trim()) return
  const attempt = sequence, revision = auth.revision; busy.value = true
  try {
    const row = await api.create({ ...createForm, description: createForm.description || null })
    if (!alive(attempt, revision)) return
    createDialog.value = false; await load(); if (can('query')) await open(row.id)
  } catch(failure) { if (alive(attempt, revision)) ElMessage.error(failure instanceof Error ? failure.message : '创建失败') } finally { if (alive(attempt, revision)) busy.value = false }
}
async function lifecycle(action: 'publish' | 'disable' | 'enable' | 'new-version') {
  const permission = action === 'new-version' ? 'version' : 'publish'
  if (!detail.value || busy.value || !can(permission)) return
  if (pendingContent.value || pendingMetadata.value) { drawerError.value = '请先保存当前修改，再执行版本操作'; return }
  if (action === 'publish') { const invalid = contentError(materialIds.value, detail.value.nodes, detail.value.edges, true); if (invalid) { drawerError.value = invalid; return } }
  const row = detail.value.routing, attempt = sequence, revision = auth.revision
  const prompts = { publish: '发布后此版本的产品、节点与连接将冻结。确认发布？', disable: '停用后此版本不再用于新执行选择，历史内容保留。确认停用？', enable: '确认重新启用此已发布版本？', 'new-version': '将复制当前内容到下一版本草稿，原版本保持冻结。确认创建？' }
  busy.value = true
  try {
    try { await ElMessageBox.confirm(prompts[action], '工艺路线', { type: 'warning' }) } catch { return }
    if (!alive(attempt, revision) || !can(permission)) return
    const value = await api.action(row.id, action, row.revision)
    if (!alive(attempt, revision)) return
    await load(); await open(value.id)
  } catch(failure) { if (alive(attempt, revision)) drawerError.value = failure instanceof Error ? failure.message : '操作失败' } finally { if (alive(attempt, revision)) busy.value = false }
}
async function copy() {
  if (!detail.value || pendingContent.value || pendingMetadata.value || busy.value || !can('copy') || !copyForm.code.trim() || !copyForm.name.trim()) return
  const row = detail.value.routing, attempt = sequence, revision = auth.revision; busy.value = true
  try {
    const copied = await api.copy(row.id, { ...copyForm, revision: row.revision })
    if (!alive(attempt, revision)) return
    copyDialog.value = false; await load(); await open(copied.id)
  } catch(failure) { if (alive(attempt, revision)) ElMessage.error(failure instanceof Error ? failure.message : '复制失败') } finally { if (alive(attempt, revision)) busy.value = false }
}
async function remove(row: RoutingVo) {
  if (!can('delete') || row.status !== 'DRAFT' || busy.value) return
  const attempt = sequence, revision = auth.revision; busy.value = true
  try {
    try { await ElMessageBox.confirm(`删除 ${row.code} v${row.version} 草稿及其节点和连接？`, '删除确认', { type: 'warning' }) } catch { return }
    if (!alive(attempt, revision) || !can('delete')) return
    await api.remove(row.id)
    if (!alive(attempt, revision)) return
    if (detail.value?.routing.id === row.id) drawer.value = false
    await load()
  } catch(failure) { if (alive(attempt, revision)) ElMessage.error(failure instanceof Error ? failure.message : '删除失败') } finally { if (alive(attempt, revision)) busy.value = false }
}
onMounted(load)
</script>
<template>
  <div class="app-container">
    <PageHeader title="工艺路线" description="按版本维护产品与工艺拓扑，发布后冻结内容" />
    <QueryForm v-show="showSearch" inline class="filter-panel" @submit="page = 1; load()">
      <el-form-item label="路线编码"><el-input v-model="filters.code" clearable maxlength="64" /></el-form-item>
      <el-form-item label="名称"><el-input v-model="filters.name" clearable maxlength="255" /></el-form-item>
      <el-form-item label="状态"><el-select v-model="filters.status" clearable placeholder="全部" style="width: 120px"><el-option v-for="(label, value) in labels" :key="value" :label="label" :value="value" /></el-select></el-form-item>
      <el-form-item><el-button type="primary" native-type="submit">查询</el-button><el-button native-type="button" @click="Object.assign(filters, { code: '', name: '', status: '' }); page = 1; load()">重置</el-button></el-form-item>
    </QueryForm>
    <div class="table-toolbar">
      <el-button v-if="can('create')" type="primary" :disabled="busy" @click="Object.assign(createForm, { code: '', name: '', description: '' }); createDialog = true">新增路线</el-button>
      <SyncButton permission="routing:sync" scope="factory" :run="sync" confirm-text="同步将更新草稿；已发布内容变化会创建新草稿，不自动发布。确认继续？" @completed="load" />
      <RightToolbar v-model:show-search="showSearch" @query-table="load" />
    </div>
    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" />
    <el-table v-loading="loading" :data="rows" empty-text="暂无工艺路线">
      <el-table-column prop="code" label="路线编码" min-width="180"><template #default="{ row }"><CodeText :value="row.code" /></template></el-table-column>
      <el-table-column prop="name" label="路线名称" min-width="200" show-overflow-tooltip />
      <el-table-column prop="version" label="版本" width="85"><template #default="{ row }">v{{ row.version }}</template></el-table-column>
      <el-table-column prop="status" label="状态" width="110"><template #default="{ row }"><StatusTag :label="labels[row.status as keyof typeof labels]" :tone="tone(row.status)" /></template></el-table-column>
      <el-table-column prop="description" label="说明" min-width="220" show-overflow-tooltip />
      <el-table-column prop="publishedAt" label="发布时间" min-width="180"><template #default="{ row }">{{ parseTime(row.publishedAt) || '—' }}</template></el-table-column>
      <el-table-column label="操作" width="180" fixed="right"><template #default="{ row }">
        <el-button v-if="can('query')" link type="primary" @click="open(row.id)">详情 / 工序</el-button>
        <el-button v-if="can('delete') && row.status === 'DRAFT'" link type="danger" :disabled="busy" @click="remove(row)">删除</el-button>
      </template></el-table-column>
    </el-table>
    <Pagination v-model:page="page" v-model:limit="pageSize" :total="total" @pagination="load" />
    <PageDrawer v-model="drawer" title="工艺路线详情" size="min(960px, 95vw)" :close-on-click-modal="true" :before-close="beforeCloseDetail" @close="closeDetail">
      <el-alert v-if="drawerError" :title="drawerError" type="error" show-icon :closable="false" />
      <div v-if="detail" v-loading="busy">
        <div class="table-toolbar"><CodeText :value="detail.routing.code" /><strong>v{{ detail.routing.version }}</strong><StatusTag :label="labels[detail.routing.status]" :tone="tone(detail.routing.status)" /></div>
        <el-alert v-if="detail.routing.status !== 'DRAFT'" title="此版本内容已冻结。修改工艺请创建新版本草稿。" type="info" :closable="false" />
        <el-form label-width="88px">
          <el-form-item label="名称"><el-input v-model="metadata.name" maxlength="255" :disabled="!editable || busy" /></el-form-item>
          <el-form-item label="说明"><el-input v-model="metadata.description" type="textarea" maxlength="1000" :disabled="!editable || busy" /></el-form-item>
          <el-form-item v-if="editable"><el-button :loading="busy" @click="saveMetadata">保存名称与说明</el-button></el-form-item>
          <el-form-item label="适用产品">
            <el-select v-if="editable" v-model="materialIds" multiple filterable remote :remote-method="searchMaterials" placeholder="搜索物料 / 产品编码或名称" style="width: 100%" :disabled="busy">
              <el-option v-for="option in materialOptions" :key="option.id" :value="option.id" :label="`${option.code} · ${option.name}`" />
            </el-select>
            <span v-else>{{ detail.products.map(productLabel).join('，') || '尚未关联产品' }}</span>
            <span class="secondary">显示当前物料的编码和名称。</span>
          </el-form-item>
        </el-form>
        <el-alert v-if="pendingContent || pendingMetadata" title="有未保存修改，请保存后再发布或复制。" type="warning" :closable="false" />
        <div class="table-toolbar"><el-button @click="graphDialog = true">查看拓扑</el-button><span class="secondary">{{ detail.nodes.length }} 个节点 · {{ detail.edges.length }} 条连接</span></div>
        <PageDialog v-model="graphDialog" title="工艺路线拓扑" width="min(1440px, 95vw)" append-to-body :close-on-click-modal="true" destroy-on-close>
          <RoutingGraphPreview style="--routing-graph-max-height: 70vh" :nodes="detail.nodes.map(node => ({ ...node, operationName: operationOptions.find(option => option.id === node.operationId)?.name ?? node.operationName }))" :edges="detail.edges" />
        </PageDialog>
        <div class="table-toolbar"><strong>工艺节点 · {{ detail.nodes.length }} 个</strong><el-button v-if="editable" :disabled="busy || detail.nodes.length >= 100" @click="addNode">新增节点</el-button></div>
        <el-table :data="detail.nodes" empty-text="尚未添加工艺节点">
          <el-table-column label="节点编码" min-width="110"><template #default="{ row }"><el-input v-if="editable" :model-value="row.nodeCode" maxlength="64" :disabled="busy" aria-label="节点编码" @update:model-value="(value: string) => renameNode(row, value)" /><CodeText v-else :value="row.nodeCode" /></template></el-table-column>
          <el-table-column label="工序" min-width="220"><template #default="{ row }">
            <el-select v-if="editable" v-model="row.operationId" filterable remote :remote-method="searchOperations" placeholder="搜索并选择工序" style="width: 100%" :disabled="busy">
              <el-option v-for="option in operationOptions" :key="option.id" :value="option.id" :label="`${option.code} · ${option.name}`" />
            </el-select><span v-else>{{ row.operationCode }} · {{ row.operationName }}</span><div v-if="row.operationDescription" class="secondary">{{ row.operationDescription }}</div>
          </template></el-table-column>
          <el-table-column label="关键点" width="75"><template #default="{ row, $index }"><el-checkbox :model-value="row.isKey" :disabled="!editable || busy" aria-label="关键工艺节点" @change="(value: string | number | boolean) => keyNode($index, Boolean(value))" /></template></el-table-column>
          <el-table-column label="节点说明" min-width="145"><template #default="{ row }"><el-input v-if="editable" v-model="row.description" maxlength="1000" :disabled="busy" /><span v-else>{{ row.description ?? '—' }}</span></template></el-table-column>
          <el-table-column label="显示排序" width="110"><template #default="{ row }"><el-input-number v-if="editable" v-model="row.displayOrder" :min="0" :controls="false" style="width: 80px" :disabled="busy" aria-label="显示排序" /><span v-else>{{ row.displayOrder }}</span></template></el-table-column>
          <el-table-column v-if="editable" label="操作" width="70"><template #default="{ $index }"><el-button link type="danger" :disabled="busy" @click="removeNode($index)">移除</el-button></template></el-table-column>
        </el-table>
        <div class="table-toolbar"><strong>节点连接 · {{ detail.edges.length }} 条</strong></div>
        <div v-if="editable" class="table-toolbar">
          <el-select v-model="connection.from" placeholder="起点节点" aria-label="起点节点" :disabled="busy" style="width: 180px"><el-option v-for="node in detail.nodes" :key="node.nodeCode" :label="node.nodeCode" :value="node.nodeCode" /></el-select>
          <span>→</span>
          <el-select v-model="connection.to" placeholder="终点节点" aria-label="终点节点" :disabled="busy" style="width: 180px"><el-option v-for="node in detail.nodes" :key="node.nodeCode" :label="node.nodeCode" :value="node.nodeCode" /></el-select>
          <el-button :disabled="busy || detail.edges.length >= 400 || !connection.from || !connection.to" @click="addConnection">新增连接</el-button>
        </div>
        <el-table :data="detail.edges" empty-text="单节点可不建连接；多节点发布前须连接孤立节点">
          <el-table-column prop="fromNodeCode" label="起点节点" /><el-table-column prop="toNodeCode" label="终点节点" />
          <el-table-column v-if="editable" label="操作" width="80"><template #default="{ $index }"><el-button link type="danger" :disabled="busy" @click="removeConnection($index)">移除连接</el-button></template></el-table-column>
        </el-table>
        <div class="table-toolbar">
          <el-button v-if="editable" type="primary" :loading="busy" @click="saveContent">保存产品与拓扑</el-button>
          <el-button v-if="can('publish') && detail.routing.status === 'DRAFT'" :disabled="busy" @click="lifecycle('publish')">发布版本</el-button>
          <el-button v-if="can('publish') && detail.routing.status === 'PUBLISHED'" :disabled="busy" @click="lifecycle('disable')">停用</el-button>
          <el-button v-if="can('publish') && detail.routing.status === 'DISABLED'" :disabled="busy" @click="lifecycle('enable')">重新启用</el-button>
          <el-button v-if="can('version') && detail.routing.status !== 'DRAFT'" :disabled="busy" @click="lifecycle('new-version')">创建新版本</el-button>
          <el-button v-if="can('copy')" :disabled="busy" @click="Object.assign(copyForm, { code: '', name: metadata.name }); copyDialog = true">复制路线</el-button>
          <el-button :disabled="busy" @click="open(detail.routing.id)">重新读取</el-button>
        </div>
      </div>
    </PageDrawer>
    <PageDialog v-model="createDialog" title="新增路线草稿" width="min(540px, 92vw)">
      <el-form label-width="85px"><el-form-item label="路线编码" required><el-input v-model="createForm.code" maxlength="64" /></el-form-item><el-form-item label="名称" required><el-input v-model="createForm.name" maxlength="255" /></el-form-item><el-form-item label="说明"><el-input v-model="createForm.description" type="textarea" maxlength="1000" /></el-form-item></el-form>
      <template #footer><el-button @click="createDialog = false">取消</el-button><el-button type="primary" :loading="busy" @click="create">创建草稿</el-button></template>
    </PageDialog>
    <PageDialog v-model="copyDialog" title="复制为新路线" width="min(540px, 92vw)">
      <el-form label-width="85px"><el-form-item label="新编码" required><el-input v-model="copyForm.code" maxlength="64" /></el-form-item><el-form-item label="名称" required><el-input v-model="copyForm.name" maxlength="255" /></el-form-item></el-form>
      <template #footer><el-button @click="copyDialog = false">取消</el-button><el-button type="primary" :loading="busy" @click="copy">创建 v1 草稿</el-button></template>
    </PageDialog>
  </div>
</template>
