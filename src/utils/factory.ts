import { useAuth } from '@/stores/auth'
import { request } from '@/lib/request'
export async function refreshFactory() { const auth = useAuth();auth.factories = await request('/api/foundation/factories', { scope: 'platform', query: { offset: 0, limit: 100 }});if (auth.factoryId && !auth.factories.some(f => f.factoryId === auth.factoryId)) await auth.selectFactory('') }
