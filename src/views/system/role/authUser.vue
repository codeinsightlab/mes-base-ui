<template>
  <div class="app-container">
    <PageHeader section="MES BASE / SYSTEM" title="授权用户" description="角色关联用户" />
    <el-alert v-if="queryError" :title="queryError" type="error" :closable="false" show-icon class="mb8"><el-button size="small" @click="getList">重试</el-button></el-alert>
    <el-form v-show="showSearch" ref="queryForm" class="filter-panel" :model="queryParams" size="small" :inline="true">
      <el-form-item label="用户名称" prop="userName">
        <el-input
          v-model="queryParams.userName"
          placeholder="请输入用户名称"
          clearable
          style="width: 240px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="部门" prop="deptId">
        <!-- <el-input
          v-model="queryParams.deptId"
          placeholder="请输入部门名称"
          clearable
          style="width: 240px"
          @keyup.enter="handleQuery"
        /> -->
        <el-cascader
          v-model="queryParams.deptId"
          :options="deptOptions"
          :props="{ expandTrigger: 'hover' ,label:'label',value:'id'}"
          @keyup.enter="handleQuery"
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
          v-hasPermi="['system:role:add']"
          type="primary"
          plain
          icon="Plus"
          size="small"
          @click="openSelectUser"
        >添加用户</el-button>
      </el-col>
      <el-col :span="3">
        <el-button
          v-hasPermi="['system:role:remove']"
          type="danger"
          plain
          icon="CircleClose"
          size="small"
          :disabled="multiple"
          @click="cancelAuthUserAll"
        >批量取消授权</el-button>
      </el-col>
      <el-col :span="3">
        <el-button
          type="warning"
          plain
          icon="Close"
          size="small"
          @click="handleClose"
        >关闭</el-button>
      </el-col>
      <right-toolbar v-model:show-search="showSearch" @query-table="getList" />
    </el-row>

    <el-table v-loading="loading" :data="userList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="用户名称" prop="userName" :show-overflow-tooltip="true" />
      <el-table-column label="用户昵称" prop="nickName" :show-overflow-tooltip="true" />
      <el-table-column label="邮箱" prop="email" :show-overflow-tooltip="true" />
      <el-table-column label="手机" prop="phonenumber" :show-overflow-tooltip="true" />
      <el-table-column label="状态" align="center" prop="status">
        <template #default="scope">
          <dict-tag status :options="dict.type.sys_normal_disable" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="创建时间" align="center" prop="createTime" width="180">
        <template #default="scope">
          <span>{{ parseTime(scope.row.createTime) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" min-width="120" fixed="right" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-button
            v-hasPermi="['system:role:remove']"
            size="small"
            link
            icon="CircleClose"
            @click="cancelAuthUser(scope.row)"
          >取消授权</el-button>
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
    <select-user ref="select" :role-id="queryParams.roleId" @ok="handleQuery" />
  </div>
</template>

<script>
import { sourceList } from '@/utils/sourceList'
import { allocatedUserList, authUserCancel, authUserCancelAll } from '@/api/system/role'
import { treeselect } from '@/api/system/dept'
import selectUser from './selectUser.vue'

export default {
  name: 'AuthUser',
  dicts: ['sys_normal_disable'],
  components: { selectUser },
  data() {
    return {
      queryError: '',
      // 遮罩层
      loading: true,
      // 选中用户组
      userIds: [],
      // 非多个禁用
      multiple: true,
      // 显示搜索条件
      showSearch: true,
      // 部门树选项
      deptOptions: [],
      // 总条数
      total: 0,
      // 用户表格数据
      userList: [],
      // 查询参数
      queryParams: {
        pageNum: 1,
        pageSize: 10,
        roleId: undefined,
        userName: undefined,
        phonenumber: undefined,
        deptId: undefined
      }
    }
  },
  created() {
    const roleId = this.$route.params && this.$route.params.roleId
    if (roleId) {
      this.queryParams.roleId = roleId
      this.getList()
      this.getTreeselect()
    }
  },
  methods: {
    /** 查询授权用户列表 */
    getList() {
      if (Array.isArray(this.queryParams.deptId)) {
        this.queryParams.deptId = this.queryParams.deptId.at(-1)
      }
      return sourceList(this, () => allocatedUserList(this.queryParams), response => {
        this.userList = response.rows
        this.total = response.total

      })
    },
    // 返回按钮
    handleClose() {
      const obj = { path: '/system/role' }
      this.$tab.closeOpenPage(obj)
    },
    /** 搜索按钮操作 */
    handleQuery() {
      this.queryParams.pageNum = 1
      this.getList()
    },
    /** 重置按钮操作 */
    resetQuery() {
      this.resetForm('queryForm')
      this.handleQuery()
    },
    // 多选框选中数据
    handleSelectionChange(selection) {
      this.userIds = selection.map(item => item.userId)
      this.multiple = !selection.length
    },
    /** 打开授权用户表弹窗 */
    openSelectUser() {
      this.$refs.select.show()
    },
    /** 取消授权按钮操作 */
    cancelAuthUser(row) {
      const roleId = this.queryParams.roleId
      this.$modal.confirm('确认要取消该用户"' + row.userName + '"角色吗？').then(function() {
        return authUserCancel({ userId: row.userId, roleId: roleId })
      }).then(() => {
        this.getList()
        this.$modal.msgSuccess('取消授权成功')
      }).catch(() => {})
    },
    /** 批量取消授权按钮操作 */
    cancelAuthUserAll(row) {
      const roleId = this.queryParams.roleId
      const userIds = this.userIds.join(',')
      this.$modal.confirm('是否取消选中用户授权数据项？').then(function() {
        return authUserCancelAll({ roleId: roleId, userIds: userIds })
      }).then(() => {
        this.getList()
        this.$modal.msgSuccess('取消授权成功')
      }).catch(() => {})
    },
    getTreeselect() {
      treeselect().then(response => {
        // debugger;
        this.deptOptions = response.data
      })
    }
  }
}
</script>
