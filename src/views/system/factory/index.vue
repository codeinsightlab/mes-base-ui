<template>
  <div class="app-container">
    <PageHeader section="MES BASE / SYSTEM" title="工厂管理" description="业务工厂与独立数据源绑定" />
    <div class="table-toolbar"><div><span class="secondary">每个工厂绑定一个独立业务数据源；用户和角色权限在原管理页面配置</span></div><div><el-button v-hasPermi="['system:factory:add']" type="primary" size="small" @click="edit()">新增工厂</el-button><el-button size="small" :loading="loading" @click="load">刷新</el-button></div></div>
    <el-table v-loading="loading" :data="rows">
      <el-table-column label="工厂编号" min-width="120"><template #default="{ row }"><CodeText :value="row.factoryId" /></template></el-table-column>
      <el-table-column label="工厂编码" min-width="150"><template #default="{ row }"><CodeText :value="row.factoryCode" /></template></el-table-column>
      <el-table-column label="所属企业" min-width="130"><template #default="{ row }"><CodeText :value="row.enterpriseId" /></template></el-table-column>
      <el-table-column prop="factoryName" label="工厂名称" min-width="180" />
      <el-table-column label="运行模式" width="120"><template #default="{ row }">{{ row.runtimeMode === 'LOCAL' ? '独立 MES' : row.runtimeMode === 'ERP' ? 'ERP' : '待升级' }}</template></el-table-column>
      <el-table-column label="ERP 类型" prop="erpProvider" min-width="110" />
      <el-table-column label="状态" width="100"><template #default="{ row }"><StatusTag :label="row.status === 'ENABLED' ? '启用' : row.status === 'DISABLED' ? '停用' : row.status" /></template></el-table-column>
      <el-table-column label="业务数据源" min-width="190"><template #default="s">{{ s.row.datasourceId === null ? '未绑定' : s.row.datasourceName }}</template></el-table-column>
      <el-table-column label="操作" width="270"><template #default="s"><el-button v-hasPermi="['system:factory:edit']" link size="small" @click="edit(s.row)">编辑 / 绑定</el-button><el-button v-hasPermi="['system:factory:edit']" link size="small" @click="oapiFactory = s.row">E10 OAPI 配置</el-button><el-button v-hasPermi="['system:factory:remove']" link size="small" class="danger" @click="remove(s.row)">删除</el-button></template></el-table-column>
    </el-table>
    <FactoryOapiDialog v-if="oapiFactory" :key="oapiFactory.factoryId" :factory="oapiFactory" @close="oapiFactory = null" @saved="load" />
    <Pagination v-model:page="pageNum" v-model:limit="pageSize" :total="total" @pagination="load" />
    <PageDialog v-model="open" :title="editing ? '编辑工厂' : '新增工厂'" width="540px" :close-on-click-modal="false">
      <el-form ref="form" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="工厂编号" prop="factoryId"><el-input v-model="form.factoryId" :disabled="editing" @change="loadIntegrationOptions" maxlength="64" /></el-form-item>
        <el-form-item label="工厂编码" prop="factoryCode"><el-input v-model="form.factoryCode" maxlength="32" /></el-form-item>
        <el-form-item label="所属企业" prop="enterpriseId"><el-input v-model="form.enterpriseId" maxlength="64" /></el-form-item>
        <el-form-item label="工厂名称" prop="factoryName"><el-input v-model="form.factoryName" maxlength="64" /></el-form-item>
        <el-form-item label="状态" prop="status"><el-radio-group v-model="form.status"><el-radio label="ENABLED">启用</el-radio><el-radio label="DISABLED">停用</el-radio></el-radio-group></el-form-item>
        <el-form-item label="业务数据源"><el-select v-model="form.datasourceId" clearable placeholder="选择已启用且未被其他工厂绑定的数据源" style="width:100%" @clear="form.datasourceId = null"><el-option v-for="source in eligible" :key="source.datasourceId" :label="source.datasourceName + ' · ' + source.dbName" :value="source.datasourceId" /></el-select></el-form-item>
        <p class="secondary">未绑定时不能访问业务数据。解绑后可在数据源页面停止管理。</p>
        <el-divider content-position="left">业务集成</el-divider>
        <el-form-item label="运行模式" prop="runtimeMode" :rules="[{ required: true, message: '请选择运行模式' }]"><el-select v-model="form.runtimeMode" :disabled="integrationLocked" @change="modeChanged"><el-option label="LOCAL · 独立 MES" value="LOCAL" /><el-option label="ERP · 外部集成" value="ERP" /></el-select></el-form-item>
        <template v-if="form.runtimeMode === 'ERP'">
          <el-form-item label="ERP 类型" prop="erpProvider" :rules="[{ required: true, message: '请选择 ERP 类型' }]"><el-select v-model="form.erpProvider" :disabled="integrationLocked" @change="form.erpConfigRef = null"><el-option v-for="provider in providers" :key="provider" :value="provider" :label="provider" /></el-select></el-form-item>
          <el-form-item label="集成配置" prop="erpConfigRef" :rules="[{ required: true, message: '请选择有效 ERP 集成配置' }]"><el-select v-model="form.erpConfigRef" :disabled="integrationLocked" :loading="optionsLoading"><el-option v-for="option in matchingOptions" :key="option.reference" :value="option.reference" :label="option.reference + ' · v' + option.revision" /><el-option v-if="form.erpConfigRef && !matchingOptions.some(o => o.reference === form.erpConfigRef)" :value="form.erpConfigRef" :label="form.erpConfigRef + '（当前不可用）'" disabled /></el-select></el-form-item>
          <p v-if="optionsError" class="secondary" role="alert">{{ optionsError }}</p>
          <p v-else-if="!optionsLoading && !integrationOptions.length" class="secondary">暂无此工厂的有效 ERP 连接配置，可通过列表中的“E10 OAPI 配置”维护该工厂的鼎捷连接。</p>
        </template>
        <p v-if="integrationLocked" class="secondary">该工厂业务运行配置已锁定；模式及 ERP 绑定变更需专门迁移流程。解绑数据源不会解除锁定。</p>
      </el-form>
      <template #footer><el-button @click="open = false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存</el-button></template>
    </PageDialog>
  </div>
