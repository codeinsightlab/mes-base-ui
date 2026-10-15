<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import { api, type RoutingOption } from '@/api/production/workorder'
import { useAuth } from '@/stores/auth'
const model = defineModel<string | null>()
const props = defineProps<{ workorderId?: string | null; disabled?: boolean }>()
const auth = useAuth(), options = ref<RoutingOption[]>([]), error = ref('')
let generation = 0
watch(() => [props.workorderId, auth.factoryId, auth.revision], async() => {
 const seq = ++generation; options.value = []; error.value = ''
 if(!props.workorderId) return
 try { const order = await api.detail(props.workorderId); const rows = await api.routings(order.workorder.productId); if(seq === generation) options.value = rows }
 catch(e) { if(seq === generation) error.value = e instanceof Error ? e.message : '工艺版本读取失败' }
}, { immediate: true })
onBeforeUnmount(() => { generation++ })
</script>
<template><el-select v-model="model" :disabled="disabled || !workorderId" placeholder="选择适用的已发布工艺版本"><el-option v-for="r in options" :key="r.id" :value="r.id" :label="r.code + ' · ' + r.name + ' · V' + r.version" /></el-select><p v-if="error">{{ error }}</p></template>
