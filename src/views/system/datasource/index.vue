<template>
  <div class="app-container">
    <PageHeader title="业务数据源" description="连接配置、工厂绑定与本节点加载状态" />
    <el-alert title="启用仅登记配置；首次业务访问时按需加载。以下加载状态来自当前服务节点，不代表数据库当前在线。" type="info" :closable="false" show-icon />
    <div class="toolbar">
      <div><h3>业务数据源</h3><span class="secondary">连接检测、保活和回收由 Druid 管理</span></div>
      <div><el-button v-hasPermi="['system:datasource:add']" type="primary" size="small" @click="edit()">新增数据源</el-button><el-button size="small" :loading="loading" @click="load">刷新状态</el-button></div>
    </div>
    <el-table v-loading="loading" :data="rows" border>
      <el-table-column prop="datasourceName" label="数据源" min-width="150" />
      <el-table-column label="数据库" min-width="190"><template #default="s"><div>{{ s.row.dbName }}</div><span class="secondary">{{ s.row.dbHost }}:{{ s.row.dbPort }}</span></template></el-table-column>
      <el-table-column prop="dbUsername" label="连接账号" min-width="130" show-overflow-tooltip />
      <el-table-column label="关联工厂" min-width="120"><template #default="s">{{ s.row.factoryName === null ? '未绑定' : s.row.factoryName }}</template></el-table-column>
      <el-table-column label="管理状态" width="105"><template #default="s"><el-tag :type="s.row.status === 'ENABLED' ? 'success' : 'info'" size="small">{{ s.row.statusName }}</el-tag></template></el-table-column>
      <el-table-column label="本节点状态" min-width="120"><template #default="s"><div>{{ s.row.runtimeStatusName }}</div><span v-if="s.row.initialized" class="secondary">连接池已初始化</span></template></el-table-column>
      <el-table-column label="Druid 最近建连异常" min-width="170" show-overflow-tooltip><template #default="s"><span v-if="s.row.runtimeError">{{ s.row.runtimeError }}<br>{{ s.row.lastErrorTime }}</span><span v-else class="secondary">暂无异常记录</span></template></el-table-column>
      <el-table-column label="DDL 快照" min-width="185"><template #default="s">
        <div>{{ s.row.ddlGeneratedAt === null ? '尚未生成' : parseTime(s.row.ddlGeneratedAt) }}</div>
        <el-button v-hasPermi="['system:datasource:query']" link size="small" :loading="ddlBusyId === s.row.datasourceId && ddlAction === 'download'" :disabled="ddlBusyId !== null" @click="downloadDdl(s.row)">下载 DDL</el-button>
        <el-button v-hasPermi="['system:datasource:edit']" link size="small" :loading="ddlBusyId === s.row.datasourceId && ddlAction === 'refresh'" :disabled="ddlBusyId !== null || s.row.status !== 'ENABLED'" @click="refreshDdl(s.row)">刷新 DDL</el-button>
      </template></el-table-column>
      <el-table-column label="操作" width="205" fixed="right"><template #default="s">
        <el-button v-hasPermi="['system:datasource:edit']" link size="small" :disabled="s.row.status === 'ENABLED' || s.row.factoryId !== null" @click="edit(s.row)">编辑</el-button>
        <el-button v-if="s.row.status === 'DISABLED'" v-hasPermi="['system:datasource:edit']" link size="small" @click="enable(s.row)">加入管理</el-button>
        <el-tooltip v-else content="已绑定的数据源需先到工厂管理解除绑定" :disabled="s.row.factoryId === null"><span><el-button v-hasPermi="['system:datasource:edit']" link size="small" :disabled="s.row.factoryId !== null" @click="disable(s.row)">停止管理</el-button></span></el-tooltip>
        <el-button v-hasPermi="['system:datasource:remove']" link size="small" :disabled="s.row.status === 'ENABLED' || s.row.factoryId !== null" @click="remove(s.row)">删除</el-button>
      </template></el-table-column>
    </el-table>
    <Pagination v-model:page="pageNum" v-model:limit="pageSize" :total="total" @pagination="load" />
    <p class="secondary">DDL 仅包含表结构和索引，不包含数据、外键、视图及触发器等对象。下载优先使用缓存；首次下载和手动刷新会读取源库结构。请导入空库，源库结构变更后需手动刷新。</p>
    <p v-if="rows.length" class="secondary">当前节点：{{ rows[0].nodeId }}</p>
    <el-dialog v-model="open" :title="form.datasourceId === null ? '新增数据源' : '编辑数据源'" width="560px" :close-on-click-modal="false">
      <el-form ref="form" :model="form" :rules="rules" label-width="95px">
        <el-form-item label="名称" prop="datasourceName"><el-input v-model="form.datasourceName" maxlength="64" /></el-form-item>
        <el-form-item label="服务器" prop="dbHost"><el-input v-model="form.dbHost" placeholder="主机名或 IPv4 地址" /></el-form-item>
        <el-form-item label="端口" prop="dbPort"><el-input-number v-model="form.dbPort" :min="1" :max="65535" /></el-form-item>
        <el-form-item label="数据库名" prop="dbName"><el-input v-model="form.dbName" maxlength="64" /></el-form-item>
        <el-form-item label="连接账号" prop="dbUsername"><el-input v-model="form.dbUsername" autocomplete="off" /></el-form-item>
        <el-form-item label="连接密码"><el-input v-model="form.password" type="password" show-password autocomplete="new-password" :placeholder="form.datasourceId === null ? '填写该数据库的连接密码' : '不回显；留空保持原密码'" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="open = false">取消</el-button><el-button type="primary" :loading="saving" @click="save">保存登记</el-button></template>
    </el-dialog>
  </div>
