<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import PageDialog from '@/components/page/PageDialog.vue'
import QuantityInput from '@/components/business/material/QuantityInput.vue'
import QuantityText from '@/components/business/production/QuantityText.vue'
import { normalizedQuantityInput } from '@/lib/production/quantityRules'
import { useAuth } from '@/stores/auth'
import { inputPermission } from '@/api/production/productionInput'
import { productionCombination as api, type Combination } from '@/api/production/productionCombination'
const props = defineProps<{ order: { id: string; productId: string; plannedQty: string; source: string; status: string }}>()
const auth = useAuth(), visible = ref(false), busy = ref(false), quantity = ref(''), valid = ref(false)
const error = ref(''), qrError = ref(''), suggested = ref(''), lookup = ref(''), detail = ref<Combination | null>(null)
const qrUrl = ref(''), label = ref<HTMLElement | null>(null)
const allowed = computed(() => auth.hasPermission(inputPermission, 'factory') && props.order.source === 'LOCAL')
let sequence = 0
const printFrames = new Set<HTMLIFrameElement>()
function clearImage() { if (qrUrl.value) URL.revokeObjectURL(qrUrl.value);qrUrl.value = '' }
function reset() { sequence++;clearImage();detail.value = null;error.value = '';qrError.value = '';suggested.value = '';lookup.value = '';busy.value = false;visible.value = false;for (const frame of printFrames) frame.remove();printFrames.clear() }
watch(() => [auth.factoryId, auth.revision, auth.factoryPermissions.join('|'), auth.runtimeMode, props.order.id], reset, { flush: 'sync' })
watch(visible, value => { if (!value) { sequence++;clearImage();detail.value = null;busy.value = false } })
onBeforeUnmount(reset)
function open() { reset();quantity.value = props.order.plannedQty;visible.value = true }
async function image(ticket: number, code: string) {
  qrError.value = '';clearImage()
  try { const blob = await api.qr(code);if (ticket === sequence) qrUrl.value = URL.createObjectURL(blob) } catch(e) { if (ticket === sequence) qrError.value = e instanceof Error ? e.message : '二维码图像读取失败' }
}
async function generate() {
  if (!allowed.value || auth.runtimeMode !== 'LOCAL' || !valid.value || busy.value) return
  const ticket = ++sequence;busy.value = true;error.value = '';detail.value = null;clearImage()
  try { const data = await api.generate(props.order.id, normalizedQuantityInput(quantity.value));if (ticket !== sequence) return;detail.value = data.combination;suggested.value = data.suggestedQty;await image(ticket, data.combination.code) } catch(e) { if (ticket === sequence) error.value = e instanceof Error ? e.message : '组合生成失败' } finally { if (ticket === sequence) busy.value = false }
}
async function read() {
  if (!allowed.value || busy.value) return
  const ticket = ++sequence;busy.value = true;error.value = '';detail.value = null;suggested.value = '';clearImage()
  try { const data = await api.resolve(lookup.value);if (ticket !== sequence) return;if (data.workorderId !== props.order.id) throw new Error('该组合不属于当前工单');detail.value = data;await image(ticket, data.code) } catch(e) { if (ticket === sequence) error.value = e instanceof Error ? e.message : '组合读取失败' } finally { if (ticket === sequence) busy.value = false }
}
function print() {
  if (!label.value || !qrUrl.value || !allowed.value) return
  const frame = document.createElement('iframe');frame.title = '材料组合标签打印';frame.style.display = 'none';document.body.append(frame);printFrames.add(frame)
  const doc = frame.contentDocument, win = frame.contentWindow
  if (!doc || !win) { frame.remove();printFrames.delete(frame);return }
  const style = doc.createElement('style');style.textContent = 'body{font-family:sans-serif;padding:12mm}img{width:55mm;height:55mm}table{border-collapse:collapse}td,th{padding:6px;border:1px solid #ccc;text-align:left;overflow-wrap:anywhere}'
  doc.head.append(style);doc.body.append(label.value.cloneNode(true))
  const cleanup = () => { frame.remove();printFrames.delete(frame) }
  win.addEventListener('afterprint', cleanup, { once: true })
  const img = doc.querySelector('img')
  const launch = () => { if (frame.isConnected) { win.focus();win.print() } }
  if (img?.complete) launch();else img?.addEventListener('load', launch, { once: true })
  setTimeout(cleanup, 60000)
}
</script>
<template>
  <el-button v-if="allowed" link type="primary" @click="open">材料组合码</el-button>
  <PageDialog v-model="visible" title="材料批次组合二维码" width="760px">
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-form label-position="top"><el-form-item label="本次希望规划的产出数量"><QuantityInput v-model="quantity" :material-id="order.productId" required positive :disabled="busy" @validity="valid=$event" /></el-form-item></el-form>
    <el-button type="primary" :disabled="!valid || busy || auth.runtimeMode !== 'LOCAL' || !['DRAFT','RELEASED'].includes(order.status)" :loading="busy" @click="generate">计算并生成组合码</el-button>
    <p>每种材料只选一个可满足规划数量的批次；单批次不足时请补料或合并批次后重试。打印不占用库存。</p>
    <el-input v-model="lookup" placeholder="已有组合码，可查询并补印" aria-label="已有组合码" :disabled="busy" /><el-button :disabled="busy || !lookup" @click="read">查询已有组合</el-button>
    <el-alert v-if="qrError" :title="qrError" type="error" :closable="false"><el-button v-if="detail" @click="image(sequence, detail.code)">重试加载二维码</el-button></el-alert>
    <div v-if="detail" ref="label" class="combination-label">
      <h3>工单 {{ detail.workorderCode }}</h3><img v-if="qrUrl" :src="qrUrl" alt="材料组合二维码" width="220" height="220"><p>{{ detail.code }}</p>
      <p v-if="suggested">本次计算可配套 <QuantityText :value="suggested" /> 套；扫码数量以当时库存为准。</p>
      <p v-if="detail.closed">执行已结束，此码仅供追溯，不能再次领料。</p>
      <table><thead><tr><th>需求行</th><th>材料</th><th>固定原料批次</th></tr></thead><tbody><tr v-for="item in detail.items" :key="item.demandLineId"><td>{{ item.lineNo }}</td><td>{{ item.materialCode }}</td><td>{{ item.batches.map(batch => batch ?? '未分批').join('、') }}</td></tr></tbody></table>
    </div>
    <template #footer><el-button @click="visible=false">关闭</el-button><el-button type="primary" :disabled="!detail || !qrUrl || busy" @click="print">打印 / 补印</el-button></template>
  </PageDialog>
</template>

<style scoped>
.combination-label table { width: 100%; border-collapse: collapse; }
.combination-label th, .combination-label td { padding: var(--ui-space-2); border: 1px solid var(--ui-border); text-align: left; overflow-wrap: anywhere; }
</style>
