import type { InjectionKey } from 'vue'

// Only a query form provides this capability; edit forms do not submit on confirm.
export const queryFormConfirmKey: InjectionKey<() => void> = Symbol('query-form-confirm')
