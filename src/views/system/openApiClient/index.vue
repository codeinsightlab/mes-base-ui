<template>
  <div class="app-container">
    <PageHeader title="OpenAPI 应用" description="应用凭证、状态与接口授权" />
    <el-alert v-if="queryError" :title="queryError" type="error" :closable="false" class="mb8"><el-button size="small" @click="getList">重试</el-button></el-alert>
    <el-alert
      :title="dataScopeEnabled ? '业务数据范围校验已开启' : '业务数据范围校验已关闭'"
      :type="dataScopeEnabled ? 'success' : 'info'"
      :closable="false"
      show-icon
      class="mb8"
      description="应用仍需有效凭证和接口授权。数据范围规则由业务系统配置，可按实际需要启用。"
    />
    <el-form ref="queryForm" class="filter-panel" :model="queryParams" :inline="true" size="small">
      <el-form-item label="appKey" prop="appKey"><el-input v-model="queryParams.appKey" clearable @keyup.enter="handleQuery" /></el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="queryParams.status" clearable><el-option label="禁用" :value="0" /><el-option label="启用" :value="1" /></el-select>
      </el-form-item>
      <el-form-item><el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button><el-button @click="resetQuery">重置</el-button></el-form-item>
    </el-form>
    <el-button v-hasPermi="['system:openApiClient:add']" type="primary" size="small" icon="Plus" class="mb8" @click="createOpen = true">新建应用</el-button>
    <el-table v-loading="loading" :data="clients">
      <el-table-column label="应用名称" prop="clientName" min-width="140" />
      <el-table-column label="appKey" prop="appKey" min-width="250" />
      <el-table-column label="状态" prop="statusName" width="100"><template #default="scope"><StatusTag :label="scope.row.statusName" /></template></el-table-column>
      <el-table-column label="创建时间" width="165"><template #default="scope">{{ parseTime(scope.row.createTime) }}</template></el-table-column>
      <el-table-column label="备注" prop="remark" min-width="120" show-overflow-tooltip />
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="scope">
          <el-button v-hasPermi="['system:openApiClient:query']" link size="small" :disabled="busy" @click="showDetail(scope.row)">详情</el-button>
          <el-button v-hasPermi="['system:openApiClient:edit']" link size="small" :disabled="busy" @click="toggleStatus(scope.row)">{{ scope.row.status === 1 ? '禁用' : '启用' }}</el-button>
          <el-dropdown v-hasPermi="['system:openApiClient:reset','system:openApiClient:authorize']" trigger="click" :disabled="busy">
            <el-button link size="small" :disabled="busy" aria-label="更多应用操作">更多<el-icon><ArrowDown /></el-icon></el-button>
            <template #dropdown><el-dropdown-menu>
              <el-dropdown-item v-if="hasPermi(['system:openApiClient:authorize'])" :disabled="busy" @click="showApis(scope.row)">接口授权</el-dropdown-item>
              <el-dropdown-item v-if="hasPermi(['system:openApiClient:reset'])" :disabled="busy" @click="handleReset(scope.row)">重置 Secret</el-dropdown-item>
            </el-dropdown-menu></template>
          </el-dropdown>
        </template>
      </el-table-column>
    </el-table>
    <pagination v-show="total > 0" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" :total="total" :page-sizes="[10, 20, 50, 100]" @pagination="getList" />

    <el-dialog v-model="createOpen" title="新建 OpenAPI 应用" width="520px" :close-on-click-modal="false" @closed="clearCreate">
      <el-form ref="createForm" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="应用名称" prop="clientName"><el-input v-model="form.clientName" maxlength="100" /></el-form-item>
        <el-form-item label="备注" prop="remark"><el-input v-model="form.remark" type="textarea" maxlength="500" show-word-limit /></el-form-item>
      </el-form>
      <el-alert title="创建后默认禁用，请配置授权后手工启用。" type="info" :closable="false" />
      <template #footer><el-button :disabled="busy" @click="createOpen = false">取消</el-button><el-button type="primary" :loading="busy" @click="handleCreate">创建</el-button></template>
    </el-dialog>

    <el-dialog v-model="detailOpen" title="应用详情" width="650px">
      <el-descriptions v-if="detail" :column="1" border>
        <el-descriptions-item label="应用名称">{{ detail.clientName }}</el-descriptions-item>
        <el-descriptions-item label="appKey">{{ detail.appKey }}</el-descriptions-item>
        <el-descriptions-item label="状态"><StatusTag :label="detail.statusName" /></el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ parseTime(detail.createTime) }}</el-descriptions-item>
        <el-descriptions-item label="更新时间">{{ parseTime(detail.updateTime) }}</el-descriptions-item>
        <el-descriptions-item label="备注">{{ detail.remark }}</el-descriptions-item>
      </el-descriptions>
    </el-dialog>

    <el-dialog v-model="secretOpen" title="一次性凭证" width="700px" :close-on-click-modal="false" :before-close="closeSecret" @closed="clearSecret">
      <el-alert title="Secret 仅本次展示，关闭后无法再次查看，请妥善保存。" type="warning" :closable="false" />
      <el-form v-if="secret" label-width="90px" class="credentials">
        <el-form-item label="appKey"><el-input :model-value="secret.appKey" readonly><template #append><el-button @click="copyCredential('appKey')">复制</el-button></template></el-input></el-form-item>
        <el-form-item label="appSecret"><el-input :model-value="secret.appSecret" readonly><template #append><el-button @click="copyCredential('appSecret')">复制</el-button></template></el-input></el-form-item>
      </el-form>
      <template #footer><el-button type="primary" @click="closeSecret">已保存，关闭</el-button></template>
    </el-dialog>

    <el-dialog
      v-model="apisOpen"
      title="接口授权"
      width="800px"
      top="10vh"
      class="api-permission-dialog"
      :close-on-click-modal="false"
    >
      <template #header><div class="permission-header">
        <h2 class="permission-title">接口授权</h2>
        <p class="permission-subtitle">配置当前应用允许访问的 OpenAPI 接口</p>
      </div></template>
      <div class="permission-content">
        <div class="permission-notice" :class="{ 'is-empty': selectedApis.length === 0 }" role="note">
          <el-icon aria-hidden="true"><Warning /></el-icon>
          <span>清空授权后，该应用将无法访问任何受保护 API。</span>
        </div>
        <div class="permission-toolbar">
          <div class="permission-summary" aria-live="polite">
            已选择 <strong>{{ selectedApis.length }}</strong> / {{ availableApiCount }} 个接口
            <span class="permission-original">当前已授权 {{ originalApis.length }} 个</span>
          </div>
          <div class="permission-actions">
            <el-button link size="small" :disabled="busy || catalog.length === 0 || allKnownSelected" @click="toggleAllApis(true)">全选</el-button>
            <el-button link size="small" :disabled="busy || selectedApis.length === 0" @click="selectedApis = []">清空</el-button>
          </div>
        </div>
        <p v-if="catalog.length" class="permission-hint">按 Controller 分组，同一接口标识在不同分组中共享授权。全选仅选择已发现接口。</p>
        <el-empty v-if="catalog.length === 0" description="暂无可授权接口" />
        <section v-for="group in catalogGroups" :key="group.groupId" class="api-group">
          <div class="group-heading">
            <el-checkbox :model-value="groupSelected(group)" :indeterminate="groupPartial(group)" :disabled="busy" @change="toggleGroup(group, $event)">{{ group.groupName }}</el-checkbox>
            <span class="group-count">{{ group.apis.length }} 个接口</span>
          </div>
          <el-checkbox-group v-model="selectedApis" :disabled="busy" class="api-list">
            <el-checkbox
              v-for="api in group.apis"
              :key="api.apiCode"
              :value="api.apiCode"
              class="api-option"
              :class="{ 'is-selected': selectedApis.includes(api.apiCode) }"
            >
              <span class="api-code">{{ api.apiCode }}</span>
              <span v-for="mapping in api.mappings" :key="mapping.httpMethod + mapping.path" class="api-mapping">
                <span v-if="mapping.description" class="api-description">{{ mapping.description }}</span>
                <span class="api-endpoint">
                  <el-tag size="small" effect="plain" class="api-method">{{ mapping.httpMethod }}</el-tag>
                  <span class="api-path">{{ mapping.path }}</span>
                </span>
              </span>
            </el-checkbox>
          </el-checkbox-group>
        </section>
        <section v-if="unknownApis.length" class="api-group api-unknown">
          <div class="group-heading">
            <h3>未发现对应接口的已有授权</h3>
            <span class="group-count">{{ unknownApis.length }} 个接口</span>
          </div>
          <p class="permission-hint">已有授权将继续保留；如需移除，请取消勾选后保存。</p>
          <el-checkbox-group v-model="selectedApis" :disabled="busy" class="api-list">
            <el-checkbox v-for="code in unknownApis" :key="code" :value="code" class="api-option" :class="{ 'is-selected': selectedApis.includes(code) }">
              <span class="api-code">{{ code }}</span>
              <span class="api-description">当前未发现对应接口</span>
            </el-checkbox>
          </el-checkbox-group>
        </section>
      </div>
      <template #footer><div class="permission-footer">
        <span class="permission-footer-summary" aria-live="polite">已选择 <strong>{{ selectedApis.length }}</strong> 个接口</span>
        <div>
          <el-button :disabled="busy" @click="apisOpen = false">取消</el-button>
          <el-button type="primary" :loading="busy" @click="saveApis">保存授权</el-button>
        </div>
      </div></template>
    </el-dialog>

  </div>
