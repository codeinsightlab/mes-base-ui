<template>
  <div class="app-container">
    <PageHeader section="MES BASE / SYSTEM" title="自动编码规则" description="一次保存规则与完整组成，预览不耗号" />
    <el-alert type="info" :closable="false" show-icon class="mb8" title="调用约定：规则编码就是 getDocNo(type) 的 type，无需额外传入前缀、日期或流水。此页预览全局规则时使用平台计数，正式平台取号也只推进平台计数；Factory业务取号按工厂独立计数。工厂专属规则仅可预览，正式取号由对应工厂业务流程执行。" />
    <el-alert v-if="queryError" :title="queryError" type="error" :closable="false" show-icon class="mb8"><el-button size="small" @click="getList">重试</el-button></el-alert>
    <QueryForm v-show="showSearch" ref="queryForm" class="filter-panel" :model="queryParams" size="small" :inline="true" label-width="68px" @submit="handleQuery">
      <el-form-item label="规则名称" prop="ruleName">
        <el-input
          v-model="queryParams.ruleName"
          placeholder="请输入规则名称"
          clearable
          style="width: 240px"
        />
      </el-form-item>
      <el-form-item label="规则编码" prop="ruleCode">
        <el-input
          v-model="queryParams.ruleCode"
          placeholder="请输入规则编码"
          clearable
          style="width: 240px"
        />
      </el-form-item>
      <el-form-item label="启用状态" prop="enableFlag">
        <el-select
          v-model="queryParams.enableFlag"
          placeholder="启用状态"
          clearable
          style="width: 240px"
        >
          <el-option
            v-for="dict in dict.type.sys_yes_no"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button native-type="submit" type="primary" icon="Search" size="small">搜索</el-button>
        <el-button native-type="button" icon="Refresh" size="small" @click="resetQuery">重置</el-button>
      </el-form-item>
    </QueryForm>

    <el-row :gutter="10" class="table-toolbar mb8">
      <el-col :span="3">
        <el-button
          v-if="can('system:autocode:rule:add')"
          type="primary"
          plain
          icon="Plus"
          size="small"
          @click="handleAdd"
        >新增</el-button>
      </el-col>
      <el-col :span="3">
        <el-button
          v-if="can('system:autocode:rule:edit')"
          type="success"
          plain
          icon="Edit"
          size="small"
          :disabled="single"
          @click="handleUpdate"
        >修改</el-button>
      </el-col>
      <el-col :span="3">
        <el-button
          v-if="can('system:autocode:rule:remove')"
          type="danger"
          plain
          icon="Delete"
          size="small"
          :disabled="multiple"
          @click="handleDelete"
        >删除</el-button>
      </el-col>
      <right-toolbar v-model:show-search="showSearch" @query-table="getList" />
    </el-row>

    <PageDialog v-model="codeOpen" title="平台配置验证" width="520px" append-to-body>
      <p>规则：{{ codeRule.ruleName }}（{{ codeRule.ruleCode }}）</p>
      <p>适用范围：{{ codeRule.factoryId ? factoryLabel(codeRule.factoryId) : '全局（此处使用平台计数，与各工厂业务计数独立）' }}</p>
      <p>调用参数：<code>getDocNo("{{ codeRule.ruleCode }}")</code></p>
      <el-input v-model="codeInput" maxlength="64" placeholder="平台通用规则输入字符（仅 INPUTCHAR 组成或按字符循环时需要）" />
      <el-alert v-if="codeError" :title="codeError" type="error" :closable="false" style="margin-top:16px" />
      <el-alert v-if="generatedCode" :title="generatedCode" type="success" :closable="false" style="margin-top:16px" />
      <el-alert v-if="codeRule.factoryId" title="工厂专属规则不能在平台页面正式取号；请在对应工厂的单据创建流程中验证。" type="info" :closable="false" style="margin-top:16px" />
      <template #footer><el-button @click="codeOpen=false">关闭</el-button><el-button :loading="codeLoading" @click="testCode(false)">预览（不占用流水号）</el-button><el-button v-if="!codeRule.factoryId && can('system:autocode:rule:generate')" type="primary" :loading="codeLoading" @click="testCode(true)">正式取号</el-button></template>
    </PageDialog>
    <el-table v-loading="loading" :data="ruleList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="规则编号" align="center" width="210px" prop="ruleCode">
        <template #default="scope">
          <router-link :to="'/system/autocode/parts/' + scope.row.ruleId" class="link-type">
            <span>{{ scope.row.ruleCode }}</span>
          </router-link>
        </template>
      </el-table-column>
      <el-table-column label="规则名称" align="center" prop="ruleName" :show-overflow-tooltip="true" />
      <el-table-column label="单据类型" align="center" prop="ruleType">
        <template #default="scope"><dict-tag :options="dict.type.sys_autocode_ruletype" :value="scope.row.ruleType" /></template>
      </el-table-column>
      <el-table-column label="适用工厂" align="center" min-width="180">
        <template #default="scope">{{ scope.row.factoryId ? factoryLabel(scope.row.factoryId) : '全局' }}</template>
      </el-table-column>
      <el-table-column label="最大长度" align="center" prop="maxLength" />
      <el-table-column label="是否补齐" align="center" prop="isPadded" />
      <el-table-column label="是否可用" align="center" prop="enableFlag">
        <template #default="scope">
          <dict-tag :options="dict.type.sys_yes_no" :value="scope.row.enableFlag" />
        </template>
      </el-table-column>
      <el-table-column label="备注" align="center" prop="remark" :show-overflow-tooltip="true" />
      <el-table-column label="创建时间" align="center" prop="createTime" width="180">
        <template #default="scope">
          <span class="data-datetime">{{ parseTime(scope.row.createTime) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" min-width="220" fixed="right" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-button v-if="can('system:autocode:rule:query')" size="small" link @click="openCode(scope.row)">验证规则</el-button>
          <el-button
            v-if="can('system:autocode:rule:edit')"
            size="small"
            link
            type="primary"
            icon="Edit"
            @click="handleUpdate(scope.row)"
          >修改</el-button>
          <el-button
            v-if="can('system:autocode:rule:remove')"
            size="small"
            link
            type="primary"
            icon="Delete"
            @click="handleDelete(scope.row)"
          >删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination
      v-show="total>0"
      v-model:page="queryParams.pageNum"
      v-model:limit="queryParams.pageSize"
      :total="total"
      @pagination="getList"
    />

    <!-- 添加或修改参数配置对话框 -->
    <PageDialog v-model="open" :title="title" width="min(760px, 96vw)" append-to-body :before-close="beforeCloseEditor" @closed="reset">
      <el-alert v-if="saveError" :title="saveError" type="error" :closable="false" show-icon class="mb8" />
      <el-form ref="form" :model="form" :rules="rules" label-width="100px" :disabled="saving">
        <el-form-item label="规则编码" prop="ruleCode">
          <el-input v-model="form.ruleCode" :disabled="form.ruleId != undefined" placeholder="请输入规则编码" maxlength="64" />
          <p v-if="form.ruleId != undefined" class="secondary">规则编码是 getDocNo(type) 的业务身份；普通编辑不改码。</p>
        </el-form-item>
        <el-form-item label="规则名称" prop="ruleName">
          <el-input v-model="form.ruleName" placeholder="请输入规则名称" />
        </el-form-item>
        <el-form-item label="单据类型" prop="ruleType">
          <el-select v-model="form.ruleType" :disabled="form.ruleId != undefined && !!form.ruleType" placeholder="选择固定单据类型">
            <el-option v-for="item in dict.type.sys_autocode_ruletype" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="适用工厂" prop="factoryId">
          <el-select v-model="form.factoryId" :loading="factoryOptionsLoading" :disabled="factoryOptionsLoading" style="width:100%" placeholder="全局（适用于所有工厂）">
            <el-option label="全局（适用于所有工厂）" value="" />
            <el-option v-for="factory in factoryOptions" :key="factory.factoryId" :label="`${factory.factoryName}（${factory.factoryId}）${factory.status === 'ENABLED' ? '' : ' · 已停用'}`" :value="factory.factoryId" :disabled="factory.status !== 'ENABLED'" />
          </el-select>
          <p v-if="factoryOptionsError" class="secondary" role="alert">{{ factoryOptionsError }} <el-button link size="small" @click="loadFactoryOptions">重试</el-button></p>
          <p v-else class="secondary">工厂专属规则只供该工厂使用；留空范围（全局）适用于所有工厂。</p>
        </el-form-item>
        <el-form-item label="描述" prop="ruleDesc">
          <el-input v-model="form.ruleDesc" placeholder="请输入描述信息" />
        </el-form-item>
        <el-form-item label="最大长度" prop="maxLength">
          <el-input-number v-model="form.maxLength" controls-position="right" :min="1" :max="64" />
        </el-form-item>
        <el-form-item v-if="!prefixEditable" label="是否补齐" prop="isPadded">
          <el-radio-group v-model="form.isPadded">
            <el-radio value="Y">是</el-radio>
            <el-radio value="N">否</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="!prefixEditable && form.isPadded == 'Y'" label="补齐字符" prop="paddedChar">
          <el-input v-model="form.paddedChar" placeholder="请输入补齐字符" />
        </el-form-item>
        <el-form-item v-if="!prefixEditable && form.isPadded == 'Y'" label="补齐方式" prop="paddedMethod">
          <el-radio-group v-model="form.paddedMethod">
            <el-radio value="L">左补齐</el-radio>
            <el-radio value="R">右补齐</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="是否启用" prop="enableFlag">
          <el-radio-group v-model="form.enableFlag">
            <el-radio
              v-for="dict in dict.type.sys_yes_no"
              :key="dict.value"
              :value="dict.value"
            >{{ dict.label }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="form.remark" type="textarea" placeholder="请输入内容" />
        </el-form-item>
      </el-form>
      <section aria-label="规则组成">
        <h3>规则组成</h3>
        <template v-if="prefixEditable">
          <DocumentFields :fields="compositionFields" :draft="composition" :disabled="saving" @submit="submitForm" />
          <el-alert title="前缀 + 服务端 Asia/Shanghai 日期 yyyyMMdd + 每日流水；起始1、步长1、每日重置、最小宽度3，999后自然增长为1000。编辑前缀保持原规则ID和已有流水；历史单号保持原文。" type="info" :closable="false" show-icon />
        </template>
        <template v-else>
          <el-alert title="此规则使用高级组成。本表单仅保存规则信息，所有组成保持原样；修改组成请进入高级组成页。" type="info" :closable="false" />
          <el-table :data="configuredParts" size="small"><el-table-column prop="partIndex" label="顺序" /><el-table-column prop="partName" label="名称" /><el-table-column prop="partType" label="类型" /><el-table-column prop="partLength" label="长度" /></el-table>
        </template>
      </section>
      <template #footer><div class="dialog-footer">
        <el-button type="primary" :loading="saving" @click="submitForm">保存规则及组成</el-button>
        <el-button @click="cancel">取 消</el-button>
      </div></template>
    </PageDialog>
  </div>
</template>

<script>
import PageDialog from '@/components/page/PageDialog.vue'

import QueryForm from '@/components/QueryForm.vue'
import DocumentFields from '@/components/document/DocumentFields.vue'
import { useAuth } from '@/stores/auth'

import { sourceList } from '@/utils/sourceList'
import { listRule, getRuleDocument, delRule, addRule, updateRule, genCode, previewCode } from '@/api/system/autocode/rule'
import { listFactories } from '@/api/system/datasource'

const GLOBAL_RULE_SCOPE = ''

export default {
  name: 'AutoCodeRule',
  components: { PageDialog, QueryForm, DocumentFields },
  setup() { return { auth: useAuth() } },
  dicts: ['sys_yes_no', 'sys_autocode_ruletype'],
  data() {
    return {
      saving: false, saveError: '', editorAttempt: 0, savedEditor: '', version: '', prefixEditable: true, configuredParts: [], composition: { prefix: '' },
      compositionFields: [{ key: 'prefix', label: '固定前缀', kind: 'text', required: true, maxLength: 53 }],
      queryError: '', factoryOptions: [], factoryOptionsLoading: false, factoryOptionsError: '', factoryOptionsAttempt: 0,
      // 遮罩层
      loading: true, codeOpen: false, codeRule: {}, codeInput: '', generatedCode: '', codeLoading: false, codeError: '', codeAttempt: 0,
      // 选中数组
      ids: [],
      // 非单个禁用
      single: true,
      // 非多个禁用
      multiple: true,
      // 显示搜索条件
      showSearch: true,
      // 总条数
      total: 0,
      // 字典表格数据
      ruleList: [],
      // 弹出层标题
      title: '',
      // 是否显示弹出层
      open: false,
      // 日期范围
      dateRange: [],
      // 查询参数
      queryParams: {
        pageNum: 1,
        pageSize: 10,
        ruleCode: undefined,
        ruleName: undefined,
        enableFlag: 'Y'
      },
      // 表单参数
      form: {},
      // 表单校验
      rules: {
        ruleCode: [
          { required: true, message: '规则编码不能为空', trigger: 'blur' }
        ],
        ruleName: [
          { required: true, message: '规则名称不能为空', trigger: 'blur' }
        ],
        ruleType: [
          { required: true, message: '单据类型不能为空', trigger: 'change' }
        ]
      }
    }
  },
  computed: {
    accessRevision() { return `${this.auth.revision}:${this.auth.factoryId}:${this.auth.platformPermissions.join('|')}` }
  },
  watch: {
    accessRevision() { this.editorAttempt++; this.codeAttempt++; this.open = false; this.codeOpen = false; this.generatedCode = ''; this.ruleList = []; this.total = 0; this.reset(); if (this.can('system:autocode:rule:list')) this.getList() },
    codeOpen(value) { if (!value) { this.codeAttempt++; this.codeLoading = false; this.generatedCode = ''; this.codeError = '' } }
  },
  created() {
    this.getList()
    this.loadFactoryOptions()
  },
  beforeUnmount() {
    this.factoryOptionsAttempt++
    this.editorAttempt++
  },
  methods: {
    can(permission) { return this.auth.hasPermission(permission, 'platform') },
    editorSnapshot() { return JSON.stringify({ form: this.form, composition: this.composition }) },
    async beforeCloseEditor(done) {
      if (this.saving) return
      if (this.editorSnapshot() !== this.savedEditor) {
        try { await this.$modal.confirm('有未保存的规则配置，确认放弃修改？') } catch { return }
      }
      this.editorAttempt++
      done()
    },
    factoryLabel(factoryId) {
      const factory = this.factoryOptions.find(item => String(item.factoryId) === String(factoryId))
      return factory ? `${factory.factoryName}（${factory.factoryId}）` : `工厂 ${factoryId}`
    },
    async loadFactoryOptions() {
      const attempt = (this.factoryOptionsAttempt || 0) + 1
      this.factoryOptionsAttempt = attempt
      this.factoryOptionsLoading = true
      this.factoryOptionsError = ''
      try {
        const rows = []
        let pageNum = 1
        let total = 0
        do {
          const page = await listFactories({ pageNum, pageSize: 100 })
          if (attempt !== this.factoryOptionsAttempt) return
          rows.push(...(page.rows || []))
          total = Number(page.total || 0)
          pageNum++
        } while (rows.length < total)
        this.factoryOptions = rows
      } catch(error) {
        if (attempt === this.factoryOptionsAttempt) this.factoryOptionsError = error instanceof Error ? error.message : '工厂列表读取失败'
      } finally {
        if (attempt === this.factoryOptionsAttempt) this.factoryOptionsLoading = false
      }
    },
    openCode(row) { this.codeAttempt++; this.codeRule = row;this.codeInput = '';this.generatedCode = '';this.codeError = '';this.codeOpen = true },
    async testCode(persist) {
      if (this.codeLoading || !this.can(persist ? 'system:autocode:rule:generate' : 'system:autocode:rule:query')) return
      const attempt = ++this.codeAttempt
      this.codeLoading = true; this.generatedCode = ''; this.codeError = ''
      try {
        const response = persist ? await genCode(this.codeRule.ruleCode, this.codeInput || null) : await previewCode(this.codeRule.ruleCode, this.codeInput || null)
        if (attempt === this.codeAttempt && this.codeOpen) this.generatedCode = response.data.code
      } catch(error) {
        if (attempt === this.codeAttempt && this.codeOpen) this.codeError = error instanceof Error ? error.message : '编码验证失败'
      } finally { if (attempt === this.codeAttempt) this.codeLoading = false }
    },
    /** 查询字典类型列表 */
    getList() {
      return sourceList(this, () => listRule(this.addDateRange(this.queryParams, this.dateRange)), response => {
        this.ruleList = response.rows
        this.total = response.total

      })
    },
    // 取消按钮
    cancel() { return this.beforeCloseEditor(() => { this.open = false }) },
    // 表单重置
    reset() {
      this.editorAttempt++
      this.version = ''; this.saveError = ''; this.saving = false; this.prefixEditable = true; this.configuredParts = []; this.composition = { prefix: '' }
      this.form = {
        ruleId: undefined,
        ruleCode: undefined,
        ruleType: undefined,
        factoryId: GLOBAL_RULE_SCOPE,
        ruleName: undefined,
        ruleDesc: undefined,
        maxLength: 64,
        isPadded: 'N',
        enableFlag: 'Y',
        remark: undefined
      }
      this.resetForm('form')
      this.savedEditor = this.editorSnapshot()
    },
    /** 搜索按钮操作 */
    handleQuery() {
      this.queryParams.pageNum = 1
      this.getList()
    },
    /** 重置按钮操作 */
    resetQuery() {
      this.dateRange = []
      this.resetForm('queryForm')
      this.handleQuery()
    },
    /** 新增按钮操作 */
    handleAdd() {
      if (!this.can('system:autocode:rule:add')) return
      this.reset()
      this.open = true
      this.title = '添加编码规则'
    },
    // 多选框选中数据
    handleSelectionChange(selection) {
      this.ids = selection.map(item => item.ruleId)
      this.single = selection.length != 1
      this.multiple = !selection.length
    },
    /** 修改按钮操作 */
    async handleUpdate(row) {
      if (!this.can('system:autocode:rule:edit')) return
      this.reset()
      const attempt = this.editorAttempt
      const ruleId = row.ruleId || this.ids[0]
      try {
        const response = await getRuleDocument(ruleId)
        if (attempt !== this.editorAttempt) return
        this.form = { ...response.data.rule, factoryId: response.data.rule.factoryId || GLOBAL_RULE_SCOPE }
        this.configuredParts = response.data.parts
        this.prefixEditable = response.data.prefixEditable
        this.composition.prefix = response.data.parts[0]?.fixCharacter || ''
        this.version = response.data.version
        this.savedEditor = this.editorSnapshot()
        this.open = true
        this.title = '修改编码规则'
      } catch(error) { if (attempt === this.editorAttempt) this.$modal.msgError(error instanceof Error ? error.message : '规则加载失败') }
    },
    /** One HTTP command saves header and standard parts in the center transaction. */
    async submitForm() {
      if (this.saving || !this.can(this.form.ruleId ? 'system:autocode:rule:edit' : 'system:autocode:rule:add')) return
      if (!await this.$refs.form.validate().catch(() => false)) return
      if (this.prefixEditable && !this.composition.prefix.trim()) { this.saveError = '请填写固定前缀'; return }
      const attempt = this.editorAttempt
      this.saving = true
      this.saveError = ''
      try {
        const rule = { ...this.form, factoryId: this.form.factoryId === GLOBAL_RULE_SCOPE ? null : this.form.factoryId }
        const payload = { rule, prefix: this.prefixEditable ? this.composition.prefix : null, version: this.version || null }
        const response = this.form.ruleId ? await updateRule(payload) : await addRule(payload)
        if (attempt !== this.editorAttempt) return
        this.$modal.msgSuccess('规则及组成已保存，可立即预览')
        this.openCode(response.data.rule)
        this.open = false
        await this.getList()
      } catch(error) {
        if (attempt === this.editorAttempt) this.saveError = error instanceof Error ? error.message : '规则保存失败'
      } finally { if (attempt === this.editorAttempt) this.saving = false }
    },
    /** 删除按钮操作 */
    handleDelete(row) {
      const ruleIds = row.ruleId || this.ids
      this.$modal.confirm('是否确认删除编码规则为"' + ruleIds + '"的数据项？').then(function() {
        return delRule(ruleIds)
      }).then(() => {
        this.getList()
        this.$modal.msgSuccess('删除成功')
      }).catch(() => {})
    }
  }
}
</script>
