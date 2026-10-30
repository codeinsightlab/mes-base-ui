<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { explodeBom, type Explosion, type ExplosionNode, type ExplosionQuery } from '@/api/basic/bomExplosion'
import { useAuth } from '@/stores/auth'
import { ApiError } from '@/lib/request'
import PageHeader from '@/components/PageHeader.vue'
import QueryForm from '@/components/QueryForm.vue'
import StatusTag from '@/components/StatusTag.vue'
import CodeText from '@/components/CodeText.vue'
import Pagination from '@/components/Pagination/index.vue'
import QuantityText from '@/components/business/production/QuantityText.vue'
import QuantityInput from '@/components/business/material/QuantityInput.vue'
import { normalizedQuantityInput } from '@/lib/production/quantityRules'
const auth = useAuth(), code = ref(''), quantity = ref('1'), quantityValid = ref(false)
const data = ref<Explosion | null>(null), material = ref<Explosion['material'] | null>(null), selectedId = ref<string | undefined>()
const loading = ref(false), error = ref(''), expanded = ref<string[]>([])
const versionsLoading = ref(false), versionsError = ref('')
const lastQuery = ref<ExplosionQuery | null>(null), failedVersionQuery = ref<ExplosionQuery | null>(null)
const allowed = computed(() => !!auth.factoryId && !auth.factorySwitching && auth.hasPermission('business:material:query', 'factory'))
const complete = computed(() => !!data.value?.complete && !data.value.selectionRequired && !!data.value.selectedVersion && data.value.problems.length === 0)
let generation = 0
function clearResult() {
  generation++
  data.value = null; loading.value = false; error.value = ''; expanded.value = []
  versionsLoading.value = false; versionsError.value = ''; lastQuery.value = null; failedVersionQuery.value = null
}
function clear() { clearResult(); material.value = null; selectedId.value = undefined; quantityValid.value = false }
watch(code, clear, { flush: 'sync' })
watch(quantity, clearResult, { flush: 'sync' })
watch(() => [auth.factoryId, auth.token, auth.userId, auth.revision, auth.factoryPermissions.join('|'), allowed.value], () => {
  clear(); code.value = ''; quantity.value = '1'
}, { flush: 'sync' })
onBeforeUnmount(clear)
async function fetchResult(query: ExplosionQuery, paging = false) {
  if (!allowed.value || loading.value || versionsLoading.value) return
  const ticket = ++generation
  if (paging) {
    versionsLoading.value = true; versionsError.value = ''; failedVersionQuery.value = query
  } else {
    data.value = null; error.value = ''; loading.value = true; expanded.value = []
    versionsError.value = ''; failedVersionQuery.value = null; lastQuery.value = query
  }
  try {
    const result = await explodeBom(query)
    if (ticket !== generation || !allowed.value) return
    if (result.material.code !== code.value) throw Error('返回物料编码与查询不一致，请重新查询')
    material.value = result.material; data.value = result; selectedId.value = result.selectedVersion?.id
    if (!paging) expanded.value = result.items.map(node => node.path)
    failedVersionQuery.value = null
  } catch(reason) {
    if (ticket !== generation) return
    const message = reason instanceof Error ? reason.message : '读取失败，请重试'
    if (reason instanceof ApiError && (reason.status === 401 || reason.status === 403)) {
      clear(); error.value = 'BOM展开查询失败：' + message
      return
    }
    if (paging) versionsError.value = 'BOM版本候选读取失败：' + message
    else error.value = 'BOM展开查询失败：' + message
  } finally {
    if (ticket === generation) { loading.value = false; versionsLoading.value = false }
  }
}
function search() {
  if (!allowed.value || loading.value || versionsLoading.value) return
  clear(); quantity.value = '1'
  if (!code.value || code.value.length > 64) { error.value = '请输入不超过64字符的完整物料编码'; return }
  void fetchResult({ materialCode: code.value, quantity: '1', versionOffset: 0, versionLimit: 20 })
}
function recalculate() {
  if (!material.value || !quantityValid.value) { error.value = '请填写符合基本单位规则的正数量'; return }
  void fetchResult({ materialCode: code.value, quantity: normalizedQuantityInput(quantity.value),
    ...(selectedId.value ? { bomId: selectedId.value } : {}), versionOffset: 0, versionLimit: 20 })
}
function chooseVersion(bomId: string) {
  if (!data.value) return
  // Version browsing reuses the last server-accepted quantity; it does not require unit-rule edit permission.
  void fetchResult({ materialCode: code.value, quantity: data.value.outputQty, bomId, versionOffset: 0, versionLimit: 20 })
}
function pageVersions(page: { page: number; limit: number }) {
  if (!data.value) return
  void fetchResult({ materialCode: code.value, quantity: data.value.outputQty,
    ...(data.value.selectedVersion ? { bomId: data.value.selectedVersion.id } : {}),
    versionOffset: (page.page - 1) * page.limit, versionLimit: page.limit }, true)
}
function retryQuery() { if (lastQuery.value) void fetchResult(lastQuery.value) }
function retryVersions() { if (failedVersionQuery.value) void fetchResult(failedVersionQuery.value, true) }
function toggleRow(row: ExplosionNode, opened: boolean) {
  expanded.value = opened ? [...new Set([...expanded.value, row.path])] : expanded.value.filter(path => path !== row.path)
}
function expandAll() {
  const queue: ExplosionNode[] = [...(data.value?.items ?? [])], paths: string[] = []
  while (queue.length) { const node = queue.pop()!; if (node.children.length) { paths.push(node.path); queue.push(...node.children) } }
  expanded.value = paths
}
function nodeState(row: ExplosionNode) {
  if (data.value?.problems.some(problem => problem.path === '' || problem.path === row.path || problem.path.startsWith(row.path + '/') || row.path.startsWith(problem.path + '/'))) return '展开受阻'
  return row.leaf ? '叶项' : row.children.length ? '子BOM' : '待确认'
}
</script>
<template>
  <div class="app-container bom-explosion-page">
    <PageHeader title="物料BOM展开" description="查询物料的多层组成和叶料需求" />
    <QueryForm class="filter-panel" inline @submit="search">
      <el-form-item label="物料编码"><el-input v-model="code" aria-label="完整物料编码" maxlength="64" clearable placeholder="输入完整物料编码" /></el-form-item>
      <el-button native-type="submit" type="primary" :disabled="!allowed || loading || versionsLoading" :loading="loading">查询物料</el-button>
    </QueryForm>
    <p class="bom-hint">按所选BOM逐层计算结构需求；叶项表示未指定子BOM，结果不代表实际库存或生产进度。</p>
    <el-alert v-if="!allowed" title="请选择可用工厂，并确认拥有物料查询权限。" type="warning" :closable="false" />
    <el-alert v-if="error" :title="error" type="error" :closable="false">
      <el-button v-if="lastQuery" :disabled="!allowed || loading" @click="retryQuery">重试BOM查询</el-button>
    </el-alert>
    <section v-if="material" class="panel bom-context" aria-label="当前物料与数量">
      <div class="bom-context-main"><span class="secondary">当前物料</span><strong>{{ material.code }} · {{ material.name }}</strong></div>
      <div class="bom-quantity"><label for="bom-explosion-output-quantity">预计产出数量</label>
        <QuantityInput id="bom-explosion-output-quantity" v-model="quantity" class="bom-quantity-input" :material-id="material.id" required positive show-unit aria-label="预计产出数量" :disabled="loading || versionsLoading" @validity="quantityValid=$event" />
        <el-button :disabled="!allowed || loading || versionsLoading || !quantityValid" :loading="loading" @click="recalculate">按当前数量展开</el-button>
      </div>
      <div v-if="data" class="bom-context-result">
        <StatusTag :label="complete ? 'BOM展开完成' : data.selectionRequired ? '待选择BOM版本' : 'BOM展开受阻'" :tone="complete ? 'success' : 'warning'" />
        <span>本次产出：<QuantityText :value="data.outputQty" /></span>
        <span v-if="data.selectedVersion">BOM：{{ data.selectedVersion.code }} · {{ data.selectedVersion.version }} · {{ data.selectedVersion.status }} · ID {{ data.selectedVersion.id }}；基数 <QuantityText :value="data.selectedVersion.baseQty" /></span>
      </div>
    </section>
    <div v-if="loading" role="status">正在读取BOM版本及递归需求…</div>
    <template v-if="data">
      <el-alert v-if="!complete" title="尚未完整展开。请处理下方版本选择或阻断原因；已解析分支和叶项汇总均不能当作完整需求。" type="warning" :closable="false" />
      <section v-if="data.selectionRequired || data.versions.total > 1 || versionsError" class="panel bom-explosion-section" aria-label="BOM版本候选">
        <div class="table-toolbar"><strong>选择根BOM版本</strong><span class="secondary">请选择需要展开的版本。</span></div>
        <el-alert v-if="versionsError" :title="versionsError" type="error" :closable="false">
          <el-button :disabled="!allowed || versionsLoading" @click="retryVersions">重试版本候选</el-button>
        </el-alert>
        <div v-if="versionsLoading" role="status">正在读取版本候选…</div>
        <el-table :data="data.versions.items" row-key="id" aria-label="BOM版本列表">
          <el-table-column prop="id" label="版本ID" min-width="180" /><el-table-column prop="code" label="BOM编码" min-width="160" /><el-table-column prop="version" label="版本" min-width="100" /><el-table-column label="状态" min-width="100"><template #default="{ row }"><StatusTag :label="row.status" /></template></el-table-column>
          <el-table-column label="父件基数"><template #default="{ row }"><QuantityText :value="row.baseQty" /></template></el-table-column>
          <el-table-column label="操作" width="160"><template #default="{ row }"><el-button :disabled="!allowed || loading || versionsLoading" link type="primary" @click="chooseVersion(row.id)">以此版本展开</el-button></template></el-table-column>
        </el-table>
        <Pagination
          :total="data.versions.total"
          :page="Math.floor(data.versions.offset/data.versions.limit)+1"
          :limit="data.versions.limit"
          :page-sizes="[20]"
          layout="total, prev, pager, next"
          :auto-scroll="false"
          :disabled="!allowed || loading || versionsLoading"
          aria-label="BOM版本分页"
          @pagination="pageVersions"
        />
      </section>
      <section v-if="data.problems.length" class="panel bom-explosion-section" aria-label="BOM展开阻断">
        <div class="table-toolbar"><strong>展开阻断原因</strong></div>
        <el-table :data="data.problems"><el-table-column label="路径" min-width="180"><template #default="{ row }">{{ row.path || '根节点' }}</template></el-table-column><el-table-column prop="bomId" label="BOM ID" min-width="160" /><el-table-column prop="errorCode" label="原因编码" min-width="220" /><el-table-column prop="message" label="原因" min-width="300" /></el-table>
      </section>
      <section v-if="data.items.length" class="panel bom-explosion-section" aria-label="BOM逐层需求">
        <div class="table-toolbar bom-section-heading"><div><strong>逐层需求</strong><div class="secondary">查看各层组件用量和累计需求</div></div><div><el-button @click="expandAll">展开全部层级</el-button><el-button @click="expanded=[]">收起层级</el-button></div></div>
        <el-table :data="data.items" row-key="path" :expand-row-keys="expanded" :tree-props="{children:'children'}" border @expand-change="toggleRow">
          <el-table-column label="物料编码 / 名称" min-width="220" class-name="bom-tree-material"><template #default="{ row }"><div class="bom-material-info"><CodeText :value="row.code" /><div class="bom-material-name">{{ row.name }}</div></div></template></el-table-column>
          <el-table-column prop="level" label="层级" width="60" /><el-table-column prop="path" label="路径" min-width="115" />
          <el-table-column label="组件用量" min-width="100"><template #default="{ row }"><QuantityText :value="row.componentQty" /></template></el-table-column>
          <el-table-column label="父件基数" min-width="100"><template #default="{ row }"><QuantityText :value="row.baseQty" /></template></el-table-column>
          <el-table-column label="累计需求" min-width="120"><template #default="{ row }"><QuantityText :value="row.quantity" /> <span v-if="row.quantity == null">待确认</span> {{ row.unitName }}</template></el-table-column>
          <el-table-column prop="parentBomVersion" label="父BOM版本" min-width="105" /><el-table-column label="节点状态" min-width="100"><template #default="{ row }">{{ nodeState(row) }}</template></el-table-column>
        </el-table>
      </section>
      <section class="panel bom-explosion-section" aria-label="叶项需求汇总">
        <div class="table-toolbar bom-section-heading"><div><strong>{{ complete ? '叶项需求汇总' : '已解析叶项需求（不完整）' }}</strong><div class="secondary">相同物料合并汇总，保留来源路径</div></div></div>
        <el-table :data="data.totals" row-key="materialId" :empty-text="complete ? '没有叶项需求' : '尚无可确认的叶项汇总'">
          <el-table-column prop="code" label="物料编码" min-width="160" /><el-table-column prop="name" label="名称" min-width="160" />
          <el-table-column label="汇总需求" min-width="180"><template #default="{ row }"><QuantityText :value="row.quantity" /> {{ row.unitName }}</template></el-table-column>
          <el-table-column label="来源路径" min-width="300"><template #default="{ row }"><div v-for="path in row.paths" :key="path">{{ path }}</div></template></el-table-column>
        </el-table>
      </section>
    </template>
    <el-empty v-else-if="!loading && !error" description="输入完整物料编码开始查询" />
  </div>
