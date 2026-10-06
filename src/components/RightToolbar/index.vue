<template>
  <div class="top-right-btn">
    <el-row>
      <el-tooltip class="item" effect="dark" :content="showSearch ? '隐藏搜索' : '显示搜索'" placement="top">
        <el-button size="small" circle icon="Search" :aria-label="showSearch ? '隐藏搜索' : '显示搜索'" @click="toggleSearch()" />
      </el-tooltip>
      <el-tooltip class="item" effect="dark" content="刷新" placement="top">
        <el-button size="small" circle icon="Refresh" aria-label="刷新列表" @click="refresh()" />
      </el-tooltip>
      <el-tooltip v-if="columns" class="item" effect="dark" content="显隐列" placement="top">
        <el-button size="small" circle icon="Menu" aria-label="显示或隐藏列" @click="showColumn()" />
      </el-tooltip>
    </el-row>
    <el-dialog v-model="open" :title="title" append-to-body>
      <el-transfer
        v-model="value"
        :titles="['显示', '隐藏']"
        :data="columns"
        @change="dataChange"
      />
    </el-dialog>
  </div>
</template>
<script>
export default {
  name: 'RightToolbar',
  props: {
    showSearch: {
      type: Boolean,
      default: true
    },
    columns: {
      type: Array,
      default: null
    }
  },
  emits: ['update:showSearch', 'queryTable', 'update:columns'],
  data() {
    return {
      // 显隐数据
      value: [],
      // 弹出层标题
      title: '显示/隐藏',
      // 是否显示弹出层
      open: false
    }
  },
  watch: {
    columns: {
      handler(columns) { this.value = (columns || []).filter(column => column.visible === false).map(column => column.key) },
      immediate: true,
      deep: true
    }
  },
  methods: {
    // 搜索
    toggleSearch() {
      this.$emit('update:showSearch', !this.showSearch)
    },
    // 刷新
    refresh() {
      this.$emit('queryTable')
    },
    // 右侧列表元素变化
    dataChange(data) {
      this.$emit('update:columns', (this.columns || []).map(column => ({
        ...column, visible: !data.includes(column.key)
      })))
    },
    // 打开显隐列dialog
    showColumn() {
      this.open = true
    }
  }
}
</script>
<style lang="css" scoped>
::v-deep .el-transfer__button {
  border-radius: 50%;
  padding: 12px;
  display: block;
  margin-left: 0px;
}
::v-deep .el-transfer__button:first-child {
  margin-bottom: 10px;
}
</style>
