<template>
  <div class="app-container">
    <PageHeader title="消息管理" description="站内消息、接收人与发送状态" />
    <el-alert v-if="queryError" :title="queryError" type="error" :closable="false" show-icon class="mb8"><el-button size="small" @click="getList">重试</el-button></el-alert>
    <el-form class="filter-panel" :model="queryParams" ref="queryForm" size="small" :inline="true" v-show="showSearch" label-width="100px">
      <el-form-item label="消息类型" prop="messageType">
        <el-select v-model="queryParams.messageType" placeholder="请选择消息类型" clearable>
          <el-option
            v-for="dict in dict.type.sys_message_type"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="消息级别" prop="messageLevel">
        <el-select v-model="queryParams.messageLevel" placeholder="请选择消息级别" clearable>
          <el-option
            v-for="dict in dict.type.sys_message_level"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="发送人" prop="senderNick">
        <el-input
          v-model="queryParams.senderNick"
          placeholder="请输入发送人"
          clearable
          @keyup.enter="handleQuery"
        />
      </el-form-item>

      <el-form-item label="接收人" prop="recipientId">
        <el-input
          v-model="queryParams.recipientNick"
          placeholder="请输入接收人"
          clearable
          @keyup.enter="handleQuery"
        />
      </el-form-item>


      <el-form-item label="状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="请选择状态" clearable>
          <el-option
            v-for="dict in dict.type.sys_message_status"
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
          type="primary"
          plain
          icon="Plus"
          size="small"
          @click="handleAdd"
          v-hasPermi="['system:message:add']"
        >新增</el-button>
      </el-col>
      <el-col :span="3">
        <el-button
          type="danger"
          plain
          icon="Delete"
          size="small"
          :disabled="multiple"
          @click="handleDelete"
          v-hasPermi="['system:message:remove']"
        >删除</el-button>
      </el-col>
      <el-col :span="3">
        <el-button
          type="warning"
          plain
          icon="Download"
          size="small"
          @click="handleExport"
          v-hasPermi="['system:message:export']"
        >导出</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="messageList" @selection-change="handleSelectionChange">      
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="消息类型" align="center" prop="messageType">
        <template #default="scope">
          <dict-tag :options="dict.type.sys_message_type" :value="scope.row.messageType"/>
        </template>
      </el-table-column>
      <el-table-column label="消息级别" align="center" prop="messageLevel">
        <template #default="scope">
          <dict-tag :options="dict.type.sys_message_level" :value="scope.row.messageLevel"/>
        </template>
      </el-table-column>
      <el-table-column label="标题" align="center" prop="messageTitle" />
      <el-table-column label="内容" align="center" prop="messageContent" />
      <el-table-column label="发送人" align="center" prop="senderNick" />
      <el-table-column label="接收人" align="center" prop="recipientId" />
      <el-table-column label="处理时间" align="center" prop="processTime" width="180">
        <template #default="scope">
          <span>{{ parseTime(scope.row.processTime, '{y}-{m}-{d}') }}</span>
        </template>
      </el-table-column>
      <el-table-column label="回调地址" align="center" prop="callBack" />
      <el-table-column label="状态" align="center" prop="status">
        <template #default="scope">
          <dict-tag status :options="dict.type.sys_message_status" :value="scope.row.status"/>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" min-width="150" fixed="right" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-button
            size="small"
            link
            icon="Edit"
            @click="handleUpdate(scope.row)"
            v-hasPermi="['system:message:edit']"
          >修改</el-button>
          <el-button
            size="small"
            link
            icon="Delete"
            @click="handleDelete(scope.row)"
            v-hasPermi="['system:message:remove']"
          >删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    
    <pagination
      v-show="total>0"
      :total="total"
      v-model:page="queryParams.pageNum"
      v-model:limit="queryParams.pageSize"
      @pagination="getList"
    />

    <!-- 添加或修改消息对话框 -->
    <el-dialog :title="title" v-model="open" width="960px" append-to-body>
      <el-form ref="form" :model="form" :rules="rules" label-width="100px">
        <el-row>
          <el-col :span="8">
            <el-form-item label="消息类型" prop="messageType">
              <el-select v-model="form.messageType" placeholder="请选择消息类型">
                <el-option
                  v-for="dict in dict.type.sys_message_type"
                  :key="dict.value"
                  :label="dict.label"
                  :value="dict.value"
                ></el-option>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="消息级别" prop="messageLevel">
              <el-select v-model="form.messageLevel" placeholder="请选择消息级别">
                <el-option
                  v-for="dict in dict.type.sys_message_level"
                  :key="dict.value"
                  :label="dict.label"
                  :value="dict.value"
                ></el-option>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="接收人" prop="recipientId">
              <el-input v-model="form.recipientNick" readonly placeholder="请选择接收人" >
                <template #append><el-button @click="handleUserSelect" icon="Search"></el-button></template>
              </el-input>
            </el-form-item>
            <UserSingleSelect ref="userSelect" @onSelected="onUserSelected"></UserSingleSelect>
          </el-col>          
        </el-row>
        <el-row>
          <el-col :span="24">
            <el-form-item label="标题" prop="messageTitle">
              <el-input v-model="form.messageTitle" placeholder="请输入标题" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="24">
            <el-form-item label="内容">
              <editor v-model="form.messageContent" :min-height="192"/>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="24">
            <el-form-item label="回调地址" prop="callBack">
              <el-input v-model="form.callBack" placeholder="请输入回调地址" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer><div class="dialog-footer">
        <el-button type="primary" @click="submitForm">确 定</el-button>
        <el-button @click="cancel">取 消</el-button>
      </div></template>
    </el-dialog>
  </div>
