<template>
  <div class="app-container">
    <el-alert v-if="queryError" :title="queryError" type="error" :closable="false" show-icon class="mb8"><el-button size="small" @click="getList">重试</el-button></el-alert>
    <el-form :model="queryParams" ref="queryForm" size="small" :inline="true" v-show="showSearch" label-width="68px">
      <el-form-item label="组成编码" prop="partCode">
        <el-input
          v-model="queryParams.partCode"
          placeholder="请输入组成编码"
          clearable
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="组成名称" prop="partName">
        <el-input
          v-model="queryParams.partName"
          placeholder="请输入组成名称"
          clearable
          @keyup.enter="handleQuery"
        />
      </el-form-item>      
      <el-form-item>
        <el-button type="primary" icon="Search" size="small" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" size="small" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="3">
        <el-button
          type="primary"
          plain
          icon="Plus"
          size="small"
          @click="handleAdd"
          v-hasPermi="['system:autocode:part:add']"
        >新增</el-button>
      </el-col>
      <el-col :span="3">
        <el-button
          type="success"
          plain
          icon="Edit"
          size="small"
          :disabled="single"
          @click="handleUpdate"
          v-hasPermi="['system:autocode:part:edit']"
        >修改</el-button>
      </el-col>
      <el-col :span="3">
        <el-button
          type="danger"
          plain
          icon="Delete"
          size="small"
          :disabled="multiple"
          @click="handleDelete"
          v-hasPermi="['system:autocode:part:remove']"
        >删除</el-button>
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
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="partList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="组成编码" align="center" prop="partCode" />
      <el-table-column label="组成名称" align="center" prop="partName"/>
      <el-table-column label="分段序号" align="center" prop="partIndex" />
      <el-table-column label="分段类型" align="center" prop="partType" >
        <template #default="scope">
          <dict-tag :options="dict.type.sys_autocode_parttype" :value="scope.row.partType"/>
        </template>
      </el-table-column>
      <el-table-column label="分段长度" align="center" prop="partLength" />
      <el-table-column label="备注" align="center" prop="remark" :show-overflow-tooltip="true" />
      <el-table-column label="创建时间" align="center" prop="createTime" width="180">
        <template #default="scope">
          <span>{{ parseTime(scope.row.createTime) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-button
            size="small"
            type="link"
            icon="Edit"
            @click="handleUpdate(scope.row)"
            v-hasPermi="['system:autocode:part:edit']"
          >修改</el-button>
          <el-button
            size="small"
            type="link"
            icon="Delete"
            @click="handleDelete(scope.row)"
            v-hasPermi="['system:autocode:part:remove']"
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

    <!-- 添加或修改参数配置对话框 -->
    <el-dialog :title="title" v-model="open" width="900px" append-to-body>
      <el-form ref="form" :model="form" :inline="true" :rules="rules" label-width="100px">
        <el-row>
          <el-col :span="12">
            <el-form-item label="分段编码" prop="partCode">
              <el-input v-model="form.partCode" placeholder="请输入分段编码" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="分段名称" prop="partName">
              <el-input v-model="form.partName" placeholder="请输入分段名称" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="12">
            <el-form-item label="分段序号" prop="partIndex">
              <el-input-number v-model="form.partIndex" placeholder="请输入分段序号" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="分段长度" prop="partLength">
              <el-input-number v-model="form.partLength" placeholder="请输入分段长度" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="12">
            <el-form-item label="分段类型" prop="partType">
              <el-select v-model="form.partType">
                <el-option
                  v-for="item in dict.type.sys_autocode_parttype"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                ></el-option>
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="日期时间格式" prop="dateFormat" v-if="form.partType=='NOWDATE'">
              <el-input v-model="form.dateFormat" placeholder="请输入日期时间格式" />
            </el-form-item>

            <el-form-item label="输入字符" prop="inputCharacter" v-if="form.partType=='INPUTCHAR'">
              <el-input v-model="form.inputCharacter" placeholder="请填写输入字符" />
            </el-form-item>

            <el-form-item label="固定字符" prop="fixCharacter" v-if="form.partType=='FIXCHAR'">
              <el-input v-model="form.fixCharacter" placeholder="请填写固定字符" />
            </el-form-item>

            <el-form-item label="起始流水号" prop="seriaStartNo" v-if="form.partType=='SERIALNO'">
              <el-input-number v-model="form.seriaStartNo" placeholder="请填写起始流水号" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="12">
            <el-form-item label="流水号步长" prop="seriaStep" v-if="form.partType=='SERIALNO'">
              <el-input-number v-model="form.seriaStep" placeholder="请填写流水号步长" />
            </el-form-item>
          </el-col>
          <el-col :span= "12">
            <el-form-item label="是否循环" prop="cycleFlag" v-if="form.partType=='SERIALNO'">
              <el-radio-group v-model="form.cycleFlag">
                    <el-radio value="Y">是</el-radio>
                    <el-radio value="N">否</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span= "12">
            <el-form-item label="循环方式" prop="cycleMethod" v-if="form.partType =='SERIALNO' && form.cycleFlag =='Y'">
              <el-select v-model="form.cycleMethod">
                <el-option
                  v-for="item in dict.type.sys_autocode_cyclemethod"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                ></el-option>
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row>
          <el-col>
            <el-form-item label="备注" prop="remark">
              <el-input v-model="form.remark" type="textarea" placeholder="请输入内容"></el-input>
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
import { listPart, getPart, delPart, addPart, updatePart } from "@/api/system/autocode/part";

export default {
  name: "Part",
  dicts: ['sys_autocode_cyclemethod','sys_autocode_parttype'],
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
      // 组成表格数据
      partList: [],
      // 弹出层标题
      title: "",
      // 是否显示弹出层
      open: false,
      //当前的规则ID
      recentRuleId: undefined,
      // 查询参数
      queryParams: {
        pageNum: 1,
        pageSize: 10,
        ruleId: undefined, //查询时默认是在当前编号生成规则下
        partCode: undefined,
        partName: undefined        
      },
      // 表单参数
      form: {},
      // 表单校验
      rules: {
        partCode: [
          { required: true, message: "组成编码不能为空", trigger: "blur" }
        ],
        partName: [
          { required: true, message: "组成名称不能为空", trigger: "blur" }
        ],
        partIndex: [
          { required: true, message: "组成序号不能为空", trigger: "blur" }
        ]
      }
    };
  },
  created() {
    //从上级页面获取的规则ID
    const ruleId = this.$route.params && this.$route.params.ruleId;
    this.recentRuleId = ruleId;
    this.queryParams.ruleId = ruleId;
    this.getList();
  },
  methods: {

    /** 查询字典数据列表 */
    getList() {
      return sourceList(this,()=>listPart(this.queryParams),response=>{
        this.partList = response.rows;
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
        partCode: undefined,
        partName: undefined,
        partIndex: 1,
        partLength: 1,
        remark: undefined
      };
      this.resetForm("form");
    },
    /** 搜索按钮操作 */
    handleQuery() {
      this.queryParams.pageNum = 1;
      this.getList();
    },
    /** 返回按钮操作 */
    handleClose() {
      const obj = { path: "/system/autocode" };
      this.$tab.closeOpenPage(obj);
    },
    /** 重置按钮操作 */
    resetQuery() {
      this.resetForm("queryForm");
      this.queryParams.ruleId = this.recentRuleId;
      this.handleQuery();
    },
    /** 新增按钮操作 */
    handleAdd() {
      this.reset();
      this.open = true;
      this.title = "添加规则组成";
      this.form.ruleId = this.recentRuleId;
    },
    // 多选框选中数据
    handleSelectionChange(selection) {
      this.ids = selection.map(item => item.partId)
      this.single = selection.length!=1
      this.multiple = !selection.length
    },
    /** 修改按钮操作 */
    handleUpdate(row) {
      this.reset();
      const partId = row.partId || this.ids
      getPart(partId).then(response => {
        this.form = response.data;
        this.open = true;
        this.title = "修改规则组成";
      });
    },
    /** 提交按钮 */
    submitForm: function() {
      this.$refs["form"].validate(valid => {
        if (valid) {
          if (this.form.partId != undefined) {
            updatePart(this.form).then(response => {
              this.$modal.msgSuccess("修改成功");
              this.open = false;
              this.getList();
            });
          } else {
            addPart(this.form).then(response => {
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
      const partIds = row.partId || this.ids;
      this.$modal.confirm('是否确认删除规则组成ID为"' + partIds + '"的数据项？').then(function() {
        return delPart(partIds);
      }).then(() => {
        this.getList();
        this.$modal.msgSuccess("删除成功");
      }).catch(() => {});
    }
  }
};
</script>