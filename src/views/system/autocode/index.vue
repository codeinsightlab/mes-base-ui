<template>
  <div class="app-container">
    <PageHeader title="自动编码规则" description="通用编号规则、预览与生成" />
    <el-alert v-if="queryError" :title="queryError" type="error" :closable="false" show-icon class="mb8"><el-button size="small" @click="getList">重试</el-button></el-alert>
    <el-form v-show="showSearch" ref="queryForm" class="filter-panel" :model="queryParams" size="small" :inline="true" label-width="68px">
      <el-form-item label="规则名称" prop="ruleName">
        <el-input
          v-model="queryParams.ruleName"
          placeholder="请输入规则名称"
          clearable
          style="width: 240px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="规则编码" prop="ruleCode">
        <el-input
          v-model="queryParams.ruleCode"
          placeholder="请输入规则编码"
          clearable
          style="width: 240px"
          @keyup.enter="handleQuery"
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
        <el-button type="primary" icon="Search" size="small" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" size="small" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="table-toolbar mb8">
      <el-col :span="3">
        <el-button
          v-hasPermi="['system:autocode:rule:add']"
          type="primary"
          plain
          icon="Plus"
          size="small"
          @click="handleAdd"
        >新增</el-button>
      </el-col>
      <el-col :span="3">
        <el-button
          v-hasPermi="['system:autocode:rule:edit']"
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
          v-hasPermi="['system:autocode:rule:remove']"
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

    <el-dialog v-model="codeOpen" title="验证平台编码规则" width="520px" append-to-body>
      <p>规则：{{ codeRule.ruleName }}（{{ codeRule.ruleCode }}）</p>
      <el-input v-model="codeInput" maxlength="64" placeholder="输入字符（仅输入字符组成或按字符循环时需要）" />
      <el-alert v-if="generatedCode" :title="generatedCode" type="success" :closable="false" style="margin-top:16px" />
      <template #footer><el-button @click="codeOpen=false">关闭</el-button><el-button :loading="codeLoading" @click="testCode(false)">预览（不占用流水号）</el-button><el-button v-hasPermi="['system:autocode:rule:generate']" type="primary" :loading="codeLoading" @click="testCode(true)">生成并登记</el-button></template>
    </el-dialog>
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
          <span>{{ parseTime(scope.row.createTime) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" min-width="220" fixed="right" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-button v-hasPermi="['system:autocode:rule:query']" size="small" link @click="openCode(scope.row)">验证规则</el-button>
          <el-button
            v-hasPermi="['system:autocode:rule:edit']"
            size="small"
            link
            type="primary"
            icon="Edit"
            @click="handleUpdate(scope.row)"
          >修改</el-button>
          <el-button
            v-hasPermi="['system:autocode:rule:remove']"
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
    <el-dialog v-model="open" :title="title" width="500px" append-to-body>
      <el-form ref="form" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="规则编码" prop="ruleCode">
          <el-input v-model="form.ruleCode" placeholder="请输入规则编码" />
        </el-form-item>
        <el-form-item label="规则名称" prop="ruleName">
          <el-input v-model="form.ruleName" placeholder="请输入规则名称" />
        </el-form-item>
        <el-form-item label="描述" prop="ruleDesc">
          <el-input v-model="form.ruleDesc" placeholder="请输入描述信息" />
        </el-form-item>
        <el-form-item label="最大长度" prop="maxLength">
          <el-input-number v-model="form.maxLength" controls-position="right" :min="0" />
        </el-form-item>
        <el-form-item label="是否补齐" prop="isPadded">
          <el-radio-group v-model="form.isPadded">
            <el-radio value="Y">是</el-radio>
            <el-radio value="N">否</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="form.isPadded == 'Y'" label="补齐字符" prop="paddedChar">
          <el-input v-model="form.paddedChar" placeholder="请输入补齐字符" />
        </el-form-item>
        <el-form-item v-if="form.isPadded == 'Y'" label="补齐方式" prop="paddedMethod">
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
      <template #footer><div class="dialog-footer">
        <el-button type="primary" @click="submitForm">确 定</el-button>
        <el-button @click="cancel">取 消</el-button>
      </div></template>
    </el-dialog>
  </div>
</template>

<script>
import { sourceList } from '@/utils/sourceList'
import request from '@/utils/request'
import { listRule, getRule, delRule, addRule, updateRule } from '@/api/system/autocode/rule'

export default {
  name: 'AutoCodeRule',
  dicts: ['sys_yes_no'],
  data() {
    return {
      queryError: '',
      // 遮罩层
      loading: true, codeOpen: false, codeRule: {}, codeInput: '', generatedCode: '', codeLoading: false,
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
        ]
      }
    }
  },
  created() {
    this.getList()
  },
  methods: {
    openCode(row) { this.codeRule = row;this.codeInput = '';this.generatedCode = '';this.codeOpen = true },
    async testCode(persist) { this.codeLoading = true;try { const r = await request({ url: '/system/autocode/' + (persist ? 'generate' : 'preview'), method: 'post', data: { ruleCode: this.codeRule.ruleCode, inputCharacter: this.codeInput || null }, scope: 'platform' });this.generatedCode = r.data.code } finally { this.codeLoading = false } },
    /** 查询字典类型列表 */
    getList() {
      return sourceList(this, () => listRule(this.addDateRange(this.queryParams, this.dateRange)), response => {
        this.ruleList = response.rows
        this.total = response.total

      })
    },
    // 取消按钮
    cancel() {
      this.open = false
      this.reset()
    },
    // 表单重置
    reset() {
      this.form = {
        ruleId: undefined,
        ruleCode: undefined,
        ruleName: undefined,
        ruleDesc: undefined,
        maxLength: undefined,
        isPadded: 'N',
        enableFlag: 'Y',
        remark: undefined
      }
      this.resetForm('form')
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
    handleUpdate(row) {
      this.reset()
      const ruleId = row.ruleId || this.ids
      getRule(ruleId).then(response => {
        this.form = response.data
        this.open = true
        this.title = '修改编码规则'
      })
    },
    /** 提交按钮 */
    submitForm: function() {
      this.$refs['form'].validate(valid => {
        if (valid) {
          if (this.form.ruleId != undefined) {
            updateRule(this.form).then(response => {
              this.$modal.msgSuccess('修改成功')
              this.open = false
              this.getList()
            })
          } else {
            addRule(this.form).then(response => {
              this.$modal.msgSuccess('新增成功')
              this.open = false
              this.getList()
            })
          }
        }
      })
    },
    /** 删除按钮操作 */
    handleDelete(row) {
      debugger
      const ruleIds = row.ruleId || this.ids
      this.$modal.confirm('是否确认删除编码规则为"' + ruleIds + '"的数据项？').then(function() {
        return delRule(ruleIds)
      }).then(() => {
        this.getList()
        this.$modal.msgSuccess('删除成功')
      }).catch(() => {})
    },
    /** 刷新缓存按钮操作 */
    handleRefreshCache() {
      refreshCache().then(() => {
        this.$modal.msgSuccess('刷新成功')
      })
    }
  }
}
</script>
