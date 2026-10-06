<template>
  <div class="dict-tags">
    <span v-if="!options.length">{{ values.join('、') }}</span>
    <template v-for="(item, index) in options" :key="item.value">
      <template v-if="values.includes(item.value)">
        <StatusTag v-if="status" :label="item.label" :fallback="item.raw.listClass" :class="item.raw.cssClass" />
        <span
          v-else-if="item.raw.listClass == 'default' || item.raw.listClass == ''"

          :index="index"
          :class="item.raw.cssClass"
        >{{ item.label }}</span>
        <el-tag
          v-else
          :disable-transitions="true"

          :index="index"
          :type="item.raw.listClass == 'primary' ? '' : item.raw.listClass"
          :class="item.raw.cssClass"
        >
          {{ item.label }}
        </el-tag>
      </template>
    </template>
  </div>
</template>

<script>
export default {
  name: 'DictTag',
  props: {
    status: { type: Boolean, default: false },
    options: {
      type: Array,
      default: () => []
    },
    value: { type: [Number, String, Array], default: undefined }
  },
  computed: {
    values() {
      if (this.value !== null && typeof this.value !== 'undefined') {
        return Array.isArray(this.value) ? this.value : [String(this.value)]
      } else {
        return []
      }
    }
  }
}
</script>
<style scoped>
.el-tag + .el-tag {
  margin-left: 10px;
}
</style>