</template>
<script>
import PageDialog from '@/components/page/PageDialog.vue'

import { listFactories, listDatasources, createFactory, saveFactory, deleteFactory, factoryIntegrationOptions } from '@/api/system/datasource'
import FactoryOapiDialog from './FactoryOapiDialog.vue'
import { refreshFactory } from '@/utils/factory'
export default {
  name: 'ManagedFactory',
  components: { PageDialog, FactoryOapiDialog },
  data() {
    return { oapiFactory: null, rows: [], pageNum: 1, pageSize: 20, total: 0, sources: [], loading: false, saving: false, open: false, editing: false, integrationLocked: false, integrationOptions: [], optionsLoading: false, optionsError: '', optionsRevision: 0, form: { factoryId: '', factoryCode: '', enterpriseId: '', factoryName: '', datasourceId: null, status: 'ENABLED', runtimeMode: 'LOCAL', erpProvider: null, erpConfigRef: null }, rules: {
      factoryId: [{ required: true, message: '请输入唯一的工厂编号', trigger: 'blur' }], factoryCode: [{ required: true, message: '请输入工厂编码', trigger: 'blur' }], factoryName: [{ required: true, message: '请输入工厂名称', trigger: 'blur' }]
    }}
  },
  computed: {
    providers() { return [...new Set([...this.integrationOptions.map(o => o.provider), ...(this.form.erpProvider ? [this.form.erpProvider] : [])])] },
    matchingOptions() { return this.integrationOptions.filter(o => o.provider === this.form.erpProvider) },
    eligible() { return this.sources.filter(s => s.status === 'ENABLED' && (s.factoryId === null || s.factoryId === this.form.factoryId)) } },
  created() { this.load() },
  beforeUnmount() { this.optionsRevision++ },
  methods: {
    async load() { this.loading = true; try { const [factories, sources] = await Promise.all([listFactories({ pageNum: this.pageNum, pageSize: this.pageSize }), listDatasources()]); this.rows = factories.rows; this.total = factories.total; this.sources = sources.rows } finally { this.loading = false } },
    edit(row) { this.editing = !!row; this.integrationLocked = !!row?.integrationLocked; this.form = row ? { factoryId: row.factoryId, factoryCode: row.factoryCode, enterpriseId: row.enterpriseId, revision: row.revision, factoryName: row.factoryName, datasourceId: row.datasourceId, status: row.status, runtimeMode: row.runtimeMode, erpProvider: row.erpProvider, erpConfigRef: row.erpConfigRef } : { factoryId: '', factoryCode: '', enterpriseId: '', factoryName: '', datasourceId: null, status: 'ENABLED', runtimeMode: 'LOCAL', erpProvider: null, erpConfigRef: null }; this.open = true; this.loadIntegrationOptions(); this.$nextTick(() => this.$refs.form.clearValidate()) },
    modeChanged() { this.form.erpProvider = null; this.form.erpConfigRef = null },
    async loadIntegrationOptions() {
      const revision = ++this.optionsRevision
      const id = this.form.factoryId
      this.integrationOptions = []; this.optionsError = ''
      if (!id) { this.optionsLoading = false; return }
      this.optionsLoading = true
      try { const options = await factoryIntegrationOptions(id); if (revision === this.optionsRevision && id === this.form.factoryId) this.integrationOptions = options }
      catch (error) { if (revision === this.optionsRevision) this.optionsError = error instanceof Error ? error.message : '集成配置读取失败' }
      finally { if (revision === this.optionsRevision) this.optionsLoading = false }
    },
    save() { this.$refs.form.validate(async valid => { if (!valid) return; this.saving = true; try { await (this.editing ? saveFactory(this.form) : createFactory(this.form)); await refreshFactory(); this.open = false; this.$message.success('工厂配置已保存'); await this.load() } finally { this.saving = false } }) },
    async remove(row) { await this.$confirm(`确认删除工厂“${row.factoryName}”吗？`, '提示', { type: 'warning' }); await deleteFactory(row.factoryId, row.revision); await refreshFactory(); this.$message.success('工厂已删除'); await this.load() }
  }
}
</script>
<style scoped>
.danger { color:var(--ui-error); }
</style>
