<template>
  <div class="app-container">
    <PageHeader title="工厂管理" description="业务工厂与独立数据源绑定" />
    <div class="toolbar"><div><h3>工厂管理</h3><span class="secondary">每个工厂绑定一个独立业务数据源；用户和角色权限在原管理页面配置</span></div><div><el-button v-hasPermi="['system:factory:add']" type="primary" size="small" @click="edit()">新增工厂</el-button><el-button size="small" :loading="loading" @click="load">刷新</el-button></div></div>
    <el-table :data="rows" v-loading="loading" border>
      <el-table-column prop="factoryId" label="工厂编号" width="100" />
      <el-table-column prop="factoryCode" label="工厂编码" min-width="150" />
      <el-table-column prop="enterpriseId" label="所属企业" width="130" />
      <el-table-column prop="factoryName" label="工厂名称" min-width="180" />
      <el-table-column prop="status" label="状态" width="90" />
      <el-table-column label="业务数据源" min-width="190"><template #default="s">{{ s.row.datasourceId === null ? '未绑定' : s.row.datasourceName }}</template></el-table-column>
      <el-table-column label="操作" width="170"><template #default="s"><el-button link size="small" v-hasPermi="['system:factory:edit']" @click="edit(s.row)">编辑 / 绑定</el-button><el-button link size="small" class="danger" v-hasPermi="['system:factory:remove']" @click="remove(s.row)">删除</el-button></template></el-table-column>
    </el-table>
    <Pagination :total="total" v-model:page="pageNum" v-model:limit="pageSize" @pagination="load" />
    <el-dialog :title="editing ? '编辑工厂' : '新增工厂'" v-model="open" width="540px" :close-on-click-modal="false">
      <el-form ref="form" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="工厂编号" prop="factoryId"><el-input v-model="form.factoryId" :disabled="editing" maxlength="64" /></el-form-item>
        <el-form-item label="工厂编码" prop="factoryCode"><el-input v-model="form.factoryCode" maxlength="32" /></el-form-item>
        <el-form-item label="所属企业" prop="enterpriseId"><el-input v-model="form.enterpriseId" maxlength="64" /></el-form-item>
        <el-form-item label="工厂名称" prop="factoryName"><el-input v-model="form.factoryName" maxlength="64" /></el-form-item>
        <el-form-item label="状态" prop="status"><el-radio-group v-model="form.status"><el-radio label="ENABLED">启用</el-radio><el-radio label="DISABLED">停用</el-radio></el-radio-group></el-form-item>
        <el-form-item label="业务数据源"><el-select v-model="form.datasourceId" clearable placeholder="选择已启用且未被其他工厂绑定的数据源" style="width:100%" @clear="form.datasourceId = null"><el-option v-for="source in eligible" :key="source.datasourceId" :label="source.datasourceName + ' · ' + source.dbName" :value="source.datasourceId" /></el-select></el-form-item>
        <p class="secondary">未绑定时不能访问业务数据。解绑后可在数据源页面停止管理。</p>
      </el-form>
      <template #footer><el-button @click="open = false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存</el-button></template>
    </el-dialog>
  </div>
</template>
<script>
import { listFactories, listDatasources, createFactory, saveFactory, deleteFactory } from '@/api/system/datasource'
import { refreshFactory } from '@/utils/factory'
export default {
  name: 'ManagedFactory',
  data() { return { rows: [], pageNum:1, pageSize:20, total:0, sources: [], loading: false, saving: false, open: false, editing: false, form: { factoryId: '', factoryCode: '', enterpriseId: '', factoryName: '', datasourceId: null, status: 'ENABLED' }, rules: {
    factoryId: [{ required: true, message: '请输入唯一的工厂编号', trigger: 'blur' }], factoryCode: [{ required: true, message: '请输入工厂编码', trigger: 'blur' }], factoryName: [{ required: true, message: '请输入工厂名称', trigger: 'blur' }]
  } } },
  computed: { eligible() { return this.sources.filter(s => s.status === 'ENABLED' && (s.factoryId === null || s.factoryId === this.form.factoryId)) } },
  created() { this.load() },
  methods: {
    async load() { this.loading = true; try { const [factories, sources] = await Promise.all([listFactories({pageNum:this.pageNum,pageSize:this.pageSize}), listDatasources()]); this.rows = factories.rows; this.total=factories.total; this.sources = sources.rows } finally { this.loading = false } },
    edit(row) { this.editing = !!row; this.form = row ? { factoryId: row.factoryId, factoryCode: row.factoryCode, enterpriseId: row.enterpriseId, revision: row.revision, factoryName: row.factoryName, datasourceId: row.datasourceId, status: row.status } : { factoryId: '', factoryCode: '', enterpriseId: '', factoryName: '', datasourceId: null, status: 'ENABLED' }; this.open = true; this.$nextTick(() => this.$refs.form.clearValidate()) },
    save() { this.$refs.form.validate(async valid => { if (!valid) return; this.saving = true; try { await (this.editing ? saveFactory(this.form) : createFactory(this.form)); await refreshFactory(); this.open = false; this.$message.success('工厂配置已保存'); await this.load() } finally { this.saving = false } }) },
    async remove(row) { await this.$confirm(`确认删除工厂“${row.factoryName}”吗？`, '提示', { type: 'warning' }); await deleteFactory(row.factoryId, row.revision); await refreshFactory(); this.$message.success('工厂已删除'); await this.load() }
  }
}
</script>
<style scoped>
.toolbar { display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; }
h3 { margin:0 0 6px; font-size:17px; color:var(--ui-text); }
.secondary { font-size:12px; color:var(--ui-text-secondary); }
.danger { color:var(--ui-error); }
</style>