</template>
<script>
import { listDatasources, createDatasource, updateDatasource, enableDatasource, disableDatasource, deleteDatasource, downloadDatasourceDdl, refreshDatasourceDdl } from '@/api/system/datasource'
const empty = () => ({ datasourceId: null, revision: null, datasourceName: '', dbHost: '', dbPort: 3306, dbName: '', dbUsername: '', password: '' })
export default {
  name: 'ManagedDatasource',
  data() {
    return { rows: [], pageNum: 1, pageSize: 20, total: 0, ddlBusyId: null, ddlAction: '', loading: false, saving: false, open: false, form: empty(), rules: {
      datasourceName: [{ required: true, message: '请输入名称', trigger: 'blur' }], dbHost: [{ required: true, message: '请输入服务器', trigger: 'blur' }],
      dbPort: [{ required: true, message: '请输入端口', trigger: 'blur' }], dbName: [{ required: true, message: '请输入数据库名', trigger: 'blur' }], dbUsername: [{ required: true, message: '请输入连接账号', trigger: 'blur' }]
    }}
  },
  created() { this.load() },
  methods: {
    async downloadDdl(row) {
      this.ddlBusyId = row.datasourceId; this.ddlAction = 'download'
      try {
        const response = await downloadDatasourceDdl(row.datasourceId)
        const file = response
        const url = URL.createObjectURL(new Blob([file.sql], { type: 'application/sql;charset=utf-8' }))
        const link = document.createElement('a'); link.href = url; link.download = file.fileName
        document.body.appendChild(link); link.click(); link.remove()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
        await this.load()
      } finally { this.ddlBusyId = null; this.ddlAction = '' }
    },
    async refreshDdl(row) {
      this.ddlBusyId = row.datasourceId; this.ddlAction = 'refresh'
      try {
        await refreshDatasourceDdl(row.datasourceId)
        this.$message.success('DDL 已重新生成，缓存已更新')
        await this.load()
      } finally { this.ddlBusyId = null; this.ddlAction = '' }
    },
    async load() { this.loading = true; try { const response = await listDatasources({ pageNum: this.pageNum, pageSize: this.pageSize }); this.rows = response.rows; this.total = response.total } finally { this.loading = false } },
    edit(row) { this.form = empty(); if (row) Object.keys(this.form).filter(k => k !== 'password').forEach(k => { this.form[k] = row[k] }); this.open = true; this.$nextTick(() => this.$refs.form.clearValidate()) },
    save() {
      this.$refs.form.validate(async valid => {
        if (!valid) return; this.saving = true; try {
          const data = { ...this.form }; if (data.datasourceId !== null && data.password === '') data.password = null
          await (data.datasourceId === null ? createDatasource(data) : updateDatasource(data)); this.open = false; this.$message.success('已保存登记，尚未连接数据库'); await this.load()
        } finally { this.saving = false }
      })
    },
    async enable(row) { await enableDatasource(row.datasourceId); this.$message.success('已启用，将在首次业务访问时加载'); await this.load() },
    async disable(row) { await disableDatasource(row.datasourceId); this.$message.success('已停止管理'); await this.load() },
    remove(row) { this.$confirm(`确认删除数据源“${row.datasourceName}”的登记？不会删除数据库。`, '删除登记', { type: 'warning' }).then(async() => { await deleteDatasource(row.datasourceId); await this.load() }).catch(error => { if (error !== 'cancel' && error !== 'close') throw error }) }
  }
}
</script>
<style scoped>
.toolbar { display: flex; justify-content: space-between; align-items: center; margin: 20px 0; }
h3 { margin: 0 0 6px; font-size: 17px; color: var(--ui-text); }
.secondary { color: var(--ui-text-secondary); font-size: 12px; }
.el-table .el-button + .el-tooltip { margin-left: 8px; }
</style>