</template>

<script>
import { listClients, getClient, createClient, changeStatus, resetSecret, getApiCatalog, getClientApis, replaceClientApis, getDataScope } from '@/api/system/openApiClient'

export default {
  name: 'OpenApiClient',
  beforeRouteLeave(to, from, next) { this.disposeSecrets(); next() },
  data() {
    return {
      loading: false, busy: false, queryError: '', dataScopeEnabled: false, clients: [], total: 0,
      queryParams: { appKey: undefined, status: undefined, pageNum: 1, pageSize: 20 },
      createOpen: false, form: { clientName: '', remark: '' },
      rules: { clientName: [{ required: true, message: '请输入应用名称', trigger: 'blur' }] },
      detailOpen: false, detail: null,
      secretOpen: false, secret: null,
      apisOpen: false, apiClientId: null, catalog: [], originalApis: [], selectedApis: [], disposed: false
    }
  },
  computed: {
    catalogGroups() {
      const groups = []
      this.catalog.forEach(api => api.mappings.forEach(mapping => {
        let group = groups.find(item => item.groupId === mapping.groupId)
        if (!group) { group = { groupId: mapping.groupId, groupName: mapping.groupName, apis: [] }; groups.push(group) }
        let entry = group.apis.find(item => item.apiCode === api.apiCode)
        if (!entry) { entry = { apiCode: api.apiCode, mappings: [] }; group.apis.push(entry) }
        entry.mappings.push(mapping)
      }))
      return groups
    },
    availableApiCount() { return new Set([...this.catalog.map(api => api.apiCode), ...this.unknownApis]).size },
    allKnownSelected() { return this.catalog.length > 0 && this.catalog.every(api => this.selectedApis.includes(api.apiCode)) },
    someKnownSelected() { return this.catalog.some(api => this.selectedApis.includes(api.apiCode)) },
    unknownApis() {
      return this.originalApis.filter(code => !this.catalog.some(api => api.apiCode === code))
    }
  },
  created() { this.getList() },
  activated() { this.disposed = false },
  deactivated() { this.disposeSecrets() },
  beforeUnmount() { this.disposeSecrets() },
  methods: {
    groupSelected(group) { return group.apis.every(api => this.selectedApis.includes(api.apiCode)) },
    groupPartial(group) { return group.apis.some(api => this.selectedApis.includes(api.apiCode)) && !this.groupSelected(group) },
    toggleGroup(group, selected) { this.selectCodes(group.apis.map(api => api.apiCode), selected) },
    toggleAllApis(selected) { this.selectCodes(this.catalog.map(api => api.apiCode), selected) },
    selectCodes(codes, selected) {
      this.selectedApis = selected ? [...new Set([...this.selectedApis, ...codes])] : this.selectedApis.filter(code => !codes.includes(code))
    },
    async getList() {
      this.loading = true
      this.queryError = ''
      try {
        const [response, scope] = await Promise.all([listClients(this.queryParams), getDataScope()])
        if (this.disposed) return
        this.clients = response.data.list; this.total = response.data.total; this.dataScopeEnabled = scope.data.enabled
      } catch(error) { this.queryError = error instanceof Error ? error.message : '应用列表加载失败' } finally { this.loading = false }
    },
    handleQuery() { this.queryParams.pageNum = 1; this.getList() },
    resetQuery() { this.resetForm('queryForm'); this.handleQuery() },
    clearCreate() { this.form = { clientName: '', remark: '' }; this.resetForm('createForm') },
    clearSecret() { this.secret = null },
    closeSecret() { this.secretOpen = false; this.clearSecret() },
    disposeSecrets() { this.disposed = true; this.closeSecret() },
    showSecret(data) {
      if (this.disposed) return
      this.secret = { appKey: data.appKey, appSecret: data.appSecret }; this.secretOpen = true
    },
    async copyCredential(field) {
      if (!this.secret) return
      try {
        if (!navigator.clipboard || !window.isSecureContext) throw new Error('Clipboard unavailable')
        await navigator.clipboard.writeText(this.secret[field]); this.$modal.msgSuccess('复制成功')
      } catch(error) { this.$modal.msgError('复制失败，请手工复制并妥善保存') }
    },
    handleCreate() {
      this.$refs.createForm.validate(async valid => {
        if (!valid || this.busy) return
        this.busy = true
        try {
          const response = await createClient(this.form)
          this.createOpen = false; this.showSecret(response.data); this.getList()
        } finally { this.busy = false }
      })
    },
    async showDetail(row) {
      this.busy = true
      try { const response = await getClient(row.clientId); this.detail = response.data; this.detailOpen = true } finally { this.busy = false }
    },
    async toggleStatus(row) {
      const status = row.status === 1 ? 0 : 1
      try { await this.$modal.confirm(status === 0 ? '确认禁用该应用？现有 Token 将失效。' : '确认启用该应用？凭证版本将更新，调用方需重新获取 Token。') } catch(cancel) { return }
      this.busy = true
      try {
        await changeStatus({ clientId: row.clientId, status }); this.$modal.msgSuccess('状态更新成功'); this.getList()
      } finally { this.busy = false }
    },
    async handleReset(row) {
      try {
        await this.$modal.confirm('确认重置该应用的 Secret？')
        await this.$modal.confirm('旧 Secret 和历史 Token 将失效，调用方需使用新 Secret 重新获取 Token。')
      } catch(cancel) { return }
      this.busy = true
      try { const response = await resetSecret(row.clientId); this.showSecret(response.data); this.getList() } finally { this.busy = false }
    },
    async showApis(row) {
      this.busy = true
      try {
        const [catalog, grants] = await Promise.all([getApiCatalog(), getClientApis(row.clientId)])
        this.catalog = catalog.data; this.originalApis = [...grants.data]; this.selectedApis = [...grants.data]
        this.apiClientId = row.clientId; this.apisOpen = true
      } finally { this.busy = false }
    },
    async saveApis() {
      if (this.selectedApis.length > 100) { this.$modal.msgError('最多授权100个接口'); return }
      const requestedApis = [...this.selectedApis]
      const added = requestedApis.filter(code => !this.originalApis.includes(code))
      const removed = this.originalApis.filter(code => !requestedApis.includes(code))
      const summary = `新增：${added.length ? added.join('、') : '无'}；移除：${removed.length ? removed.join('、') : '无'}。${this.selectedApis.length === 0 ? '保存后无法调用任何需要授权的业务 API。' : ''}`
      try { await this.$modal.confirm(summary) } catch(cancel) { return }
      this.busy = true
      try {
        await replaceClientApis({ clientId: this.apiClientId, apiCodes: requestedApis })
        this.originalApis = requestedApis; this.apisOpen = false; this.$modal.msgSuccess('授权保存成功')
      } finally { this.busy = false }
    }
  }
}
</script>

