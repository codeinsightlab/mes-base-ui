export const SESSION_KEY = 'mes-base.session'
export interface SavedSession { token: string; expiresAt: string; factoryId: string }

export function removeSession() {
  try { localStorage.removeItem(SESSION_KEY) } catch { /* Storage may be unavailable; memory is still cleared. */ }
}
export function readSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (typeof value === 'object' && value !== null && 'token' in value && 'expiresAt' in value && 'factoryId' in value
      && typeof value.token === 'string' && value.token.length > 0 && value.token.length <= 1024
      && typeof value.expiresAt === 'string' && Date.parse(value.expiresAt) > Date.now()
      && typeof value.factoryId === 'string') {
      return { token: value.token, expiresAt: value.expiresAt, factoryId: value.factoryId }
    }
  } catch { /* Malformed or inaccessible saved state cannot authenticate a session. */ }
  removeSession()
  return null
}
export function saveSession(session: SavedSession) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ token: session.token, expiresAt: session.expiresAt, factoryId: session.factoryId }))
  } catch { throw new Error('浏览器无法保存登录态，请检查网站存储设置') }
}
