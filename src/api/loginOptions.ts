import { request } from '@/lib/request'
import type { PasswordPolicy } from '@/utils/passwordPolicy'

export interface LoginOptions { captchaOnOff: boolean; registrationEnabled: boolean; passwordPolicy: PasswordPolicy; uuid?: string; img?: string }
export async function loadLoginOptions(): Promise<LoginOptions> {
  const options = await request<LoginOptions>('/api/login-options', { public: true, scope: 'platform' })
  if (!options.captchaOnOff) return options
  return { ...options, ...await request<LoginOptions>('/api/captchaImage', { public: true, scope: 'platform' }) }
}
