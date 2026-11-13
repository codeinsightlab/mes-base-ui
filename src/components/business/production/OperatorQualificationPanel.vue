<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import SearchSelect from '@/components/SearchSelect.vue'
import Pagination from '@/components/Pagination/index.vue'
import { useRemoteOptions } from '@/composables/useRemoteOptions'
import { usePageMessageBox } from '@/lib/pageMessageBox'
import { useAuth } from '@/stores/auth'
import { operatorConfiguration, type UserOption } from '@/api/production/operatorConfiguration'
import { operatorQualification, type OperatorQualification } from '@/api/production/operatorQualification'
const emit = defineEmits<{ changed: [] }>()
const auth = useAuth(), messageBox = usePageMessageBox()
const userId = ref<string | null>(null), userNumber = ref(''), currentUser = ref<UserOption | null>(null)
const summary = ref<OperatorQualification | null>(null), loading = ref(false), saving = ref(false), error = ref(''), page = ref(1)
const prefix = 'business:mes:operation:user:'
const canRead = computed(() => !!auth.factoryId && !auth.factorySwitching && auth.hasPermission(prefix + 'list', 'factory'))
const canGrant = computed(() => auth.hasPermission(prefix + 'create', 'factory'))
const canRevoke = computed(() => auth.hasPermission(prefix + 'delete', 'factory'))
const mode = computed(() => !summary.value?.validUser ? '无资格（账号失效或无当前工厂业务授权）' : summary.value.allOperations ? '全部工序' : summary.value.enabledExplicitTotal ? '指定工序' : '无资格')
const selectedOption = computed(() => currentUser.value ? { value: currentUser.value.id, label: currentUser.value.name } : userId.value ? { value: userId.value, label: '用户 ' + userId.value } : null)
const remote = useRemoteOptions<UserOption>({
  modelValue: () => userId.value, enabled: () => canRead.value, disabled: () => saving.value,
  search: async({ keyword, offset, limit }) => {
    const result = await operatorConfiguration.users(keyword, offset, limit)
    return { items: result.items.map(u => ({ value: u.id, label: `${u.name}（${u.id}）`, data: u })) }
  }
})
let sequence = 0

function clear() {
  sequence++
  userId.value = null
  userNumber.value = ''
  currentUser.value = null
  summary.value = null
  loading.value = saving.value = false
  error.value = ''
  page.value = 1
  remote.reset()
}

watch(() => [auth.factoryId, auth.revision, auth.factoryPermissions.join('|'), canRead.value], clear, { flush: 'sync' })
onBeforeUnmount(clear)

async function read() {
  if (!canRead.value || !userId.value) return
  const ticket = ++sequence, id = userId.value
  loading.value = true
  error.value = ''
  summary.value = null
  try {
    const result = await operatorQualification.summary(id, (page.value - 1) * 20)
    if (ticket === sequence) summary.value = result
  } catch (e) {
    if (ticket === sequence) error.value = e instanceof Error ? e.message : '资格读取失败'
  } finally {
    if (ticket === sequence) loading.value = false
  }
}

function selectUser(id: string | null) {
  sequence++
  userId.value = id
  userNumber.value = id ?? ''
  summary.value = null
  loading.value = false
  error.value = ''
  page.value = 1
  currentUser.value = remote.items.value.find(u => u.value === id)?.data ?? null
  if (id) void read()
}

function loadNumber() {
  if (!/^[1-9][0-9]*$/.test(userNumber.value)) {
    error.value = '请输入有效的用户编号'
    return
  }
  selectUser(userNumber.value)
}

function switchAll(value: string | number | boolean) {
  void changeAll(Boolean(value))
}

