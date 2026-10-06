<template>
  <!-- 授权用户 -->
  <el-dialog
    v-model="visible"
    title="选择用户"
    width="1100px"
    top="5vh"
    append-to-body
  >
    <el-form ref="queryForm" class="filter-panel" :model="queryParams" size="small" :inline="true">
      <el-form-item label="用户名称" prop="userName">
        <el-input
          v-model="queryParams.userName"
          placeholder="请输入用户名称"
          clearable
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="用户昵称" prop="nickName">
        <el-input
          v-model="queryParams.nickName"
          placeholder="请输入用户昵称"
          clearable
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="部门" prop="deptId">
        <!-- <el-input
          v-model="queryParams.deptId"
          placeholder="请输入部门名称"
          clearable
          @keyup.enter="handleQuery"
        /> -->
        <el-cascader
          v-model="queryParams.deptId"
          :options="deptOptions"
          :props="{ expandTrigger: 'hover', label: 'label', value: 'id' }"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item>
        <el-button
          type="primary"
          icon="Search"
          size="small"
          @click="handleQuery"
        >搜索</el-button>
        <el-button
          icon="Refresh"
          size="small"
          @click="resetQuery"
        >重置</el-button>
      </el-form-item>
    </el-form>
    <el-row>
      <el-table
        ref="table"
        :data="userList"
        height="260px"
        @row-click="clickRow"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column
          label="用户名称"
          prop="userName"
          :show-overflow-tooltip="true"
        />
        <el-table-column
          label="用户昵称"
          prop="nickName"
          :show-overflow-tooltip="true"
        />
        <el-table-column
          label="邮箱"
          prop="email"
          :show-overflow-tooltip="true"
        />
        <el-table-column
          label="手机"
          prop="phonenumber"
          :show-overflow-tooltip="true"
        />
        <el-table-column label="状态" align="center" prop="status">
          <template #default="scope">
            <dict-tag
              :options="dict.type.sys_normal_disable"
              :value="scope.row.status"
            />
          </template>
        </el-table-column>
        <el-table-column
          label="创建时间"
          align="center"
          prop="createTime"
          width="180"
        >
          <template #default="scope">
            <span>{{ parseTime(scope.row.createTime) }}</span>
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
    </el-row>
    <template #footer><div class="dialog-footer">
      <el-button type="primary" @click="handleSelectUser">确 定</el-button>
      <el-button @click="visible = false">取 消</el-button>
    </div></template>
  </el-dialog>
</template>

<script>
import { unallocatedUserList, authUserSelectAll } from '@/api/system/role'
import { treeselect } from '@/api/system/dept'
export default {
  dicts: ['sys_normal_disable'],
  props: {
    // 角色编号
    roleId: {
      type: [Number, String]
    }
  },
  data() {
    return {
      // 遮罩层
      visible: false,
      // 选中数组值
      userIds: [],
      // 总条数
      total: 0,
      // 部门树选项
      deptOptions: [],
      // 未授权用户数据
      userList: [],
      // 查询参数
      queryParams: {
        pageNum: 1,
        pageSize: 10,
        roleId: undefined,
        userName: undefined,
        phonenumber: undefined,
        deptId: undefined,
        nickName: undefined
      }
    }
  },
  methods: {
    // 显示弹框
    show() {
      this.queryParams.roleId = this.roleId
      this.getList()
      this.visible = true
      this.getTreeselect()
    },
    clickRow(row) {
      this.$refs.table.toggleRowSelection(row)
    },
    // 多选框选中数据
    handleSelectionChange(selection) {
      this.userIds = selection.map((item) => item.userId)
    },
    // 查询表数据
    getList() {
      if (
        this.queryParams.deptId != undefined &&
        this.queryParams.deptId.length > 1
      ) {
        this.queryParams.deptId =
          this.queryParams.deptId[this.queryParams.deptId.length - 1]
      }
      unallocatedUserList(this.queryParams).then((res) => {
        this.userList = res.rows
        this.total = res.total
      })
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
    /** 选择授权用户操作 */
    handleSelectUser() {
      const roleId = this.queryParams.roleId
      const userIds = this.userIds.join(',')
      if (userIds == '') {
        this.$modal.msgError('请选择要分配的用户')
        return
      }
      authUserSelectAll({ roleId: roleId, userIds: userIds }).then((res) => {
        this.$modal.msgSuccess(res.msg)
        if (res.code === 200) {
          this.visible = false
          this.$emit('ok')
        }
      })
    },
    getTreeselect() {
      treeselect().then((response) => {
        // debugger;
        this.deptOptions = response.data
      })
    }
  }
}
</script>
