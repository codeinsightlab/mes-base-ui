<template>
  <div class="app-container">
    <PageHeader title="用户管理" description="组织账号与人员信息" />
    <el-alert v-if="queryError" :title="queryError" type="error" :closable="false" show-icon class="mb8"><el-button size="small" @click="getList">重试</el-button></el-alert>
    <el-row :gutter="20" class="user-content-layout">
      <!--部门数据-->
      <el-col :span="5" :xs="24" class="user-tree-panel"><h2 class="tree-heading">部门导航</h2>
        <div class="head-container">
          <el-input
            v-model="deptName"
            placeholder="请输入部门名称"
            clearable
            size="small"
            prefix-icon="Search"
            style="margin-bottom: 20px"
          />
        </div>
        <div class="head-container">
          <el-tree
            ref="tree"
            :data="deptOptions"
            :props="defaultProps"
            :expand-on-click-node="false"
            :filter-node-method="filterNode"
            default-expand-all
            @node-click="handleNodeClick"
          />
        </div>
      </el-col>
      <!--用户数据-->
      <el-col :span="19" :xs="24">
        <el-form
          v-show="showSearch"
          ref="queryForm"
          class="filter-panel"
          :model="queryParams"
          size="small"
          :inline="true"
          label-width="68px"
        >
          <el-form-item label="用户名称" prop="userName">
            <el-input
              v-model="queryParams.userName"
              placeholder="请输入用户名称"
              clearable
              style="width: 240px"
              @keyup.enter="handleQuery"
            />
          </el-form-item>
          <el-form-item label="用户昵称" prop="nickName">
            <el-input
              v-model="queryParams.nickName"
              placeholder="请输入用户昵称"
              clearable
              style="width: 240px"
              @keyup.enter="handleQuery"
            />
          </el-form-item>
          <el-form-item label="手机号码" prop="phonenumber">
            <el-input
              v-model="queryParams.phonenumber"
              placeholder="请输入手机号码"
              clearable
              style="width: 240px"
              @keyup.enter="handleQuery"
            />
          </el-form-item>
          <el-form-item label="状态" prop="status">
            <DictSelect v-model="queryParams.status" code="sys_normal_disable" placeholder="用户状态" clearable style="width: 240px" />
          </el-form-item>
          <el-form-item label="创建时间">
            <el-date-picker
              v-model="dateRange"
              style="width: 240px"
              value-format="YYYY-MM-DD"
              type="daterange"
              range-separator="-"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" icon="Search" size="small" @click="handleQuery">搜索</el-button>
            <el-button icon="Refresh" size="small" @click="resetQuery">重置</el-button>
          </el-form-item>
        </el-form>

        <el-row :gutter="10" class="table-toolbar mb8">
          <el-col :span="3">
            <el-button
              v-hasPermi="['system:user:add']"
              type="primary"
              plain
              icon="Plus"
              size="small"
              @click="handleAdd"
            >新增</el-button>
          </el-col>
          <el-col :span="3">
            <el-button
              v-hasPermi="['system:user:edit']"
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
              v-hasPermi="['system:user:remove']"
              type="danger"
              plain
              icon="Delete"
              size="small"
              :disabled="multiple"
              @click="handleDelete"
            >删除</el-button>
          </el-col>
          <el-col :span="3">
            <el-button
              v-hasPermi="['system:user:import']"
              type="info"
              plain
              icon="Upload"
              size="small"
              @click="handleImport"
            >导入</el-button>
          </el-col>
          <el-col :span="3">
            <el-button
              v-hasPermi="['system:user:export']"
              type="warning"
              plain
              icon="Download"
              size="small"
              @click="handleExport"
            >导出</el-button>
          </el-col>
          <right-toolbar v-model:show-search="showSearch" :columns="columns" @query-table="getList" />
        </el-row>

        <el-table v-loading="loading" :data="userList" @selection-change="handleSelectionChange">
          <el-table-column type="selection" width="50" align="center" />
          <el-table-column v-if="columns[0].visible" key="userId" label="用户编号" align="center" min-width="90" prop="userId" />
          <el-table-column
            v-if="columns[1].visible"
            key="userName"
            label="用户名称"
            align="center"
            min-width="150"
            prop="userName"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            v-if="columns[2].visible"
            key="nickName"
            label="用户昵称"
            align="center"
            min-width="150"
            prop="nickName"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            v-if="columns[3].visible"
            key="deptName"
            label="部门"
            align="center"
            min-width="150"
            prop="dept.deptName"
            :show-overflow-tooltip="true"
          />
          <el-table-column
            v-if="columns[4].visible"
            key="phonenumber"
            label="手机号码"
            align="center"
            prop="phonenumber"
            width="120"
          />
          <el-table-column v-if="columns[5].visible" key="status" label="状态" align="center" min-width="110">
            <template #default="scope">
              <el-switch
                v-model="scope.row.status"
                inline-prompt
                active-text="正常"
                inactive-text="停用"
                :width="56"
                active-value="0"
                inactive-value="1"
                :aria-label="scope.row.userName+'：'+(scope.row.status==='0'?'正常':'停用')"
                @change="handleStatusChange(scope.row)"
              />
            </template>
          </el-table-column>
          <el-table-column v-if="columns[6].visible" label="创建时间" align="center" prop="createTime" width="160">
            <template #default="scope">
              <span>{{ parseTime(scope.row.createTime) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" align="center" width="186" fixed="right" class-name="small-padding fixed-width">
            <template v-if="true" #default="scope">
              <el-button
                v-hasPermi="['system:user:edit']"
                size="small"
                link
                icon="Edit"
                @click="handleUpdate(scope.row)"
              >修改</el-button>
              <el-button
                v-hasPermi="['system:user:remove']"
                size="small"
                link
                icon="Delete"
                @click="handleDelete(scope.row)"
              >删除</el-button>
              <el-dropdown
                v-hasPermi="['system:user:resetPwd', 'system:user:edit']"
                size="small"
                @command="(command) => handleCommand(command, scope.row)"
              >
                <span class="el-dropdown-link">
                  <el-icon><ArrowDown /></el-icon>更多
                </span>
                <template #dropdown><el-dropdown-menu>
                  <el-dropdown-item
                    v-if="hasPermi(['system:user:resetPwd'])"
                    command="handleResetPwd"
                    icon="Key"
                  >重置密码</el-dropdown-item>
                  <el-dropdown-item
                    v-if="hasPermi(['system:user:edit'])"
                    command="handleAuthRole"
                    icon="CircleCheck"
                  >分配角色</el-dropdown-item>
                </el-dropdown-menu></template>
              </el-dropdown>
            </template>
          </el-table-column>
        </el-table>

        <pagination
          v-show="total > 0"
          v-model:page="queryParams.pageNum"
          v-model:limit="queryParams.pageSize"
          :total="total"
          @pagination="getList"
        />
      </el-col>
    </el-row>

    <!-- 添加或修改用户配置对话框 -->
    <el-dialog v-model="open" :title="title" width="600px" append-to-body>
      <el-form ref="form" :model="form" :rules="rules" label-width="80px">
        <el-row>
          <el-col :span="12">
            <el-form-item label="用户昵称" prop="nickName">
              <el-input v-model="form.nickName" placeholder="请输入用户昵称" maxlength="30" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="归属部门" prop="deptId">
              <treeselect v-model="form.deptId" :options="deptOptions" :show-count="true" placeholder="请选择归属部门" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="12">
            <el-form-item label="手机号码" prop="phonenumber">
              <el-input v-model="form.phonenumber" placeholder="请输入手机号码" maxlength="11" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="邮箱" prop="email">
              <el-input v-model="form.email" placeholder="请输入邮箱" maxlength="50" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="12">
            <el-form-item v-if="form.userId == undefined" label="用户名称" prop="userName">
              <el-input v-model="form.userName" placeholder="请输入用户名称" maxlength="30" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item v-if="form.userId == undefined" label="用户密码" prop="password">
              <el-input v-model="form.password" placeholder="请输入用户密码" type="password" maxlength="128" show-password />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="12">
            <el-form-item label="用户性别">
              <el-select v-model="form.sex" placeholder="请选择性别">
                <el-option
                  v-for="dict in dict.type.sys_user_sex"
                  :key="dict.value"
                  :label="dict.label"
                  :value="dict.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态">
              <el-radio-group v-model="form.status">
                <el-radio
                  v-for="dict in dict.type.sys_normal_disable"
                  :key="dict.value"
                  :value="dict.value"
                >{{ dict.label }}</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="12">
            <el-form-item label="岗位">
              <el-select v-model="form.postIds" multiple placeholder="请选择岗位">
                <el-option
                  v-for="item in postOptions"
                  :key="item.postId"
                  :label="item.postName"
                  :value="item.postId"
                  :disabled="item.status == 1"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="角色">
              <el-select v-model="form.roleIds" multiple placeholder="请选择角色">
                <el-option
                  v-for="item in roleOptions"
                  :key="item.roleId"
                  :label="item.roleName"
                  :value="item.roleId"
                  :disabled="item.status == 1"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="24">
            <el-form-item label="备注">
              <el-input v-model="form.remark" type="textarea" placeholder="请输入内容" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer><div class="dialog-footer">
        <el-button type="primary" @click="submitForm">确 定</el-button>
        <el-button @click="cancel">取 消</el-button>
      </div></template>
    </el-dialog>

    <!-- 用户导入对话框 -->
    <el-dialog v-model="upload.open" :title="upload.title" width="400px" append-to-body>
      <el-form-item label="新用户初始密码"><el-input v-model="upload.initialPassword" type="password" show-password placeholder="仅用于本次导入" /></el-form-item>
      <el-upload
        ref="upload"
        :limit="1"
        accept=".xlsx, .xls"
        :http-request="importUsers"
        :action="upload.url + '?updateSupport=' + upload.updateSupport"
        :disabled="upload.isUploading"
        :on-progress="handleFileUploadProgress"
        :on-success="handleFileSuccess"
        :auto-upload="false"
        drag
      >
        <el-icon><UploadFilled /></el-icon>
        <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
        <template #tip><div class="el-upload__tip text-center">
          <div class="el-upload__tip">
            <el-checkbox v-model="upload.updateSupport" /> 是否更新已经存在的用户数据
          </div>
          <span>仅允许导入xls、xlsx格式文件。</span>
          <el-link
            type="primary"
            :underline="false"
            style="font-size:12px;vertical-align: baseline;"
            @click="importTemplate"
          >下载模板</el-link>
        </div></template>
      </el-upload>
      <template #footer><div class="dialog-footer">
        <el-button type="primary" @click="submitFileForm">确 定</el-button>
        <el-button @click="upload.open = false">取 消</el-button>
      </div></template>
    </el-dialog>
  </div>
</template>

<script>
import { sourceList } from '@/utils/sourceList'
import { listUser, getUser, delUser, addUser, updateUser, resetUserPwd, changeUserStatus } from '@/api/system/user'
import request from '@/utils/request'
import { useAuth } from '@/stores/auth'
import { passwordError } from '@/utils/passwordPolicy'
import { getToken } from '@/utils/auth'
import { treeselect } from '@/api/system/dept'
import Treeselect from '@/components/Treeselect/index.vue'
import DictSelect from '@/components/DictSelect.vue'

export default {
  name: 'User',
  dicts: ['sys_normal_disable', 'sys_user_sex'],
  components: { Treeselect, DictSelect },
  data() {
    const policy = useAuth().passwordPolicy
    return {
      passwordPolicy: policy,
      queryError: '',
      // 遮罩层
      loading: true,
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
      // 用户表格数据
      userList: null,
      // 弹出层标题
      title: '',
      // 部门树选项
      deptOptions: undefined,
      // 是否显示弹出层
      open: false,
      // 部门名称
      deptName: undefined,
      // 默认密码
      initPassword: undefined,
      // 日期范围
      dateRange: [],
      // 岗位选项
      postOptions: [],
      // 角色选项
      roleOptions: [],
      // 表单参数
      form: {},
      defaultProps: {
        children: 'children',
        label: 'label'
      },
      // 用户导入参数
      upload: {
        // 是否显示弹出层（用户导入）
        open: false,
        // 弹出层标题（用户导入）
        title: '',
        // 是否禁用上传
        isUploading: false,
        // 是否更新已经存在的用户数据
        updateSupport: 0, initialPassword: '',
        // 设置上传的请求头部
        headers: { Authorization: 'Bearer ' + getToken() },
        // 上传的地址
        url: '/api' + '/system/user/importData'
      },
      // 查询参数
      queryParams: {
        pageNum: 1,
        pageSize: 10,
        userName: undefined,
        phonenumber: undefined,
        status: undefined,
        deptId: undefined,
        nickName: undefined
      },
      // 列信息
      columns: [
        { key: 0, label: `用户编号`, visible: true },
        { key: 1, label: `用户名称`, visible: true },
        { key: 2, label: `用户昵称`, visible: true },
        { key: 3, label: `部门`, visible: true },
        { key: 4, label: `手机号码`, visible: true },
        { key: 5, label: `状态`, visible: true },
        { key: 6, label: `创建时间`, visible: true }
      ],
      // 表单校验
      rules: {
        userName: [
          { required: true, message: '用户名称不能为空', trigger: 'blur' },
          { min: 2, max: 30, message: '用户名称长度必须介于 2 和 30 之间', trigger: 'blur' }
        ],
        nickName: [
          { required: true, message: '用户昵称不能为空', trigger: 'blur' }
        ],
        password: [
          { required: true, message: '用户密码不能为空', trigger: 'blur' },
          { validator: (_rule, value, callback) => { const message = passwordError(value || '', policy);callback(message ? new Error(message) : undefined) }, trigger: 'blur' }
        ],
        email: [
          {
            type: 'email',
            message: '请输入正确的邮箱地址',
            trigger: ['blur', 'change']
          }
        ],
        phonenumber: [
          {
            pattern: /^1[3|4|5|6|7|8|9][0-9]\d{8}$/,
            message: '请输入正确的手机号码',
            trigger: 'blur'
          }
        ]
      }
    }
  },
  watch: {
    // 根据名称筛选部门树
    deptName(val) {
      this.$refs.tree.filter(val)
    }
  },
  created() {
    this.getList()
    this.getTreeselect()

  },
  methods: {
    /** 查询用户列表 */
    getList() {
      return sourceList(this, () => listUser(this.addDateRange(this.queryParams, this.dateRange)), response => {
        this.userList = response.rows
        this.total = response.total

      })
    },
    /** 查询部门下拉树结构 */
    getTreeselect() {
      treeselect().then(response => {
        // debugger;
        this.deptOptions = response.data
      })
    },
    // 筛选节点
    filterNode(value, data) {
      if (!value) return true
      return data.label.indexOf(value) !== -1
    },
    // 节点单击事件
    handleNodeClick(data) {
      this.queryParams.deptId = data.id
      this.handleQuery()
    },
    // 用户状态修改
    handleStatusChange(row) {
      let text = row.status === '0' ? '启用' : '停用'
      this.$modal.confirm('确认要"' + text + '""' + row.userName + '"用户吗？').then(function() {
        return changeUserStatus(row.userId, row.status)
      }).then(() => {
        this.$modal.msgSuccess(text + '成功')
      }).catch(function() {
        row.status = row.status === '0' ? '1' : '0'
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
        userId: undefined,
        deptId: undefined,
        userName: undefined,
        nickName: undefined,
        password: undefined,
        phonenumber: undefined,
        email: undefined,
        sex: undefined,
        status: '0',
        remark: undefined,
        postIds: [],
        roleIds: []
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
    // 多选框选中数据
    handleSelectionChange(selection) {
      this.ids = selection.map(item => item.userId)
      this.single = selection.length != 1
      this.multiple = !selection.length
    },
    // 更多操作触发
    handleCommand(command, row) {
      switch (command) {
        case 'handleResetPwd':
          this.handleResetPwd(row)
          break
        case 'handleAuthRole':
          this.handleAuthRole(row)
          break
        default:
          break
      }
    },
    /** 新增按钮操作 */
    handleAdd() {
      this.reset()
      this.getTreeselect()
      getUser().then(response => {
        this.postOptions = response.posts
        this.roleOptions = response.roles
        this.open = true
        this.title = '添加用户'
        this.form.password = ''
      })
    },
    /** 修改按钮操作 */
    handleUpdate(row) {
      this.reset()
      this.getTreeselect()
      const userId = row.userId || this.ids
      getUser(userId).then(response => {
        this.form = response.data
        this.postOptions = response.posts
        this.roleOptions = response.roles
        this.form.postIds = response.postIds
        this.form.roleIds = response.roleIds
        this.open = true
        this.title = '修改用户'
        this.form.password = ''
      })
    },
    /** 重置密码按钮操作 */
    handleResetPwd(row) {
      this.$prompt('请输入"' + row.userName + '"的新密码', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        closeOnClickModal: false,
        inputType: 'password',
        inputValidator: value => passwordError(value, this.passwordPolicy) || true
      }).then(({ value }) => {
        resetUserPwd(row.userId, value).then(response => {
          this.$modal.msgSuccess('密码已重置，原有会话已撤销')
        })
      }).catch(() => { })
    },
    /** 分配角色操作 */
    handleAuthRole: function(row) {
      const userId = row.userId
      this.$router.push('/system/user-auth/role/' + userId)
    },
    /** 提交按钮 */
    submitForm: function() {
      this.$refs['form'].validate(valid => {
        if (valid) {
          if (this.form.userId != undefined) {
            updateUser(this.form).then(response => {
              this.$modal.msgSuccess('修改成功')
              this.open = false
              this.getList()
            })
          } else {
            addUser(this.form).then(response => {
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
      const userIds = row.userId || this.ids
      this.$modal.confirm('是否确认删除用户编号为"' + userIds + '"的数据项？').then(function() {
        return delUser(userIds)
      }).then(() => {
        this.getList()
        this.$modal.msgSuccess('删除成功')
      }).catch(() => { })
    },
    /** 导出按钮操作 */
    handleExport() {
      this.download('system/user/export', {
        ...this.queryParams
      }, `user_${new Date().getTime()}.xlsx`)
    },
    /** 导入按钮操作 */
    handleImport() {
      this.upload.title = '用户导入'
      this.upload.open = true
    },
    /** 下载模板操作 */
    async importUsers({ file, onSuccess, onError }) { this.upload.isUploading = true;try { const data = new FormData();data.set('file', file);data.set('updateSupport', String(!!this.upload.updateSupport));data.set('initialPassword', this.upload.initialPassword);const response = await request({ url: '/system/user/importData', method: 'post', data });onSuccess(response) } catch(error) { onError(error) } finally { this.upload.isUploading = false } },
    importTemplate() {
      this.download('system/user/importTemplate', {
      }, `user_template_${new Date().getTime()}.xlsx`)
    },
    // 文件上传中处理
    handleFileUploadProgress(event, file, fileList) {
      this.upload.isUploading = true
    },
    // 文件上传成功处理
    handleFileSuccess(response, file, fileList) {
      this.upload.open = false
      this.upload.isUploading = false
      this.$refs.upload.clearFiles()
      this.$alert("<div style='overflow: auto;overflow-x: hidden;max-height: 70vh;padding: 10px 20px 0;'>" + response.msg + '</div>', '导入结果', { dangerouslyUseHTMLString: false })
      this.getList()
    },
    // 提交上传文件
    submitFileForm() {
      const invalid = passwordError(this.upload.initialPassword, this.passwordPolicy);if (invalid) { this.$modal.msgError(invalid);return } this.$refs.upload.submit()
    }
  }
}
</script>
