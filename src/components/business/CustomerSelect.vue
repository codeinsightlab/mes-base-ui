<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { customerApi } from '@/api/sales/customer'
import type { Row } from '@/lib/crud'
import { useAuth } from '@/stores/auth'
const props = defineProps<{ modelValue?: string | null; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>()
const auth = useAuth(), rows = ref<Row[]>([]), selected = ref<Row|null>(null), loading = ref(false), error = ref(''), keyword = ref(''), total = ref(0)
const allowed = computed(() => !!auth.factoryId && !auth.factorySwitching && auth.hasPermission('business:mes:customer:list','factory'))
const options = computed(() => selected.value && !rows.value.some(row => row.id === selected.value?.id) ? [selected.value,...rows.value] : rows.value)
let generation = 0
async function search(value: string, more=false) { if (!allowed.value) return; const current=++generation;keyword.value=value;if(!more)rows.value=[];loading.value=true;error.value='';try { const page=await customerApi.list({name:value,offset:more?rows.value.length:0,limit:20});if(current===generation){rows.value=more?[...rows.value,...page.items]:page.items;total.value=page.total} } catch(e){if(current===generation)error.value=e instanceof Error?e.message:'客户查询失败'} finally{if(current===generation)loading.value=false} }
async function hydrate(){const current=++generation;selected.value=null;if(!props.modelValue||!allowed.value||!auth.hasPermission('business:mes:customer:query','factory'))return;const cached=rows.value.find(row=>row.id===props.modelValue);if(cached){selected.value=cached;return}try{const row=await customerApi.detail!(props.modelValue);if(current===generation)selected.value=row}catch(e){if(current===generation)error.value=e instanceof Error?e.message:'客户回显失败'}}
function clear(){generation++;rows.value=[];selected.value=null;loading.value=false;error.value='';total.value=0}
watch(()=>[auth.factoryId,auth.revision,allowed.value],(_,previous)=>{clear();if(previous&&props.modelValue)emit('update:modelValue',null);if(allowed.value){void search('');void hydrate()}},{immediate:true})
watch(()=>props.modelValue,hydrate);onBeforeUnmount(clear)
</script>
<template><div class="customer-select"><el-select :model-value="modelValue" clearable filterable remote :remote-method="search" :loading="loading" :disabled="!allowed||disabled" placeholder="搜索客户" @update:model-value="!disabled&&emit('update:modelValue',$event||null)"><el-option v-for="row in options" :key="String(row.id)" :label="`${row.code} · ${row.name}`" :value="String(row.id)" /></el-select><el-button v-if="rows.length<total" link :disabled="loading||disabled" @click="search(keyword,true)">加载更多</el-button><el-button v-if="error" link type="danger" :disabled="disabled" @click="search(keyword)">{{error}}，重试</el-button></div></template>
<style scoped>
.customer-select { display: flex; align-items: center; gap: 8px; width: 100%; min-width: 0; }
.customer-select :deep(.el-select) { flex: 1; min-width: 0; }
</style>
