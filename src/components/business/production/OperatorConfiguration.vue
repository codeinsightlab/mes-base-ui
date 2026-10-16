<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAuth } from '@/stores/auth'
import OperatorConfigurationPanel from './OperatorConfigurationPanel.vue'
const props = defineProps<{ operationId?: string; executionId?: string; contextLabel?: string; triggerLabel?: string }>()
const emit = defineEmits<{ changed: [] }>()
const auth = useAuth(), visible = ref(false)
const panel = ref<InstanceType<typeof OperatorConfigurationPanel> | null>(null)
const assignment = computed(() => Boolean(props.executionId))
const canRead = computed(() => auth.hasPermission((assignment.value ? 'business:mes:execution:assignment' : 'business:mes:operation:user') + ':list', 'factory'))
watch(() => [props.operationId, props.executionId, auth.factoryId, auth.revision, auth.factoryPermissions.join('|')], () => { visible.value = false }, { flush: 'sync' })
function beforeClose(done: () => void) { if (panel.value) void panel.value.beforeClose(done); else done() }
</script>
<template>
 <el-button v-if="canRead" text type="primary" @click="visible = true">{{ triggerLabel || (assignment ? '工序派工' : '可操作人员') }}</el-button>
 <el-dialog v-model="visible" :title="assignment ? '执行节点工序派工' : '工序能力配置'" width="min(880px, 94vw)" top="6vh" append-to-body destroy-on-close :before-close="beforeClose">
  <OperatorConfigurationPanel v-if="visible" ref="panel" v-bind="props" @changed="emit('changed')" />
 </el-dialog>
</template>
