import { request as send } from '@/lib/request'
import { ElMessage } from 'element-plus'
export interface SourceRequest { url: string;method?: string;params?: Record<string, unknown>;data?: unknown;scope?: 'platform' | 'factory' }
export default async function request(options:SourceRequest):Promise<any> {
  const query:Record<string, string | number> = {};for (const [k, v] of Object.entries(options.params ?? {})) { if (v === undefined || v === null || v === '') continue;if (typeof v === 'object' && !Array.isArray(v)) { for (const [nested, value] of Object.entries(v)) if (value != null && value !== '')query[k + '[' + nested + ']'] = String(value) } else query[k] = String(v) }
  try { return await send('/api' + options.url, { method: options.method?.toUpperCase(), query, body: options.data, scope: options.scope ?? 'platform' }) } catch(e) { ElMessage.error(e instanceof Error ? e.message : '操作失败');throw e }
}
