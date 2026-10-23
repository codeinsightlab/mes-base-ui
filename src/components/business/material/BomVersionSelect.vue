<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import { bomApi, type Bom } from '@/api/basic/materialBom'
import { useAuth } from '@/stores/auth'
const props = defineProps<{ modelValue?: string | null; materialId?: string | null; disabled?: boolean; placeholder?: string }>()
const emit = defineEmits<{ 'update:modelValue': [string | null] }>()
const auth = useAuth(), rows = ref<Bom[]>([]), total = ref(0), error = ref(''), loading = ref(false)
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
function clear() { generation++;rows.value = [];total.value = 0;error.value = '';loading.value = false }
watch(() => [props.materialId, auth.revision, auth.factoryPermissions.join('|')], () => { clear();void load() }, { immediate: true })
onBeforeUnmount(clear)
</script>
<template>
  <div class="bom-version-select">
    <el-select :model-value="modelValue" clearable :disabled="disabled || !materialId" :loading="loading" :placeholder="placeholder || '选择已发布子BOM；不选则为本层叶项'" @update:model-value="emit('update:modelValue',$event || null)">
      <el-option v-for="row in rows" :key="row.id" :label="`${row.code} · ${row.version}`" :value="row.id" />
    </el-select>
    <el-button v-if="rows.length<total" link :disabled="loading || disabled" @click="load(true)">加载更多版本</el-button>
    <el-button v-if="error" link type="danger" @click="load()">{{ error }}，重试</el-button>
  </div>
</template>

<style scoped>
.bom-version-select { width: 100%; min-width: 0; }
.bom-version-select :deep(.el-select) { width: 100%; }
</style>
