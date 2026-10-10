<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { directoryPermissions, getDirectory, listDirectory } from '@/api/business/directory'
import type { DirectoryOption, DirectoryResource } from '@/api/business/directory'
import { useAuth } from '@/stores/auth'

const props = withDefaults(defineProps<{
  modelValue?: string | null
  resource: DirectoryResource
  placeholder?: string
  disabled?: boolean
  clearable?: boolean
  departmentId?: string
}>(), { modelValue: null, placeholder: '搜索并选择', disabled: false, clearable: true, departmentId: undefined })
const emit = defineEmits<{
  'update:modelValue': [value: string | null]
  change: [value: DirectoryOption | null]
}>()
const auth = useAuth()
const canRead = computed(() => !!auth.factoryId && !auth.factorySwitching
  && auth.hasPermission(directoryPermissions[props.resource], 'factory'))
const options = ref<DirectoryOption[]>([])
const selected = ref<DirectoryOption | null>(null)
const keyword = ref('')
const total = ref(0)
const offset = ref(0)
const loading = ref(false)
const error = ref('')
let listVersion = 0
let detailVersion = 0
const visibleOptions = computed(() => selected.value && !options.value.some(row => row.id === selected.value?.id)
  ? [selected.value, ...options.value] : options.value)
function choose(value: string | undefined) {
  const row = visibleOptions.value.find(item => item.id === value) ?? null
  selected.value = row
  emit('update:modelValue', row?.id ?? null)
  emit('change', row)
}
async function search(value: string, more = false) {
  if (!canRead.value) return
  const version = ++listVersion
  keyword.value = value
  if (!more) {
    options.value = []
    total.value = 0
    offset.value = 0
  }
  loading.value = true
  error.value = ''
  try {
    const page = await listDirectory(props.resource, value, more ? offset.value : 0, props.departmentId)
    if (version !== listVersion) return
    options.value = more ? [...options.value, ...page.items] : page.items
    total.value = page.total
    offset.value = page.offset + page.items.length
  } catch(reason) {
    if (version === listVersion) error.value = reason instanceof Error ? reason.message : '查询失败，请重试'
  } finally {
    if (version === listVersion) loading.value = false
  }
}
function opened(open: boolean) {
  if (open && !options.value.length) void search(keyword.value)
}
async function hydrate() {
  const version = ++detailVersion
  selected.value = null
  if (!canRead.value || !props.modelValue) return
  try {
    const row = await getDirectory(props.resource, props.modelValue)
    if (version === detailVersion) selected.value = row
  } catch(reason) {
    if (version === detailVersion) error.value = reason instanceof Error ? reason.message : '回显失败，请重试'
  }
}
function reset(clearSelection: boolean) {
  listVersion++
  detailVersion++
  options.value = []
  selected.value = null
  total.value = 0
  offset.value = 0
  keyword.value = ''
  loading.value = false
  error.value = ''
  if (clearSelection && props.modelValue) {
    emit('update:modelValue', null)
    emit('change', null)
  }
}
watch(() => [auth.revision, auth.factoryId, canRead.value, props.resource, props.departmentId], (_, old) => {
  reset(!!old)
  if (canRead.value) {
    void search('')
    if (!old) void hydrate()
  }
}, { immediate: true })
watch(() => props.modelValue, () => { void hydrate() })
onBeforeUnmount(() => reset(false))
</script>

<template>
  <div class="business-directory-select">
    <el-select
      :model-value="selected?.id"
      :disabled="disabled || !canRead"
      :clearable="clearable"
      no-data-text="暂无匹配结果"
      no-match-text="暂无匹配结果"
      loading-text="查询中"
      filterable
      remote
      :remote-method="search"
      :loading="loading"
      :placeholder="placeholder"
      @update:model-value="choose"
      @visible-change="opened"
    >
      <el-option
        v-for="row in visibleOptions"
        :key="row.id"
        :value="row.id"
        :label="row.code ? row.name + '（' + row.code + '）' : row.name"
      />
      <template #footer>
        <el-button v-if="offset < total" text :loading="loading" @click="search(keyword, true)">加载更多</el-button>
        <span v-else-if="!loading">共 {{ total }} 条</span>
      </template>
    </el-select>
    <small v-if="!canRead">{{ auth.factoryId ? '没有查询权限' : '请先选择工厂' }}</small>
    <div v-if="error" role="alert">
      <span>{{ error }}</span>
      <el-button text @click="search(keyword); hydrate()">重试</el-button>
    </div>
  </div>
</template>

<style scoped>
.business-directory-select { width: 100%; }
.business-directory-select :deep(.el-select) { width: 100%; }
small { color: var(--mes-text-secondary); }
[role="alert"] { color: var(--mes-status-danger); }
</style>
