<script setup lang="ts">
import PageDrawer from '@/components/page/PageDrawer.vue'

import { ref, watch, onBeforeUnmount } from 'vue'
import { useAuth } from '@/stores/auth'
import { warehouseAcceptance as api, type AcceptanceFact } from '@/api/wm/warehouseAcceptance'
import { quantityColumn } from '@/lib/production/quantity'
const props = defineProps<{ receiptId: string }>(), auth = useAuth(), visible = ref(false), rows = ref<AcceptanceFact[]>([]), total = ref(0), offset = ref(0), error = ref(''), loading = ref(false)
let generation = 0
function clear() { generation++;visible.value = false;rows.value = [];total.value = offset.value = 0;error.value = '';loading.value = false }
watch(() => [props.receiptId, auth.factoryId, auth.revision, auth.factoryPermissions.join('|')], clear, { flush: 'sync' });onBeforeUnmount(clear)
async function load() { const g = ++generation;loading.value = true;error.value = '';try { const p = await api.history(props.receiptId, offset.value);if (g === generation) { rows.value = p.items;total.value = p.total } } catch(e) { if (g === generation)error.value = e instanceof Error ? e.message : '历史读取失败' } finally { if (g === generation)loading.value = false } }
function open() { clear();visible.value = true;void load() }
</script>
<template><el-button v-if="auth.hasPermission('business:wm:acceptance:read','factory')" link @click="open">历史入库记录</el-button><PageDrawer v-model="visible" title="旧流程入库历史（只读）" size="min(1000px,96vw)" append-to-body>
  <el-alert title="历史事实保留只读追溯。新收货统一使用入库单。" type="info" :closable="false" /><el-alert v-if="error" :title="error" type="error" :closable="false" />
  <el-table :data="rows" v-loading="loading"><el-table-column prop="id" label="流水UUID" min-width="260" /><el-table-column prop="quantityDelta" label="历史入库数量" :formatter="quantityColumn" /><el-table-column prop="stockActionId" label="库存动作" min-width="260" /><el-table-column prop="recordedAt" label="时间" min-width="190" /></el-table>
  <div class="table-toolbar"><el-button :disabled="offset===0||loading" @click="offset-=20;load()">上一页</el-button><span>{{ total }}条</span><el-button :disabled="offset+20>=total||loading" @click="offset+=20;load()">下一页</el-button></div></PageDrawer></template>
