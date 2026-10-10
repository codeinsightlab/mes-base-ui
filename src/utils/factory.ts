import { useAuth } from '@/stores/auth'

export async function refreshFactory() {
  await useAuth().restoreFactory()
}