<style scoped>
.credentials { margin-top: 20px; }

:deep(.api-permission-dialog) {
  display: flex;
  flex-direction: column;
  max-width: calc(100vw - 32px);
  max-height: 80vh;
  margin-bottom: 0;
  border-radius: var(--ui-radius-lg);
  overflow: hidden;
}
:deep(.api-permission-dialog .el-dialog__header) {
  flex-shrink: 0;
  padding: 22px 24px 18px;
  border-bottom: 1px solid var(--ui-border-soft);
}
:deep(.api-permission-dialog .el-dialog__headerbtn) { top: 24px; right: 24px; }
:deep(.api-permission-dialog .el-dialog__body) {
  min-height: 0;
  padding: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
:deep(.api-permission-dialog .el-dialog__footer) {
  flex-shrink: 0;
  padding: 16px 24px;
  border-top: 1px solid var(--ui-border-soft);
  background: var(--ui-surface);
}
.permission-title { margin: 0; color: var(--ui-text); font-size: 20px; font-weight: 600; line-height: 28px; }
.permission-subtitle { margin: 5px 28px 0 0; color: var(--ui-text-muted); font-size: 13px; line-height: 20px; }
.permission-content { padding: 18px 24px 24px; }
.permission-notice { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: var(--ui-radius); color: var(--ui-text-muted); background: var(--ui-surface-soft); font-size: 12px; line-height: 20px; }
.permission-notice.is-empty { color: var(--ui-warning); background: var(--ui-warning-bg); }
.permission-notice i { flex-shrink: 0; font-size: 15px; }
.permission-toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.permission-summary { color: var(--ui-text-secondary); font-size: 13px; }
.permission-summary strong, .permission-footer-summary strong { color: var(--ui-text); font-size: 15px; font-weight: 600; }
.permission-original { margin-left: 12px; color: var(--ui-text-muted); font-size: 12px; }
.permission-actions { display: flex; align-items: center; gap: 16px; }
.permission-actions .el-button + .el-button { margin-left: 0; }
.permission-hint { margin: 3px 0 0; color: var(--ui-text-muted); font-size: 12px; line-height: 20px; }
.api-group { margin-top: 20px; }
.group-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 10px; border-bottom: 1px solid var(--ui-border-soft); }
.group-heading h3 { margin: 0; color: var(--ui-text-secondary); font-size: 14px; font-weight: 600; }
.group-heading :deep(.el-checkbox__label) { color: var(--ui-text); font-size: 15px; font-weight: 600; }
.group-count { flex-shrink: 0; padding: 2px 8px; border-radius: 10px; color: var(--ui-text-muted); background: var(--ui-surface-soft); font-size: 12px; line-height: 18px; }
.api-list { padding-top: 6px; }
.api-option.el-checkbox { display: flex; align-items: flex-start; margin: 4px 0 0; padding: 10px 12px; border: 1px solid transparent; border-radius: var(--ui-radius); white-space: normal; transition: background-color var(--ui-transition), border-color var(--ui-transition); }
.api-option.el-checkbox:hover { background: var(--ui-surface-soft); }
.api-option.el-checkbox.is-selected { background: var(--ui-running-bg); border-color: var(--el-color-primary-light-8); }
.api-option.el-checkbox:focus-within { outline: 2px solid var(--ui-primary); outline-offset: 1px; }
.api-option.el-checkbox.is-disabled { cursor: not-allowed; }
.api-option :deep(.el-checkbox__input) { margin-top: 3px; }
.api-option :deep(.el-checkbox__label) { flex: 1; min-width: 0; padding-left: 12px; line-height: 20px; }
.api-code { display: block; color: var(--ui-text); font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
.api-mapping { display: block; margin-top: 3px; }
.api-description { display: block; margin-top: 2px; color: var(--ui-text-muted); font-size: 12px; font-weight: 400; line-height: 19px; }
.api-endpoint { display: flex; align-items: flex-start; gap: 8px; margin-top: 5px; }
.api-method.el-tag { flex-shrink: 0; min-width: 52px; height: 20px; padding: 0 6px; border-color: var(--ui-border); background: var(--ui-running-bg); color: var(--ui-primary); text-align: center; font-family: var(--ui-font-mono); font-size: 11px; line-height: 18px; }
.api-path { min-width: 0; color: var(--ui-text-secondary); font-family: var(--ui-font-mono); font-size: 12px; font-weight: 400; line-height: 20px; overflow-wrap: anywhere; }
.api-unknown .permission-hint { margin-top: 8px; }
.permission-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.permission-footer-summary { color: var(--ui-text-muted); font-size: 13px; }
@media (max-width: 600px) {
  .permission-content { padding: 14px 16px 18px; }
  :deep(.api-permission-dialog .el-dialog__header) { padding: 18px 16px 14px; }
  :deep(.api-permission-dialog .el-dialog__footer) { padding: 12px 16px; }
  .permission-original { display: block; margin: 4px 0 0; }
  .permission-footer-summary { font-size: 12px; }
}
</style>
