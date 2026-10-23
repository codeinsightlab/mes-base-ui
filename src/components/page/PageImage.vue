<script setup lang="ts">
import { computed, onBeforeUnmount, onDeactivated, ref, watch } from 'vue'
import { ElImage, ElImageViewer, imageEmits, imageProps } from 'element-plus'
import { usePageOverlayScope } from '@/lib/pageOverlay'

defineOptions({ inheritAttrs: false })
const props = defineProps(imageProps)
const emit = defineEmits(imageEmits)
const owner = usePageOverlayScope(), opened = ref(false)
const active = computed(() => owner?.active.value ?? true)
const visible = computed(() => active.value && opened.value && props.previewSrcList.length > 0)
const initialIndex = computed(() => props.initialIndex >= 0 && props.initialIndex < props.previewSrcList.length ? props.initialIndex : 0)
function close() {
  if (!opened.value) return
  opened.value = false
  emit('close')
}
function open() {
  if (!active.value || !props.previewSrcList.length || opened.value) return
  opened.value = true
  emit('show')
}
watch(active, value => { if (!value) close() }, { flush: 'sync' })
watch(() => props.previewSrcList.length, length => { if (!length) close() }, { flush: 'sync' })
const unregister = owner?.register({ forceClose: close })
onDeactivated(close)
onBeforeUnmount(() => { unregister?.(); close() })
defineExpose({ showPreview: open })
// Installed EP 2.14.7 ImageViewer has no lockScroll prop. It owns its native
// image-viewer lock; v-if really unmounts it on page exit so EP releases it after
// its 200ms cleanup. Do not add a second token or claim lock-scroll=false works.
</script>
<template>
  <ElImage v-bind="{ ...props, ...$attrs }" :preview-src-list="[]" @click="open" @load="emit('load', $event)" @error="emit('error', $event)">
    <template v-for="(_, name) in $slots" #[name]="slotProps"><slot :name="name" v-bind="slotProps ?? {}" /></template>
  </ElImage>
  <ElImageViewer
    v-if="visible"
    :url-list="previewSrcList"
    :initial-index="initialIndex"
    teleported
    :z-index="zIndex"
    :infinite="infinite"
    :hide-on-click-modal="hideOnClickModal"
    :close-on-press-escape="closeOnPressEscape"
    :zoom-rate="zoomRate"
    :scale="scale"
    :min-scale="minScale"
    :max-scale="maxScale"
    :show-progress="showProgress"
    :crossorigin="crossorigin"
    @close="close"
    @switch="emit('switch', $event)"
  >
    <template v-if="$slots.toolbar" #toolbar="data"><slot name="toolbar" v-bind="data" /></template>
    <template v-if="$slots.progress" #progress="data"><slot name="progress" v-bind="data" /></template>
    <template v-if="$slots['viewer-error']" #viewer-error="data"><slot name="viewer-error" v-bind="data" /></template>
    <slot name="viewer" />
  </ElImageViewer>
</template>
