<script setup lang="ts">
import PageDialog from '@/components/page/PageDialog.vue'

import { ref } from 'vue'
import type { useTableColumns } from '@/lib/useTableColumns'
const props = defineProps<{ controller: ReturnType<typeof useTableColumns> }>()
const dragging = ref('')
function start(key: string, event: DragEvent) {
  dragging.value = key
  event.dataTransfer?.setData('text/plain', key)
}
function drop(key: string) { props.controller.move(dragging.value, key); dragging.value = '' }
</script>
<template>
  <el-button :disabled="!controller.available.value || controller.state.loading" @click="controller.edit">列配置</el-button>
  <PageDialog
    :model-value="controller.state.open"
    title="个人列配置"
    width="min(520px,92vw)"
    :close-on-click-modal="!controller.state.busy"
    :close-on-press-escape="!controller.state.busy"
    :show-close="!controller.state.busy"
    @update:model-value="controller.cancel"
  >
    <p class="secondary">勾选显示列，拖动调整顺序。选择框和操作列保持固定。</p>
    <el-alert v-if="controller.state.error" :title="controller.state.error" type="error" :closable="false" />
    <ul class="column-settings-list">
      <li
        v-for="(column, index) in controller.state.draft"
        :key="column.key"
        :data-column-key="column.key"
        :draggable="!controller.state.busy && column.columnMovable !== false && !column.columnFixed"
        @dragstart="start(column.key, $event)"
        @dragover.prevent
        @drop.prevent="drop(column.key)"
      >
        <span aria-hidden="true">⋮⋮</span>
        <el-checkbox v-model="column.visible" :disabled="controller.state.busy || column.columnHideable === false || !!column.columnFixed">
          {{ column.label }}
        </el-checkbox>
        <el-button
          text
          :aria-label="'上移'+column.label"
          :disabled="controller.state.busy || !index || column.columnMovable === false || !!column.columnFixed"
          @click="controller.move(column.key, controller.state.draft[index - 1]!.key)"
        >上移</el-button>
      </li>
    </ul>
    <template #footer>
      <el-button :disabled="controller.state.busy" @click="controller.reset">恢复默认</el-button>
      <el-button :disabled="controller.state.busy" @click="controller.cancel">取消</el-button>
      <el-button type="primary" :loading="controller.state.busy" @click="controller.save">保存</el-button>
    </template>
  </PageDialog>
</template>
<style scoped>
.column-settings-list { padding: 0; list-style: none; }
.column-settings-list li { display: flex; align-items: center; gap: var(--mes-space-3, 12px); padding: var(--mes-space-2, 8px); border-bottom: 1px solid var(--mes-border); }
.column-settings-list .el-checkbox { flex: 1; }
</style>