</template>

<script>
import {sourceList} from "@/utils/sourceList";
import { listMessage, getMessage, delMessage, addMessage, updateMessage } from "@/api/system/message";
import UserSingleSelect from "@/components/userSelect/single.vue"
export default {
  name: "Message",
  components: {UserSingleSelect},
  dicts: ['sys_message_type', 'sys_message_status','sys_message_level'],
  data() {
    return {
      queryError:"",
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
      // 消息表格数据
      messageList: [],
      // 弹出层标题
      title: "",
      // 是否显示弹出层
      open: false,
      // 查询参数
      queryParams: {
        pageNum: 1,
        pageSize: 10,
        messageType: null,        messageLevel: null,        messageTitle: null,        messageContent: null,        senderId: null,        senderName: null,        senderNick: null,        recipientId: null,        recipientName: null,        recipientNick: null,        processTime: null,        callBack: null,        status: null,        deletedFlag: null,      },
      // 表单参数
      form: {},
      // 表单校验
      rules: {
        messageType: [
          { required: true, message: "消息类型不能为空", trigger: "change" }
        ],        
        messageLevel: [
          { required: true, message: "消息级别不能为空", trigger: "blur" }
        ],      
        messageTitle: [
          { required: true, message: "消息标题不能为空", trigger: "blur" }
        ],
        messageContent: [
          { required: true, message: "消息内容不能为空", trigger: "blur" }
        ],  
        recipientId: [
          { required: true, message: "接收人不能为空", trigger: "blur" }
        ]     
      }
    };
  },
  created() {
    this.getList();
  },
  methods: {
    /** 查询消息列表 */
    getList() {
      return sourceList(this,()=>listMessage(this.queryParams),response=>{
        this.messageList = response.rows;
        this.total = response.total;
      
      });
    },
    // 取消按钮
    cancel() {
      this.open = false;
      this.reset();
    },
    // 表单重置
    reset() {
      this.form = {
        messageId: null,        messageType: null,        messageLevel: null,        messageTitle: null,        messageContent: null,        senderId: null,        senderName: null,        senderNick: null,        recipientId: null,        recipientName: null,        recipientNick: null,        processTime: null,        callBack: null,        status: "0",        deletedFlag: null,        remark: null,        attr1: null,        attr2: null,        attr3: null,        attr4: null,        createBy: null,        createTime: null,        updateBy: null,        updateTime: null      };
      this.resetForm("form");
    },
    /** 搜索按钮操作 */
    handleQuery() {
      this.queryParams.pageNum = 1;
      this.getList();
    },
    /** 重置按钮操作 */
    resetQuery() {
      this.resetForm("queryForm");
      this.handleQuery();
    },
    // 多选框选中数据
    handleSelectionChange(selection) {
      this.ids = selection.map(item => item.messageId)
      this.single = selection.length!==1
      this.multiple = !selection.length
    },
    /** 新增按钮操作 */
    handleAdd() {
      this.reset();
      this.open = true;
      this.title = "添加消息";
    },
    /** 修改按钮操作 */
    handleUpdate(row) {
      this.reset();
      const messageId = row.messageId || this.ids
      getMessage(messageId).then(response => {
        this.form = response.data;
        this.open = true;
        this.title = "修改消息";
      });
    },
    /** 提交按钮 */
    submitForm() {
      this.$refs["form"].validate(valid => {
        if (valid) {
          if (this.form.messageId != null) {
            updateMessage(this.form).then(response => {
              this.$modal.msgSuccess("修改成功");
              this.open = false;
              this.getList();
            });
          } else {
            addMessage(this.form).then(response => {
              this.$modal.msgSuccess("新增成功");
              this.open = false;
              this.getList();
            });
          }
        }
      });
    },
    /** 删除按钮操作 */
    handleDelete(row) {
      const messageIds = row.messageId || this.ids;
      this.$modal.confirm('是否确认删除消息编号为"' + messageIds + '"的数据项？').then(function() {
        return delMessage(messageIds);
      }).then(() => {
        this.getList();
        this.$modal.msgSuccess("删除成功");
      }).catch(() => {});
    },
    /** 导出按钮操作 */
    handleExport() {
      this.download('system/message/export', {
        ...this.queryParams
      }, `message_${new Date().getTime()}.xlsx`)
    },
    handleUserSelect(){
      this.$refs.userSelect.showFlag = true;
    },
    onUserSelected(row){
      if(row != null){
        
        this.form.recipientId = row.userId;
        this.form.recipientName = row.userName;
        this.form.recipientNick = row.nickName;
      }
    }
  }
};
</script>