</template>

<style scoped>
.bom-explosion-section { margin-top: var(--ui-space-4); padding: var(--ui-space-4); min-width: 0; }
.bom-explosion-page > .el-alert { margin-bottom: var(--ui-space-3); }
.bom-hint { margin: var(--ui-space-3) 0; color: var(--el-text-color-secondary); font-size: 13px; }
.bom-context { display: flex; align-items: center; flex-wrap: wrap; gap: 12px 24px; padding: var(--ui-space-4); margin-bottom: var(--ui-space-4); }
.bom-context-main { display: flex; flex-direction: column; gap: 4px; flex: 1 1 280px; min-width: 0; }
.bom-quantity { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.bom-quantity-input { width: 200px; }
.bom-context-result { flex: 1 0 100%; display: flex; align-items: center; flex-wrap: wrap; gap: 8px 16px; padding-top: 12px; border-top: 1px solid var(--el-border-color-lighter); }
.bom-section-heading { justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.bom-section-heading .secondary { margin-top: 4px; font-size: 13px; }
.bom-explosion-page :deep(.bom-tree-material .cell) { display: flex; align-items: flex-start; }
.bom-explosion-page :deep(.bom-tree-material .el-table__indent),
.bom-explosion-page :deep(.bom-tree-material .el-table__placeholder),
.bom-explosion-page :deep(.bom-tree-material .el-table__expand-icon) { flex: none; }
.bom-material-info { display: flex; flex: 1; flex-direction: column; gap: 2px; min-width: 0; }
.bom-material-name { font-weight: 500; line-height: 1.5; overflow-wrap: anywhere; }
@media (max-width: 640px) { .bom-quantity-input { width: 100%; } .bom-quantity { width: 100%; } }
</style>
