<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { structure, type BomGraph, type BomNode } from '@/api/basic/materialBom'
import { api as workorders, type RoutingOption } from '@/api/production/workorder'
import { useAuth } from '@/stores/auth'
import CodeText from '@/components/CodeText.vue'
import QuantityText from './QuantityText.vue'

const props = defineProps<{
  bomId: string | null
  productId: string
  productCode: string
  productName: string
  plannedQty: string
}>()
const auth = useAuth()
const allowed = computed(() => !!auth.factoryId && !auth.factorySwitching && auth.hasPermission('business:material:query', 'factory') && auth.hasPermission('workorder:query', 'factory'))
const graph = ref<BomGraph | null>(null), loading = ref(false), error = ref('')
type RouteRead = { loading: boolean; options: RoutingOption[] | null; error: string }
const routes = ref<Record<string, RouteRead>>({})
let generation = 0
const rows = computed<BomNode[]>(() => graph.value ? [{
  path: '$root', materialId: props.productId, code: props.productCode, name: props.productName,
  quantity: graph.value.outputQty, unitName: '产品基本单位', childBomId: graph.value.bomId, children: graph.value.items
}] : [])
function clear() { generation++; graph.value = null; routes.value = {}; loading.value = false; error.value = '' }
async function load() {
  clear()
  if (!allowed.value || !props.bomId) return
  const ticket = generation, bomId = props.bomId
  loading.value = true
  try {
    const value = await structure(bomId, props.plannedQty)
    if (ticket !== generation) return
    if (value.bomId !== bomId) throw Error('BOM结构响应与当前版本不一致，请刷新核对')
    graph.value = value
  } catch(e) {
    if (ticket === generation) error.value = e instanceof Error ? e.message : '多层BOM需求读取失败'
  } finally { if (ticket === generation) loading.value = false }
}
async function readRoutes(materialId: string) {
  if (!allowed.value || !graph.value || routes.value[materialId]?.loading) return
  const ticket = generation
  routes.value[materialId] = { loading: true, options: null, error: '' }
  try {
    // Explicitly read one selected product; expanding the tree never starts per-node I/O.
    const options = await workorders.routings(materialId)
    if (ticket !== generation) return
    routes.value[materialId] = { loading: false, options, error: '' }
  } catch(e) {
    if (ticket === generation) routes.value[materialId] = { loading: false, options: null, error: e instanceof Error ? e.message : '工艺读取失败' }
  }
}
function pathLabel(materialId: string) {
  const state = routes.value[materialId]
  if (state?.loading) return '正在核对工艺'
  if (state?.error) return '工艺读取失败，路径待确认'
  if (!state?.options) return '工艺 / 委外路径待确认'
  return state.options.length ? '有已发布工艺：制造 → 报工 → 正式入库' : '无已发布适用工艺：单阶段工单可跳过工序报工'
}
function blockedReason(row: BomNode) {
  if (row.children.length) return '多层需求仅供辅助核对，不要求子件重新制造；当前阶段按直接材料及可用库存领用'
  return '本视图未读取实时可用库存；可领数量以MES扫码计算及提交复验为准'
}
watch(() => [props.bomId, props.productId, props.productCode, props.productName, props.plannedQty, auth.factoryId, auth.revision, auth.factoryPermissions.join('|'), allowed.value], () => { void load() }, { immediate: true, flush: 'sync' })
onBeforeUnmount(clear)
</script>
<template>
  <section aria-label="多层BOM需求与闭环核对">
    <div class="table-toolbar">
      <strong>多层BOM结构</strong>
      <el-button :disabled="!allowed || !bomId || loading" :loading="loading" @click="load">刷新多层需求</el-button>
    </div>
    <p class="secondary">仅供分析，不计算实时库存或完成情况，不影响当前工单领料。子件无需重新制造；入库量与缺口待确认。</p>
    <el-alert v-if="!allowed" title="当前账号或工厂上下文不允许读取BOM需求与工艺，请核对物料查询及工单查询权限。" type="info" :closable="false" />
    <el-alert v-else-if="error" :title="error" type="error" :closable="false"><el-button @click="load">重试多层需求</el-button></el-alert>
    <el-empty v-else-if="!bomId" description="保存工单BOM用料后，可按当前计划展开到叶项" />
    <template v-if="graph">
      <p class="secondary">需求依据：已保存BOM {{ graph.bomId }} × 当前计划 <QuantityText :value="graph.outputQty" />。叶项表示未关联子BOM，不代表已有库存或没有工艺。</p>
      <el-table :data="rows" row-key="path" :tree-props="{ children: 'children' }" :expand-row-keys="['$root']" border>
        <el-table-column label="物料 / 层级" min-width="250">
          <template #default="{ row }"><CodeText :value="row.code" /><div class="secondary">{{ row.name }} · {{ row.path === '$root' ? '顶层' : row.childBomId ? '子BOM' : '叶项' }}</div></template>
        </el-table-column>
        <el-table-column label="节点需求量" min-width="140" align="right"><template #default="{ row }"><QuantityText :value="row.quantity" /><div class="secondary">{{ row.unitName }}</div></template></el-table-column>
        <el-table-column label="正式净入库量" min-width="130"><template #default><span>待确认</span></template></el-table-column>
        <el-table-column label="需求缺口" min-width="120"><template #default><span>待确认</span></template></el-table-column>
        <el-table-column label="工艺 / 委外路径" min-width="260">
          <template #default="{ row }">
            <div>{{ pathLabel(row.materialId) }}</div>
            <div v-for="option in routes[row.materialId]?.options" :key="option.id" class="secondary">{{ option.code }} / V{{ option.version }} · {{ option.name }}（候选工艺）</div>
            <el-alert v-if="routes[row.materialId]?.error" :title="routes[row.materialId]!.error" type="error" :closable="false" />
            <el-button link :loading="routes[row.materialId]?.loading" @click="readRoutes(row.materialId)">{{ routes[row.materialId]?.error ? '重试工艺核对' : '核对可用工艺' }}</el-button>
          </template>
        </el-table-column>
        <el-table-column label="核对说明" min-width="270"><template #default="{ row }">{{ blockedReason(row) }}</template></el-table-column>
      </el-table>
    </template>
  </section>
</template>
