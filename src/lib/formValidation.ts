/** Check required text, selection, array, or identifier values without rejecting numeric zero. */
function hasRequiredValue(value: unknown): boolean {
  if (value == null) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return true
}

export function requiredFieldError(value: unknown, label: string, mode: 'input' | 'select' = 'input'): string | null {
  if (hasRequiredValue(value)) return null
  return `${mode === 'select' ? '请选择' : '请输入'}${label}`
}

export function textLengthError(value: string, label: string, limits: { min?: number; max?: number }): string | null {
  if (limits.min != null && value.length < limits.min) return `${label}不能少于${limits.min}个字符`
  if (limits.max != null && value.length > limits.max) return `${label}不能超过${limits.max}个字符`
  return null
}

/** Return the first failed check so forms can guide users one field at a time. */
export function firstValidationError(errors: readonly (string | null | undefined)[]): string | null {
  return errors.find((error): error is string => !!error) ?? null
}
