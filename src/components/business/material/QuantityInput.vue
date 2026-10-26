<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useAuth } from '@/stores/auth'
import { loadQuantityRule, normalizedQuantityInput, positiveQuantity, quantityInputError, QUANTITY_RULE_TTL_MS, type QuantityRule } from '@/lib/production/quantityRules'
import { quantityRuleRevision } from '@/lib/production/quantityRuleInvalidation'

defineOptions({ inheritAttrs: false })
const props = defineProps<{ modelValue: string | number | null; materialId?: string | null; disabled?: boolean; positive?: boolean; required?: boolean; unchangedValue?: string | null; remainderValue?: string | null; historicalReduction?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string]; validity: [valid: boolean] }>()
const auth = useAuth()
const rule = ref<QuantityRule | null>(null)
const loading = ref(false)
const error = ref('')
const allowed = computed(() => !!auth.factoryId && !auth.factorySwitching
  && auth.hasPermission('business:material:query', 'factory')
  && auth.hasPermission('business:unit:measure:query', 'factory'))
const inputError = computed(() => {
  const value = props.modelValue == null ? '' : String(props.modelValue)
  if (value === '') return props.required ? '请输入数量' : null
  if (props.positive && !positiveQuantity(normalizedQuantityInput(value))) return '请输入正数量'
  // An unchanged stored fact may retain its precision when only metadata is edited.
  if (props.unchangedValue != null && normalizedQuantityInput(value) === normalizedQuantityInput(props.unchangedValue)) return null
  // Only the caller's trusted outstanding fact can be exhausted after a rule change.
  if (props.remainderValue != null && normalizedQuantityInput(value) === normalizedQuantityInput(props.remainderValue)) return quantityInputError(value, { mustBeWholeNumber: false, quantityPrecision: 6 })
  if (props.historicalReduction && value.startsWith('-')) return quantityInputError(value, { mustBeWholeNumber: false, quantityPrecision: 6 })
  return quantityInputError(value, rule.value)
})
const inputDisabled = computed(() => props.disabled || !props.materialId || !allowed.value || loading.value || !rule.value)
let generation = 0
let expiry: ReturnType<typeof setTimeout> | undefined

async function refreshRule() {
  const ticket = ++generation
  clearTimeout(expiry)
  loading.value = false
  rule.value = null
  error.value = ''
  if (!props.materialId || !auth.factoryId || auth.factorySwitching) return
  if (!allowed.value) {
    error.value = '没有读取物料单位规则的权限'
    return
  }
  loading.value = true
  const factoryId = auth.factoryId
  const revision = auth.revision
  try {
    const loaded = await loadQuantityRule(props.materialId, factoryId!, revision, () => factoryId === auth.factoryId && revision === auth.revision && allowed.value)
    if (ticket !== generation || factoryId !== auth.factoryId || revision !== auth.revision) return
    rule.value = loaded
    expiry = setTimeout(() => { void refreshRule() }, QUANTITY_RULE_TTL_MS)
  } catch (reason) {
    if (ticket === generation) error.value = reason instanceof Error ? reason.message : '单位规则读取失败'
  } finally {
    if (ticket === generation) loading.value = false
  }
}
function update(value: string) {
  emit('update:modelValue', value)
}
function normalize() {
  if (props.modelValue != null) emit('update:modelValue', normalizedQuantityInput(String(props.modelValue)))
}
watch(() => [props.materialId, auth.factoryId, auth.revision, allowed.value, quantityRuleRevision.value], () => {
  void refreshRule()
}, { immediate: true, flush: 'sync' })
watch([rule, inputError, allowed, loading], ([loadedRule, value, canRead, pending]) => emit('validity', canRead && !pending && loadedRule != null && value == null), { immediate: true, flush: 'sync' })
onBeforeUnmount(() => { generation++; clearTimeout(expiry); rule.value = null })
</script>

<template>
  <div class="quantity-input">
    <el-input
      :model-value="modelValue == null ? '' : String(modelValue)"
      v-bind="$attrs"
      inputmode="decimal"
      :disabled="inputDisabled"
      :placeholder="!materialId ? '先选择物料' : loading ? '读取单位规则…' : error ? '单位规则不可用' : `最多${rule?.mustBeWholeNumber ? 0 : rule?.quantityPrecision ?? 6}位小数`"
      @update:model-value="update"
      @blur="normalize"
    />
    <span v-if="error" class="quantity-input-error" role="alert">
      {{ error }} <button type="button" @click="refreshRule">重试</button>
    </span>
    <span v-else-if="inputError" class="quantity-input-error" role="alert">{{ inputError }}</span>
  </div>
</template>

<style scoped>
.quantity-input-error { display: block; margin-top: 4px; color: var(--el-color-danger); font-size: 12px; line-height: 1.4; }
.quantity-input-error button { margin-left: 4px; border: 0; padding: 0; color: inherit; background: transparent; text-decoration: underline; cursor: pointer; }
</style>