async function changeAll(all: boolean) {
  const state = summary.value
  if (!state || saving.value || loading.value || !canRead.value || (all ? !canGrant.value || !state.validUser : !canRevoke.value)) return
  const ticket = sequence, id = state.userId, revision = auth.revision
  saving.value = true
  error.value = ''
  const current = () => ticket === sequence && revision === auth.revision && canRead.value && userId.value === id
  try {
    if (!all) await messageBox.confirm('关闭后将恢复已配置的指定工序资格。原有指定关系会保留。', '关闭全部工序资格', { type: 'warning' })
    if (!current()) return
    if (all) await operatorQualification.grant(id, state.revision)
    else await operatorQualification.revoke(id, state.revision)
    if (!current()) return
    ElMessage.success('工序资格已保存')
    emit('changed')
    await read()
  } catch (e) {
    if (current() && e !== 'cancel' && e !== 'close') error.value = (e instanceof Error ? e.message : '保存失败') + '，请刷新资格后重试。'
  } finally {
    if (revision === auth.revision && userId.value === id) saving.value = false
  }
}
</script>
<template>
  <section class="qualification-panel panel" aria-label="用户工序资格">
    <h3>用户工序资格</h3>
    <p class="secondary">仅配置当前工厂。工序详情中的“可操作人员”继续维护指定关系。</p>
    <template v-if="canRead">
      <label for="qualification-user">选择用户</label>
      <SearchSelect id="qualification-user" :model-value="userId" :options="remote.items.value" :selected-option="selectedOption" :disabled="saving" :loading="remote.loading.value" :error="remote.error.value" placeholder="搜索有当前工厂业务授权的人员" @update:model-value="selectUser" @search="remote.scheduleSearch" @retry="remote.retry" @open="remote.open" />
      <el-collapse>
        <el-collapse-item title="按用户编号读取（含失效账号的资格回收）" name="number">
          <el-form inline @submit.prevent="loadNumber">
            <el-form-item label="用户编号"><el-input v-model="userNumber" :disabled="saving" inputmode="numeric" maxlength="19" /></el-form-item>
            <el-button native-type="submit" :disabled="saving">读取资格</el-button>
          </el-form>
        </el-collapse-item>
      </el-collapse>
      <el-alert v-if="error" :title="error" type="error" :closable="false"><el-button :disabled="saving" @click="read">刷新资格</el-button></el-alert>
      <p v-if="loading" role="status">正在读取资格…</p>
      <div v-if="summary" class="qualification-summary">
        <p><strong>当前有效模式：{{ mode }}</strong></p>
        <div class="qualification-toggle">
          <label for="qualification-all">全部工序</label>
          <el-switch id="qualification-all" :model-value="summary.allOperations" :loading="saving" :disabled="saving || loading || (summary.allOperations ? !canRevoke : !canGrant || !summary.validUser)" @change="switchAll" />
          <el-button :disabled="saving" @click="read">刷新资格</el-button>
        </div>
        <p v-if="summary.allOperations">当前工厂全部适用工序，包括未来新增工序。仍受实际路径、派工名单和系统权限约束。</p>
        <p v-if="!summary.validUser" role="status">该用户当前无操作资格；有关闭权限的管理者仍可回收残留 ALL 设置。</p>
        <p>已指定工序：{{ summary.explicitTotal }} 个，其中 {{ summary.enabledExplicitTotal }} 个启用。</p>
        <p class="secondary">{{ summary.allOperations ? '以下是保留的指定授权集合。删除显式关系不等于从 ALL 中排除该工序。' : '当前按启用的指定工序判断资格；可在对应工序详情添加或删除关系。' }}</p>
        <el-table :data="summary.operations" row-key="operationId" empty-text="没有指定工序">
          <el-table-column prop="operationId" label="工序编号" />
          <el-table-column prop="code" label="工序编码" />
          <el-table-column label="工序名称"><template #default="{ row }">{{ row.name || '工序不存在' }}</template></el-table-column>
          <el-table-column label="状态"><template #default="{ row }">{{ row.status === 'ENABLED' ? '启用' : row.status === 'DISABLED' ? '停用' : '不存在' }}</template></el-table-column>
        </el-table>
        <Pagination v-if="summary.explicitTotal > 20 && !saving" v-model:page="page" :limit="20" :total="summary.explicitTotal" :page-sizes="[20]" :auto-scroll="false" @pagination="read" />
      </div>
    </template>
    <p v-else>当前范围没有工序资格查询权限。</p>
  </section>
</template>
<style scoped>
.qualification-panel { margin-bottom: var(--mes-space-4, 16px); padding: var(--mes-space-4, 16px); }
.qualification-panel > :deep(.search-select) { max-width: 560px; }
.qualification-toggle { display: flex; align-items: center; flex-wrap: wrap; gap: var(--mes-space-3, 12px); }
</style>
