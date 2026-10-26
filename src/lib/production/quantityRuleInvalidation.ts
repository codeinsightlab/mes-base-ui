import { ref } from 'vue'

/** Business writes invalidate both loaded inputs and future rule reads in this session. */
export const quantityRuleRevision = ref(0)

export function invalidateQuantityRules() {
  quantityRuleRevision.value++
}
