<template>
  <div class="app-container">
    <PageHeader title="缓存监控" description="Redis 信息与缓存统计" />
    <el-alert v-if="queryError" :title="queryError" type="error" :closable="false" show-icon class="mb8"><el-button size="small" @click="getList">重试</el-button></el-alert>
    <el-row>
      <el-col :span="24" class="card-box">
        <el-card>
          <template #header><div><span>基本信息</span></div></template>
          <div class="el-table el-table--enable-row-hover el-table--medium">
            <table cellspacing="0" style="width: 100%">
              <tbody>
                <tr>
                  <td class="el-table__cell is-leaf"><div class="cell">Redis版本</div></td>
                  <td class="el-table__cell is-leaf"><div class="cell" v-if="cache.info">{{ cache.info.redis_version }}</div></td>
                  <td class="el-table__cell is-leaf"><div class="cell">运行模式</div></td>
                  <td class="el-table__cell is-leaf"><div class="cell" v-if="cache.info">{{ cache.info.redis_mode == "standalone" ? "单机" : "集群" }}</div></td>
                  <td class="el-table__cell is-leaf"><div class="cell">端口</div></td>
                  <td class="el-table__cell is-leaf"><div class="cell" v-if="cache.info">{{ cache.info.tcp_port }}</div></td>
                  <td class="el-table__cell is-leaf"><div class="cell">客户端数</div></td>
                  <td class="el-table__cell is-leaf"><div class="cell" v-if="cache.info">{{ cache.info.connected_clients }}</div></td>
                </tr>
                <tr>
                  <td class="el-table__cell is-leaf"><div class="cell">运行时间(天)</div></td>
                  <td class="el-table__cell is-leaf"><div class="cell" v-if="cache.info">{{ cache.info.uptime_in_days }}</div></td>
                  <td class="el-table__cell is-leaf"><div class="cell">使用内存</div></td>
                  <td class="el-table__cell is-leaf"><div class="cell" v-if="cache.info">{{ cache.info.used_memory_human }}</div></td>
                  <td class="el-table__cell is-leaf"><div class="cell">使用CPU</div></td>
                  <td class="el-table__cell is-leaf"><div class="cell" v-if="cache.info">{{ parseFloat(cache.info.used_cpu_user_children).toFixed(2) }}</div></td>
                  <td class="el-table__cell is-leaf"><div class="cell">内存配置</div></td>
                  <td class="el-table__cell is-leaf"><div class="cell" v-if="cache.info">{{ cache.info.maxmemory_human }}</div></td>
                </tr>
                <tr>
                  <td class="el-table__cell is-leaf"><div class="cell">AOF是否开启</div></td>
                  <td class="el-table__cell is-leaf"><div class="cell" v-if="cache.info">{{ cache.info.aof_enabled == "0" ? "否" : "是" }}</div></td>
                  <td class="el-table__cell is-leaf"><div class="cell">RDB是否成功</div></td>
                  <td class="el-table__cell is-leaf"><div class="cell" v-if="cache.info">{{ cache.info.rdb_last_bgsave_status }}</div></td>
                  <td class="el-table__cell is-leaf"><div class="cell">Key数量</div></td>
                  <td class="el-table__cell is-leaf"><div class="cell" v-if="cache.dbSize">{{ cache.dbSize }} </div></td>
                  <td class="el-table__cell is-leaf"><div class="cell">网络入口/出口</div></td>
                  <td class="el-table__cell is-leaf"><div class="cell" v-if="cache.info">{{ cache.info.instantaneous_input_kbps }}kps/{{cache.info.instantaneous_output_kbps}}kps</div></td>
                </tr>
              </tbody>
            </table>
          </div>
        </el-card>
      </el-col>

      <el-col :span="12" class="card-box">
        <el-card>
          <template #header><div><span>命令统计</span></div></template>
          <div class="el-table el-table--enable-row-hover el-table--medium">
            <div ref="commandstats" style="height: 420px" />
          </div>
        </el-card>
      </el-col>

      <el-col :span="12" class="card-box">
        <el-card>
          <template #header><div>
            <span>内存信息</span>
          </div></template>
          <div class="el-table el-table--enable-row-hover el-table--medium">
            <div ref="usedmemory" style="height: 420px" />
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import { getCache } from "@/api/monitor/cache";
import * as echarts from "echarts";

export default {
  name: "Server",
  data() {
    return {
      queryError:"",
      resizeObserver:null,
      // 统计命令信息
      commandstats: null,
      // 使用内存
      usedmemory: null,
      // cache信息
      cache: [],
    };
  },
  created() {
    this.getList();
  },
  mounted(){this.resizeObserver=new ResizeObserver(()=>{this.commandstats?.resize();this.usedmemory?.resize()});this.resizeObserver.observe(this.$el)},
  beforeUnmount(){this.resizeObserver?.disconnect();this.commandstats?.dispose();this.usedmemory?.dispose()},
  methods: {
    /** 查缓存询信息 */
    getList() {
      this.queryError="";this.openLoading();
      return getCache().then((response) => {
        this.cache = response.data;
        const tokens=getComputedStyle(document.documentElement);
        const color=name=>tokens.getPropertyValue(name).trim();
        const textStyle={fontFamily:color("--ui-font"),color:color("--ui-text-secondary")};


        this.commandstats?.dispose();
        this.commandstats = echarts.init(this.$refs.commandstats);
        this.commandstats.setOption({
          animation:false, textStyle,
          color:[color("--ui-primary"),color("--ui-accent"),color("--el-color-primary-light-3"),color("--ui-text-muted"),color("--el-color-primary-light-5")],
          tooltip: {
            trigger: "item",
            formatter: "{a} <br/>{b} : {c} ({d}%)",
          },
          series: [
            {
              name: "命令",
              type: "pie",
              roseType: "radius",
              radius: [15, 95],
              center: ["50%", "38%"],
              data: response.data.commandStats,
              label:{color:color("--ui-text-secondary"),fontSize:12},
              labelLine:{lineStyle:{color:color("--ui-border")}},
            },
          ],
        });
        this.usedmemory?.dispose();
        this.usedmemory = echarts.init(this.$refs.usedmemory);
        this.usedmemory.setOption({
          animation:false, textStyle,
          tooltip: {
            formatter: "{b} <br/>{a} : " + this.cache.info.used_memory_human,
          },
          series: [
            {
              name: "峰值",
              type: "gauge",
              min: 0,
              max: 1000,
              axisLine:{lineStyle:{color:[[1,color("--ui-border")]],width:10}},
              pointer:{itemStyle:{color:color("--ui-primary")}},
              axisLabel:{color:color("--ui-text-secondary")},
              title:{color:color("--ui-text-secondary"),fontSize:13},
              detail: {
                color:color("--ui-text"),fontSize:24,
                formatter: this.cache.info.used_memory_human,
              },
              data: [
                {
                  value: parseFloat(this.cache.info.used_memory_human),
                  name: "内存消耗",
                },
              ],
            },
          ],
        });
      }).catch(error=>{this.queryError=error.message}).finally(()=>this.$modal.closeLoading());
    },
    // 打开加载层
    openLoading() {
      this.$modal.loading("正在加载缓存监控数据，请稍候！");
    },
  },
};
</script>
