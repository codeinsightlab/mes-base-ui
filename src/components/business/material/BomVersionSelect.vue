<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { bomApi, type Bom } from '@/api/basic/materialBom'
import { useAuth } from '@/stores/auth'
const props = defineProps<{ modelValue?: string | null; materialId?: string | null; disabled?: boolean; placeholder?: string }>()
const emit = defineEmits<{ 'update:modelValue': [string | null]; selected: [Bom | null] }>()
const auth = useAuth(), rows = ref<Bom[]>([]), selectedRow = ref<Bom | null>(null), total = ref(0), error = ref(''), loading = ref(false)
const options = computed(() => {
  if (!selectedRow.value || rows.value.some(row => row.id === selectedRow.value?.id)) return rows.value
  return [selectedRow.value, ...rows.value]
})
let generation = 0
async function load(more = false) {
  if (!props.materialId || !auth.hasPermission('business:material:list', 'factory')) return
  const current = ++generation; loading.value = true; error.value = ''
  try {
    const page = await bomApi.list({ productId: props.materialId, status: 'PUBLISHED', offset: more ? rows.value.length : 0, limit: 20 })
    if (current !== generation) return
    rows.value = more ? [...rows.value, ...page.items as Bom[]] : page.items as Bom[];total.value = page.total
  } catch(e) { if (current === generation) error.value = e instanceof Error ? e.message : 'BOM版本读取失败' } finally { if (current === generation) loading.value = false }
}
async function loadSelected() {
  const selectedId = props.modelValue
  const materialId = props.materialId
  const current = generation
  if (!selectedId) {
    selectedRow.value = null
    return
  }
  if (!materialId || rows.value.some(row => row.id === selectedId)) {
    const row = rows.value.find(candidate => candidate.id === selectedId) ?? null
    selectedRow.value = row
    if (row) emit('selected', row)
    return
  }
  if (!auth.hasPermission('business:material:query', 'factory')) return
  try {
    const row = await bomApi.detail!(selectedId) as Bom
    if (current !== generation || selectedId !== props.modelValue || materialId !== props.materialId) return
    if (row.productId !== materialId || row.status !== 'PUBLISHED') {
      error.value = '已保存的BOM版本不属于当前产品或已不可用，请刷新工单核对'
      return
    }
    selectedRow.value = row
    emit('selected', row)
  } catch(e) {
    if (current === generation) error.value = e instanceof Error ? e.message : '已选BOM版本回显失败'
  }
}
function clear() { generation++;rows.value = [];selectedRow.value = null;total.value = 0;error.value = '';loading.value = false }
function select(id:string | null) {
  const value = id || null
  emit('update:modelValue', value)
  if (!value) { selectedRow.value = null;emit('selected', null);return }
  const row = options.value.find(candidate => candidate.id === value)
  if (row) { selectedRow.value = row;emit('selected', row) }
}
watch(() => [props.materialId, auth.revision, auth.factoryPermissions.join('|')], () => { clear();void load() }, { immediate: true })
watch(() => props.modelValue, () => { void loadSelected() }, { immediate: true })
watch(rows, () => { void loadSelected() })
onBeforeUnmount(clear)
</script>
<template>
  <div class="bom-version-select">
    <el-select :model-value="modelValue" clearable :disabled="disabled || !materialId" :loading="loading" :placeholder="placeholder || '选择已发布子BOM；不选则为本层叶项'" @update:model-value="select($event || null)">
      <el-option v-for="row in options" :key="row.id" :label="`${row.code} · ${row.version}${row.defaultVersion ? ' · 默认' : ''}`" :value="row.id" />
    </el-select>
    <el-button v-if="rows.length<total" link :disabled="loading || disabled" @click="load(true)">加载更多版本</el-button>
    <el-button v-if="error" link type="danger" @click="load()">{{ error }}，重试</el-button>
  </div>
</template>

<style scoped>
.bom-version-select { width: 100%; min-width: 0; }
.bom-version-select :deep(.el-select) { width: 100%; }
</style>
