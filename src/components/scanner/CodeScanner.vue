<script setup lang="ts">
import PageDialog from '@/components/page/PageDialog.vue'

import { onBeforeUnmount, ref, watch } from 'vue'
import { readQrImage } from './qrImage'
const props = withDefaults(defineProps<{
  modelValue?: string; buttonLabel?: string; placeholder?: string; disabled?: boolean
  contextKey?: string | number; link?: boolean
}>(), { modelValue: '', contextKey: '', buttonLabel: '扫码 / 输入', placeholder: '扫描、粘贴或人工输入码值' })
const emit = defineEmits<{ 'update:modelValue': [value: string]; confirm: [value: string, inputMethod: 'TEXT' | 'IMAGE'] }>()
const visible = ref(false), draft = ref(''), error = ref(''), decoding = ref(false), dragging = ref(false), recognized = ref(false)
const input = ref<{ focus: () => void }>(), fileInput = ref<HTMLInputElement>()
let sequence = 0
function invalidate() { recognized.value = false; sequence++; decoding.value = false; dragging.value = false; error.value = ''; draft.value = ''; if (fileInput.value) fileInput.value.value = '' }
function close() { visible.value = false; invalidate() }
function open() { if (props.disabled) return; invalidate(); draft.value = props.modelValue; visible.value = true }
watch(visible, value => { if (!value) invalidate() }, { flush: 'sync' })
watch(() => [props.contextKey, props.disabled], close, { flush: 'sync' })
onBeforeUnmount(invalidate)
async function recognize(files: File[]) {
  if (!visible.value || props.disabled) return
  const ticket = ++sequence
  decoding.value = false; error.value = ''; dragging.value = false; draft.value = ''; recognized.value = false
  if (files.length !== 1) { error.value = '请每次选择一张二维码图片'; return }
  decoding.value = true
  try {
    const value = await readQrImage(files[0]!)
    if (ticket !== sequence || !visible.value || props.disabled) return
    if (value.length > 2048) throw new Error('二维码内容超过 2048 字符，请确认图片')
    draft.value = value
    recognized.value = true
  } catch(failure) {
    if (ticket === sequence) error.value = failure instanceof Error ? failure.message : '识别失败，请人工输入码值'
  } finally { if (ticket === sequence) decoding.value = false }
}
function drop(event: DragEvent) { void recognize(Array.from(event.dataTransfer?.files ?? [])) }
function selectFile(event: Event) {
  const target = event.target as HTMLInputElement
  const files = Array.from(target.files ?? []); target.value = ''
  if (files.length) void recognize(files)
}
function confirm() {
  if (props.disabled || decoding.value || !draft.value.trim()) return
  const value = draft.value
  if (value.length > 2048) { error.value = '码值不能超过 2048 字符'; return }
  emit('update:modelValue', value); emit('confirm', value, recognized.value ? 'IMAGE' : 'TEXT'); close()
}
</script>
<template>
  <el-button :link="link" :disabled="disabled" @click="open">{{ buttonLabel }}</el-button>
  <PageDialog v-model="visible" title="扫码 / 录入码值" width="min(560px, 94vw)" append-to-body @opened="input?.focus()">
    <el-form @submit.prevent="confirm">
      <el-form-item label="码值"><el-input ref="input" v-model="draft" :placeholder="placeholder" aria-label="扫码码值" maxlength="2048" :disabled="decoding" clearable @input="recognized = false" /></el-form-item>
      <div
        class="scan-drop"
        :class="{ dragging }"
        role="button"
        tabindex="0"
        aria-label="选择或拖拽二维码图片"
        @click="fileInput?.click()"
        @keydown.enter.prevent="fileInput?.click()"
        @keydown.space.prevent="fileInput?.click()"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent.stop="drop"
      >
        <strong>{{ decoding ? '正在识别二维码…' : '拖拽二维码图片到这里，或点击选择图片' }}</strong>
        <p class="secondary">PNG / JPEG / WebP，最大 10 MB。图片仅在本机浏览器识别。</p>
      </div>
      <input ref="fileInput" type="file" accept="image/png,image/jpeg,image/webp" aria-label="二维码图片" hidden @change="selectFile">
      <el-alert v-if="recognized" title="二维码识别成功，请核对码值后确认" type="success" :closable="false" />
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <p class="secondary">请核对码值后确认；识别二维码不会自动提交业务操作。</p>
      <div class="scan-actions"><el-button @click="close">取消</el-button><el-button native-type="submit" type="primary" :disabled="disabled || decoding || !draft.trim()">使用此码值</el-button></div>
    </el-form>
  </PageDialog>
</template>
<style scoped>
.scan-drop { border: 1px dashed var(--ui-border); border-radius: var(--ui-radius, 6px); padding: var(--ui-space-4); cursor: pointer; text-align: center; }
.scan-drop.dragging, .scan-drop:focus-visible { border-color: var(--mes-primary); outline: 2px solid var(--mes-primary); }
.scan-actions { display: flex; justify-content: flex-end; gap: var(--ui-space-2); margin-top: var(--ui-space-4); }
</style>
