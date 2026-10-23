<script setup lang="ts">
import { usePageMessageBox } from '@/lib/pageMessageBox'

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import OperatorConfiguration from './OperatorConfiguration.vue'
import CrudPage from '@/components/CrudPage.vue'
import { useAuth } from '@/stores/auth'
import { api as capabilityApi } from '@/api/production/mesOperationUser'
import { api as assignmentApi } from '@/api/production/mesExecutionAssignment'
import { operatorConfiguration, type UserOption, type AssignmentNode } from '@/api/production/operatorConfiguration'
import type { Field } from '@/lib/crud'
const ElMessageBox = usePageMessageBox()

const props = defineProps<{ operationId?: string; executionId?: string; contextLabel?: string; triggerLabel?: string }>()
const emit = defineEmits<{ changed: []; pending: [value: boolean]; busy: [value: boolean] }>()
const auth = useAuth(), visible = ref(false), loading = ref(false), error = ref(''), keyword = ref('')
const selected = ref<string[]>([]), options = ref<UserOption[]>([]), nodes = ref<AssignmentNode[]>([]), nodeId = ref(''), status = ref('')
const searching = ref(false), userLabels = ref<Record<string, UserOption>>({})
const retainedOptions = computed(() => selected.value.map(id => userLabels.value[id]).filter((u): u is UserOption => Boolean(u) && !options.value.some(option => option.id === u.id)))
function userLabel(id: unknown) { const u = userLabels.value[String(id)]; return u ? `${u.name}（${u.id}）` : String(id) }
const offset = ref(0), hasMore = ref(false), refresh = ref(0)
let sequence = 0, optionSequence = 0
const assignment = computed(() => Boolean(props.executionId))
const permission = computed(() => assignment.value ? 'business:mes:execution:assignment' : 'business:mes:operation:user')
const canRead = computed(() => auth.hasPermission(permission.value + ':list', 'factory'))
const canCreate = computed(() => auth.hasPermission(permission.value + ':create', 'factory'))
const mutable = computed(() => !assignment.value || ['READY', 'RUNNING'].includes(status.value))
const node = computed(() => nodes.value.find(n => n.id === nodeId.value))
const fixed = computed(() => { const value: Record<string, string> = {}; if (assignment.value) { value.executionId = props.executionId!; value.routingNodeId = nodeId.value } else value.operationId = props.operationId!; return value })
const fields = computed<Field[]>(() => [
 { key: 'id', label: '关系编号', kind: 'text', hidden: true, readonly: true },
 { key: 'userId', label: '操作人员', kind: 'select', options: options.value.map(u => ({ label: `${u.name}（${u.id}）`, value: u.id })) },
 { key: 'remark', label: '备注', kind: 'text' },
 ...(assignment.value ? [{ key: 'assignedAt', label: '派工时间', kind: 'datetime', readonly: true } as Field] : [])
])
function clear() { sequence++; optionSequence++; searching.value = false; userLabels.value = {}; visible.value = false; loading.value = false; error.value = ''; keyword.value = ''; selected.value = []; options.value = []; nodes.value = []; nodeId.value = ''; status.value = ''; offset.value = 0; hasMore.value = false }
watch(() => [props.operationId, props.executionId, auth.factoryId, auth.revision, auth.factoryPermissions.join('|')], clear, { flush: 'sync' })
onBeforeUnmount(clear)
async function loadOptions(more = false) {
 if (!visible.value || !canRead.value || assignment.value && !node.value) return
 const ticket = ++optionSequence; searching.value = true; error.value = ''
 if (!more) { offset.value = 0; options.value = []; hasMore.value = false }
 try {
  if (assignment.value) {
   const page = await operatorConfiguration.candidates(node.value!.operationId, offset.value)
   if (ticket !== optionSequence) return
   options.value = [...options.value, ...page.items]; offset.value = page.nextOffset; hasMore.value = page.hasMore
  } else {
   const page = await operatorConfiguration.users(keyword.value, offset.value)
   if (ticket !== optionSequence) return
   options.value = [...options.value, ...page.items]; offset.value += page.items.length; hasMore.value = offset.value < page.total
  }
  userLabels.value = { ...userLabels.value, ...Object.fromEntries(options.value.map(u => [u.id, u])) }
 } catch (e) { if (ticket === optionSequence) error.value = e instanceof Error ? e.message : '人员读取失败' }
 finally { if (ticket === optionSequence) searching.value = false }
}
function searchPeople(value: string) {
 if (assignment.value || !visible.value || loading.value) return
 keyword.value = value.trim().slice(0, 100)
 void loadOptions()
}
async function open() {
 if (!canRead.value) return
 clear(); visible.value = true
 if (assignment.value) {
  const ticket = ++sequence; loading.value = true
  try { const result = await operatorConfiguration.nodes(props.executionId!); if (ticket !== sequence) return; nodes.value = result.nodes; status.value = result.status }
  catch(e) { if (ticket === sequence) error.value = e instanceof Error ? e.message : '节点读取失败' }
  finally { if (ticket === sequence) loading.value = false }
 } else await loadOptions()
}
function nodeLabel(n: AssignmentNode) { return `${n.code} · ${n.name?.trim() || '工序名称未记录'}（节点 ${n.id}）` }
function changeNode() { selected.value = []; options.value = []; refresh.value++; void loadOptions() }
async function save() {
 if (!canCreate.value || !mutable.value || !selected.value.length || selected.value.length > 100 || loading.value) return
 const ticket = ++sequence; loading.value = true; error.value = ''
 try {
  if (assignment.value) await assignmentApi.create({ executionId: props.executionId, routingNodeId: nodeId.value, userId: selected.value[0], remark: null })
  else await operatorConfiguration.bind(props.operationId!, selected.value)
  if (ticket === sequence) { selected.value = []; refresh.value++; ElMessage.success(assignment.value ? '节点派工已保存' : '工序能力已保存'); emit('changed') }
 } catch(e) { if (ticket === sequence) error.value = e instanceof Error ? e.message : '保存失败' }
 finally { if (ticket === sequence) loading.value = false }
}
async function beforeClose(done: () => void) {
 const ticket = sequence
 if (selected.value.length) {
  try { await ElMessageBox.confirm('尚有未保存的人员选择，是否放弃？', '关闭配置', { type: 'warning' }) } catch { return }
 }
 if (ticket !== sequence) return
 clear(); done()
}

