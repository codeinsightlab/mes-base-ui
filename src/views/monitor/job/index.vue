<template>
  <div class="app-container">
    <PageHeader section="MES BASE / MONITOR" title="任务调度" description="定时任务配置与运行状态" />
    <el-alert v-if="queryError" :title="queryError" type="error" :closable="false" show-icon class="mb8"><el-button size="small" @click="getList">重试</el-button></el-alert>
    <el-form v-show="showSearch" ref="queryForm" class="filter-panel" :model="queryParams" size="small" :inline="true" label-width="68px">
      <el-form-item label="任务名称" prop="jobName">
        <el-input
          v-model="queryParams.jobName"
          placeholder="请输入任务名称"
          clearable
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="任务组名" prop="jobGroup">
        <el-select v-model="queryParams.jobGroup" placeholder="请选择任务组名" clearable>
          <el-option
            v-for="dict in dict.type.sys_job_group"
            :key="dict.value"
            :label="dict.label"
            :value="dict.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="任务状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="请选择任务状态" clearable>
          <el-option
            v-for="dict in dict.type.sys_job_status"
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
          v-hasPermi="['monitor:job:add']"
          type="primary"
          plain
          icon="Plus"
          size="small"
          @click="handleAdd"
        >新增</el-button>
      </el-col>
      <el-col :span="3">
        <el-button
          v-hasPermi="['monitor:job:edit']"
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
          v-hasPermi="['monitor:job:remove']"
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
          v-hasPermi="['monitor:job:export']"
          type="warning"
          plain
          icon="Download"
          size="small"
          @click="handleExport"
        >导出</el-button>
      </el-col>
      <el-col :span="3">
        <el-button
          v-hasPermi="['monitor:job:query']"
          type="info"
          plain
          icon="Operation"
          size="small"
          @click="handleJobLog"
        >日志</el-button>
      </el-col>
      <right-toolbar v-model:show-search="showSearch" @query-table="getList" />
    </el-row>

    <el-table v-loading="loading" :data="jobList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="任务编号" width="100" align="center" prop="jobId" />
      <el-table-column label="任务名称" align="center" prop="jobName" :show-overflow-tooltip="true" />
      <el-table-column label="任务组名" align="center" prop="jobGroup">
        <template #default="scope">
          <dict-tag :options="dict.type.sys_job_group" :value="scope.row.jobGroup" />
        </template>
      </el-table-column>
      <el-table-column label="调用目标字符串" align="center" prop="invokeTarget" :show-overflow-tooltip="true" />
      <el-table-column label="cron执行表达式" align="center" prop="cronExpression" :show-overflow-tooltip="true" />
      <el-table-column label="状态" align="center">
        <template #default="scope">
          <el-switch
            v-model="scope.row.status"
            inline-prompt
            active-text="正常"
            inactive-text="停用"
            :width="56"
            active-value="0"
            inactive-value="1"
            @change="handleStatusChange(scope.row)"
          />
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" min-width="190" fixed="right" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-button
            v-hasPermi="['monitor:job:edit']"
            size="small"
            link
            icon="Edit"
            @click="handleUpdate(scope.row)"
          >修改</el-button>
          <el-button
            v-hasPermi="['monitor:job:remove']"
            size="small"
            link
            icon="Delete"
            @click="handleDelete(scope.row)"
          >删除</el-button>
          <el-dropdown v-hasPermi="['monitor:job:changeStatus', 'monitor:job:query']" size="small" @command="(command) => handleCommand(command, scope.row)">
            <span class="el-dropdown-link">
              <el-icon><ArrowDown /></el-icon>更多
            </span>
            <template #dropdown><el-dropdown-menu>
              <el-dropdown-item v-if="hasPermi(['monitor:job:query'])" command="inspectRun">运行状态/恢复</el-dropdown-item>
              <el-dropdown-item
                v-if="hasPermi(['monitor:job:changeStatus'])"
                command="handleRun"
                icon="ArrowRight"
              >执行一次</el-dropdown-item>
              <el-dropdown-item
                v-if="hasPermi(['monitor:job:query'])"
                command="handleView"
                icon="View"
              >任务详细</el-dropdown-item>
              <el-dropdown-item
                v-if="hasPermi(['monitor:job:query'])"
                command="handleJobLog"
                icon="Operation"
              >调度日志</el-dropdown-item>
            </el-dropdown-menu></template>
          </el-dropdown>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="stateOpen" title="运行状态与受控恢复" width="600px" append-to-body>
      <el-descriptions :column="1" border><el-descriptions-item label="任务">{{ stateJob.jobName }}</el-descriptions-item><el-descriptions-item label="运行令牌">{{ runState.runToken||'未占用' }}</el-descriptions-item><el-descriptions-item label="领取时间">{{ parseTime(runState.startedAt) }}</el-descriptions-item><el-descriptions-item label="状态">{{ runState.status==='1'?'已暂停':'已启用' }}</el-descriptions-item></el-descriptions>
      <el-alert v-if="runState.runToken" type="warning" :closable="false" title="仅在任务已暂停、占用超过5分钟，且原执行进程已经停止时恢复。恢复记录结果为UNKNOWN。" style="margin:16px 0" />
      <el-checkbox v-if="runState.runToken" v-model="confirmedDead">已确认原执行进程停止</el-checkbox>
      <template #footer><el-button @click="stateOpen=false">关闭</el-button><el-button :loading="stateLoading" @click="inspectRun(stateJob)">刷新状态</el-button><el-button v-if="runState.runToken" v-hasPermi="['monitor:job:changeStatus']" type="danger" :disabled="!confirmedDead||runState.status!=='1'" :loading="stateLoading" @click="recoverRun">确认恢复占用</el-button></template>
    </el-dialog>
    <pagination
      v-show="total>0"
      v-model:page="queryParams.pageNum"
      v-model:limit="queryParams.pageSize"
      :total="total"
      @pagination="getList"
    />

    <!-- 添加或修改定时任务对话框 -->
    <el-dialog v-model="open" :title="title" width="800px" append-to-body>
      <el-form ref="form" :model="form" :rules="rules" label-width="120px">
        <el-row>
          <el-col :span="12">
            <el-form-item label="任务名称" prop="jobName">
              <el-input v-model="form.jobName" placeholder="请输入任务名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="任务分组" prop="jobGroup">
              <el-select v-model="form.jobGroup" placeholder="请选择任务分组">
                <el-option
                  v-for="dict in dict.type.sys_job_group"
                  :key="dict.value"
                  :label="dict.label"
                  :value="dict.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="执行任务" prop="invokeTarget"><el-select v-model="form.invokeTarget" @change="form.executionScope=form.invokeTarget==='platform-heartbeat'?'PLATFORM':'FACTORY';form.factoryId=null"><el-option label="平台心跳" value="platform-heartbeat" /><el-option label="工厂心跳" value="factory-heartbeat" /></el-select></el-form-item>
            <el-form-item v-if="form.executionScope==='FACTORY'" label="所属工厂" prop="factoryId" :rules="[{required:true,message:'请选择工厂'}]"><el-select v-model="form.factoryId"><el-option v-for="f in factories" :key="f.factoryId" :label="f.name" :value="f.factoryId" /></el-select></el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="cron表达式" prop="cronExpression">
              <el-input v-model="form.cronExpression" placeholder="请输入cron执行表达式">
                <template #append>
                  <el-button type="primary" @click="handleShowCron">
                    生成表达式
                    <el-icon><Clock /></el-icon>
                  </el-button>
                </template>
              </el-input>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="执行策略" prop="misfirePolicy">
              <el-radio-group v-model="form.misfirePolicy" size="small">
                <el-radio-button label="1">立即执行</el-radio-button>
                <el-radio-button label="2">执行一次</el-radio-button>
                <el-radio-button label="3">放弃执行</el-radio-button>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="是否并发" prop="concurrent">
              <el-radio-group v-model="form.concurrent" size="small">
                <el-radio-button label="0">允许</el-radio-button>
                <el-radio-button label="1">禁止</el-radio-button>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态">
              <el-radio-group v-model="form.status">
                <el-radio
                  v-for="dict in dict.type.sys_job_status"
                  :key="dict.value"
                  :value="dict.value"
                >{{ dict.label }}</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer><div class="dialog-footer">
        <el-button type="primary" @click="submitForm">确 定</el-button>
        <el-button @click="cancel">取 消</el-button>
      </div></template>
    </el-dialog>

    <el-dialog v-model="openCron" title="Cron表达式生成器" append-to-body destroy-on-close class="scrollbar">
      <crontab :expression="expression" @hide="openCron=false" @fill="crontabFill" />
    </el-dialog>

    <!-- 任务日志详细 -->
    <el-dialog v-model="openView" title="任务详细" width="700px" append-to-body>
      <el-form ref="form" :model="form" label-width="120px" size="small">
        <el-row>
          <el-col :span="12">
            <el-form-item label="任务编号：">{{ form.jobId }}</el-form-item>
            <el-form-item label="任务名称：">{{ form.jobName }}</el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="任务分组：">{{ jobGroupFormat(form) }}</el-form-item>
            <el-form-item label="创建时间：">{{ form.createTime }}</el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="cron表达式：">{{ form.cronExpression }}</el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="下次执行时间：">{{ parseTime(form.nextValidTime) }}</el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="调用目标方法：">{{ form.invokeTarget }}</el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="任务状态：">
              <div v-if="form.status == 0">正常</div>
              <div v-else-if="form.status == 1">失败</div>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="是否并发：">
              <div v-if="form.concurrent == 0">允许</div>
              <div v-else-if="form.concurrent == 1">禁止</div>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="执行策略：">
              <div v-if="form.misfirePolicy == 0">默认策略</div>
              <div v-else-if="form.misfirePolicy == 1">立即执行</div>
              <div v-else-if="form.misfirePolicy == 2">执行一次</div>
              <div v-else-if="form.misfirePolicy == 3">放弃执行</div>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer><div class="dialog-footer">
        <el-button @click="openView = false">关 闭</el-button>
      </div></template>
    </el-dialog>
  </div>
