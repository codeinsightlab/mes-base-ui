/** Keep request identity in development diagnostics instead of exposing it in user-facing notices. */
export function logPendingRequest(context: string, requestId: string | null | undefined): void {
  if (!import.meta.env.DEV || !requestId) return
  console.debug('[MES pending request]', { context, requestId })
}