watch(() => selected.value.length > 0, value => emit('pending', value), { flush: 'sync' })
watch(loading, value => emit('busy', value), { flush: 'sync' })
onMounted(open)
defineExpose({ beforeClose })
</script>
<template>
  <div class="operator-configuration">
   <p class="operator-context">{{ assignment ? '生产执行：' : '当前工序：' }}{{ contextLabel || (assignment ? executionId : operationId) }}</p>
   <el-alert v-if="error" :title="error" type="error" :closable="false" />
   <p class="secondary">{{ assignment ? '派工可选；有名单时，报工人须同时在名单内且具备工序能力。' : '仅展示拥有当前工厂业务授权的有效用户。取消能力会保留已有派工，但后续报工将被拒绝。' }}</p>
   <div v-if="assignment" class="operator-node">
    <label :for="`assignment-node-${executionId}`">工艺节点</label>
    <el-select :id="`assignment-node-${executionId}`" v-model="nodeId" aria-label="派工节点" placeholder="选择本次工艺版本的节点" :disabled="loading" @change="changeNode">
     <el-option v-for="n in nodes" :key="n.id" :value="n.id" :label="nodeLabel(n)" />
    </el-select>
   </div>
   <section v-if="visible && (!assignment || nodeId)">
    <p v-if="!mutable" role="status">执行已结束或取消，禁止新增派工；仍可取消名单。</p>
    <div v-if="canCreate && mutable" class="operator-controls" role="group" :aria-label="assignment ? '增加节点派工' : '增加工序能力'">
     <div class="operator-controls__row">
      <el-select v-model="selected" class="operator-controls__people" multiple filterable :remote="!assignment" :remote-method="searchPeople" :debounce="300" :reserve-keyword="false" :loading="searching" loading-text="正在检索人员…" no-data-text="暂无匹配人员" no-match-text="暂无匹配人员" :multiple-limit="assignment ? 1 : 100" aria-label="选择操作人员" :placeholder="assignment ? '选择具备该工序能力的人员' : '输入昵称检索，可多选'" :disabled="loading">
       <el-option-group v-if="retainedOptions.length" label="已选择">
        <el-option v-for="u in retainedOptions" :key="u.id" :value="u.id" :label="`${u.name}（${u.id}）`" />
       </el-option-group>
       <el-option-group v-if="options.length" :label="retainedOptions.length ? '匹配人员' : '候选人员'">
        <el-option v-for="u in options" :key="u.id" :value="u.id" :label="`${u.name}（${u.id}）`" />
       </el-option-group>
       <template v-if="!assignment" #footer>
        <el-button v-if="error" text type="primary" :disabled="searching" @click="loadOptions()">重新检索</el-button>
        <el-button v-else-if="hasMore" text type="primary" :loading="searching" @click="loadOptions(true)">加载更多匹配人员</el-button>
        <span v-else class="secondary">{{ options.length ? '可连续检索并选择多人' : '换个昵称关键词试试' }}</span>
       </template>
      </el-select>
      <el-button v-if="assignment && hasMore" :disabled="loading || searching" @click="loadOptions(true)">更多人员</el-button>
      <el-button type="primary" :loading="loading" :disabled="loading || !selected.length" @click="save">{{ assignment ? '增加派工' : '批量增加能力' }}</el-button>
     </div>
     <p v-if="!loading && !searching && !options.length && !error" class="secondary" role="status">{{ assignment ? (hasMore ? '当前批次暂无可选人员，请加载更多人员。' : '该工序暂无可派工人员，请配置此工序人员能力，并核对当前工厂授权。') : '未找到匹配人员，请换个昵称关键词。' }}</p>
    </div>
    <div v-if="assignment && node" class="operator-controls__row">
     <OperatorConfiguration :key="node.id" :operation-id="node.operationId" :context-label="`${node.name?.trim() || '工序'}（工序 ${node.operationId}，节点 ${node.code}）`" trigger-label="配置此工序人员能力" @changed="loadOptions()" />
     <el-button :disabled="loading" @click="loadOptions()">刷新可派工人员</el-button>
    </div>
    <p v-if="!assignment && canCreate" class="secondary">{{ selected.length ? `已选择 ${selected.length} 人，点击“批量增加能力”保存。` : '输入昵称后选择人员，可连续检索多选，最多100人。' }}</p>
    <p v-if="assignment" class="secondary">同一节点可逐次增加多人；同工序的不同节点分别维护派工名单。</p>
    <CrudPage :key="`${refresh}:${nodeId}`" embedded managed-editing :fixed-values="fixed" :api="assignment ? assignmentApi : capabilityApi" :fields="fields" :permission="permission" permission-scope="factory" list-action="list" detail-action="query" :title="assignment ? '已派工人员' : '已有能力人员'">
     <template #cell-userId="{ row }">{{ userLabel(row.userId) }}</template>
     <template #toolbar><span class="secondary">{{ assignment ? '当前节点已派工人员' : '已配置能力人员' }}</span></template>
    </CrudPage>
   </section>
  </div>
</template>
<style scoped>
.operator-configuration { min-width: 0; }
/* Element Plus wrappers retain the focus ring; avoid a second outline on their inner input. */
.operator-configuration :deep(.el-select__input:focus-visible),
.operator-configuration :deep(.el-input__inner:focus-visible) { outline: none; }
.operator-configuration :deep(.el-table__empty-block) { min-height: calc(var(--ui-space-6) * 5); }
.operator-context { margin: 0 0 var(--ui-space-3); font-weight: 600; }
.operator-node { display: flex; align-items: center; flex-wrap: wrap; gap: var(--ui-space-2); margin-bottom: var(--ui-space-3); }
.operator-node > .el-select { flex: 1 1 240px; min-width: 0; width: auto; }
.operator-controls { display: grid; gap: var(--ui-space-2); margin-bottom: var(--ui-space-3); }
.operator-controls__row { display: flex; align-items: center; flex-wrap: wrap; gap: var(--ui-space-2); min-width: 0; }
.operator-controls__row > .operator-controls__people { flex: 1 1 280px; min-width: 0; width: auto; }
.operator-controls__row > .el-button + .el-button { margin-left: 0; }
.operator-controls p { margin: 0; }
</style>