</template>

<script>
import { sourceList } from '@/utils/sourceList'
import { useAuth } from '@/stores/auth'
import request from '@/utils/request'
import { listJob, getJob, delJob, addJob, updateJob, runJob, changeJobStatus } from '@/api/monitor/job'
import Crontab from '@/components/Crontab/index.vue'

export default {
  name: 'Job',
  components: { Crontab },
  dicts: ['sys_job_group', 'sys_job_status'],
  data() {
    return {
      queryError: '',
      // 遮罩层
      factories: useAuth().factories,
      loading: true, stateOpen: false, stateJob: {}, runState: {}, confirmedDead: false, stateLoading: false,
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
      // 定时任务表格数据
      jobList: [],
      // 弹出层标题
      title: '',
      // 是否显示弹出层
      open: false,
      // 是否显示详细弹出层
      openView: false,
      // 是否显示Cron表达式弹出层
      openCron: false,
      // 传入的表达式
      expression: '',
      // 查询参数
      queryParams: {
        pageNum: 1,
        pageSize: 10,
        jobName: undefined,
        jobGroup: undefined,
        status: undefined
      },
      // 表单参数
      form: {},
      // 表单校验
      rules: {
        jobName: [
          { required: true, message: '任务名称不能为空', trigger: 'blur' }
        ],
        invokeTarget: [
          { required: true, message: '调用目标字符串不能为空', trigger: 'blur' }
        ],
        cronExpression: [
          { required: true, message: 'cron执行表达式不能为空', trigger: 'blur' }
        ]
      }
    }
  },
  created() {
    this.getList()
  },
  methods: {
    async inspectRun(row) { this.stateJob = row;this.confirmedDead = false;this.stateLoading = true;try { const response = await request({ url: '/monitor/job/' + row.jobId + '/run-state', scope: 'platform' });this.runState = response.data;this.stateOpen = true } finally { this.stateLoading = false } },
    async recoverRun() { await this.$modal.confirm('确认原执行进程已停止并恢复本次占用？');this.stateLoading = true;try { await request({ url: '/monitor/job/recover', method: 'post', scope: 'platform', data: { jobId: this.stateJob.jobId, expectedRunToken: this.runState.runToken, confirmedProcessDead: true }});this.$modal.msgSuccess('占用已恢复，结果记录为UNKNOWN');await this.inspectRun(this.stateJob) } finally { this.stateLoading = false } },
    /** 查询定时任务列表 */
    getList() {
      return sourceList(this, () => listJob(this.queryParams), response => {
        this.jobList = response.rows
        this.total = response.total

      })
    },
    // 任务组名字典翻译
    jobGroupFormat(row, column) {
      return this.selectDictLabel(this.dict.type.sys_job_group, row.jobGroup)
    },
    // 取消按钮
    cancel() {
      this.open = false
      this.reset()
    },
    // 表单重置
    reset() {
      this.form = {
        jobId: undefined,
        jobName: undefined,
        jobGroup: undefined,
        invokeTarget: 'platform-heartbeat', executionScope: 'PLATFORM', factoryId: null,
        cronExpression: undefined,
        misfirePolicy: 1,
        concurrent: 1,
        status: '1'
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
      this.resetForm('queryForm')
      this.handleQuery()
    },
    // 多选框选中数据
    handleSelectionChange(selection) {
      this.ids = selection.map(item => item.jobId)
      this.single = selection.length != 1
      this.multiple = !selection.length
    },
    // 更多操作触发
    handleCommand(command, row) {
      switch (command) {
        case 'inspectRun': this.inspectRun(row);break
        case 'handleRun':
          this.handleRun(row)
          break
        case 'handleView':
          this.handleView(row)
          break
        case 'handleJobLog':
          this.handleJobLog(row)
          break
        default:
          break
      }
    },
    // 任务状态修改
    handleStatusChange(row) {
      let text = row.status === '0' ? '启用' : '停用'
      this.$modal.confirm('确认要"' + text + '""' + row.jobName + '"任务吗？').then(function() {
        return changeJobStatus(row.jobId, row.status)
      }).then(() => {
        this.$modal.msgSuccess(text + '成功')
      }).catch(function() {
        row.status = row.status === '0' ? '1' : '0'
      })
    },
    /* 立即执行一次 */
    handleRun(row) {
      this.$modal.confirm('确认要立即执行一次"' + row.jobName + '"任务吗？').then(function() {
        return runJob(row.jobId, row.jobGroup)
      }).then(() => {
        this.$modal.msgSuccess('执行成功')
      }).catch(() => {})
    },
    /** 任务详细信息 */
    handleView(row) {
      getJob(row.jobId).then(response => {
        this.form = response.data
        this.openView = true
      })
    },
    /** cron表达式按钮操作 */
    handleShowCron() {
      this.expression = this.form.cronExpression
      this.openCron = true
    },
    /** 确定后回传值 */
    crontabFill(value) {
      this.form.cronExpression = value
    },
    /** 任务日志列表查询 */
    handleJobLog(row) {
      const jobId = row.jobId || 0
      this.$router.push({ path: '/monitor/job-log/index', query: { jobId: jobId }})
    },
    /** 新增按钮操作 */
    handleAdd() {
      this.reset()
      this.open = true
      this.title = '添加任务'
    },
    /** 修改按钮操作 */
    handleUpdate(row) {
      this.reset()
      const jobId = row.jobId || this.ids
      getJob(jobId).then(response => {
        this.form = response.data
        this.open = true
        this.title = '修改任务'
      })
    },
    /** 提交按钮 */
    submitForm: function() {
      this.$refs['form'].validate(valid => {
        if (valid) {
          if (this.form.jobId != undefined) {
            updateJob(this.form).then(response => {
              this.$modal.msgSuccess('修改成功')
              this.open = false
              this.getList()
            })
          } else {
            addJob(this.form).then(response => {
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
      const jobIds = row.jobId || this.ids
      this.$modal.confirm('是否确认删除定时任务编号为"' + jobIds + '"的数据项？').then(function() {
        return delJob(jobIds)
      }).then(() => {
        this.getList()
        this.$modal.msgSuccess('删除成功')
      }).catch(() => {})
    },
    /** 导出按钮操作 */
    handleExport() {
      this.download('monitor/job/export', {
        ...this.queryParams
      }, `job_${new Date().getTime()}.xlsx`)
    }
  }
}
</script>
