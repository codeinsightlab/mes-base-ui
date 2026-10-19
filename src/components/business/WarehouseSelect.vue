<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { api, type WmWarehouseVo } from '@/api/wm/wmWarehouse'
import { useAuth } from '@/stores/auth'

const props = defineProps<{ modelValue?: string | null; disabled?: boolean; source?: 'LOCAL' | 'EXTERNAL' | null; history?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>()
const auth = useAuth()
const expectedSource = computed(() => props.history ? null : props.source ?? (auth.runtimeMode === 'LOCAL' ? 'LOCAL' : auth.runtimeMode === 'ERP' ? 'EXTERNAL' : null))
const allowed = computed(() => !!auth.factoryId && (props.history || !!expectedSource.value) && !auth.factorySwitching
  && auth.hasPermission('business:wm:warehouse:list', 'factory'))
const rows = ref<WmWarehouseVo[]>([])
const selected = ref<WmWarehouseVo | null>(null)
const loading = ref(false)
const error = ref('')
const keyword = ref('')
const total = ref(0)
let version = 0
let detailVersion = 0
const options = computed(() => selected.value && !rows.value.some(row => row.id === selected.value?.id)
  ? [selected.value, ...rows.value] : rows.value)
async function search(value: string, more = false) {
  if (!allowed.value) return
  const current = ++version
  keyword.value = value
  if (!more) rows.value = []
  loading.value = true
  error.value = ''
  try {
    const result = await api.list({ name: value, ...(expectedSource.value ? {source: expectedSource.value} : {}), offset: more ? rows.value.length : 0, limit: 20 })
    if (current !== version) return
    const matching = result.items.filter(row => (!expectedSource.value || row.source === expectedSource.value))
    rows.value = more ? [...rows.value, ...matching] : matching
    total.value = result.total
  } catch(reason) {
    if (current === version) error.value = reason instanceof Error ? reason.message : '仓库查询失败'
  } finally {
    if (current === version) loading.value = false
  }
}
async function hydrate() {
  const current = ++detailVersion
  selected.value = null
  if (!props.modelValue || !allowed.value) return
  const cached = rows.value.find(row => row.id === props.modelValue)
  if (cached) { selected.value = cached; return }
  if (!auth.hasPermission('business:wm:warehouse:query', 'factory')) return
  try {
    const row = await api.detail(props.modelValue)
    if (current === detailVersion) {
      if (expectedSource.value && row.source !== expectedSource.value) { error.value = '仓库来源与当前业务不一致'; emit('update:modelValue', null) }
      else selected.value = row
    }
  } catch(reason) {
    if (current === detailVersion) error.value = reason instanceof Error ? reason.message : '仓库回显失败'
  }
}
function clear() {
  version++
  detailVersion++
  rows.value = []
  selected.value = null
  loading.value = false
  error.value = ''
  total.value = 0
}
watch(() => [auth.factoryId, auth.revision, expectedSource.value, allowed.value], (_, previous) => {
  clear()
  if (previous && props.modelValue) emit('update:modelValue', null)
  if (allowed.value) { void search(''); void hydrate() }
}, { immediate: true })
watch(() => props.modelValue, hydrate)
onBeforeUnmount(clear)
</script>

<template>
  <div>
    <el-select
      :model-value="modelValue"
      clearable
      filterable
      remote
      :remote-method="search"
      :loading="loading"
      :disabled="!allowed || disabled"
      placeholder="搜索仓库名称"
      @update:model-value="!disabled && emit('update:modelValue', $event || null)"
    >
      <el-option v-for="row in options" :key="row.id" :label="`${row.code} · ${row.name} · ${row.source}`" :value="row.id" />
    </el-select>
    <el-button v-if="rows.length < total" link :disabled="loading || disabled" @click="search(keyword, true)">加载更多</el-button>
    <el-button :disabled="disabled" v-if="error" link type="danger" @click="search(keyword)">{{ error }}，重试</el-button>
  </div>
</template>
