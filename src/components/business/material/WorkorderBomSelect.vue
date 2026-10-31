<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import BomVersionSelect from './BomVersionSelect.vue'
import { defaultBom } from '@/api/basic/materialBom'
import { useAuth } from '@/stores/auth'
const props = defineProps<{ modelValue: string | null; materialId: string; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [string | null] }>()
const auth = useAuth(), error = ref(''), loading = ref(false)
let generation = 0, pristine = true
function select(value: string | null) {
  generation++; pristine = false; loading.value = false; error.value = ''
  emit('update:modelValue', value)
}
async function loadDefault() {
  const current = ++generation, product = props.materialId
  if (!product || props.modelValue || !pristine || props.disabled) return
  loading.value = true; error.value = ''
  try {
    const value = await defaultBom(product)
    if (current !== generation || !pristine || props.modelValue || product !== props.materialId) return
    if (value && (value.productId !== product || value.status !== 'PUBLISHED')) throw new Error('默认BOM不属于当前产品或未发布')
    if (value) emit('update:modelValue', value.id)
  } catch(reason) { if (current === generation) error.value = reason instanceof Error ? reason.message : '默认BOM读取失败' } finally { if (current === generation) loading.value = false }
}
watch(() => props.materialId, () => {
  generation++; pristine = true; error.value = ''; loading.value = false
  void loadDefault()
}, { immediate: true, flush: 'post' })
watch(() => [auth.factoryId, auth.revision, auth.factoryPermissions.join('|')], () => { generation++; pristine = false; error.value = ''; loading.value = false }, { flush: 'sync' })
onBeforeUnmount(() => generation++)
</script>
<template>
  <div class="workorder-bom-select">
    <BomVersionSelect :model-value="modelValue" :material-id="materialId" :disabled="disabled" placeholder="选择该产品的已发布BOM版本" @update:model-value="select" />
    <span v-if="loading" class="help-block">正在读取产品默认BOM…</span>
    <span v-else-if="!modelValue && !error" class="help-block">没有已选版本时请人工选择；不会自动选择唯一、最新或第一条版本。</span>
    <el-alert v-if="error" :title="error" type="error" :closable="false"><el-button link @click="loadDefault">重试</el-button></el-alert>
  </div>
</template>

<style scoped>
.workorder-bom-select { width: 100%; min-width: 0; }
</style>
