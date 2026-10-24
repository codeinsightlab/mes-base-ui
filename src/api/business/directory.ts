import { request } from '@/lib/request'

export type DirectoryResource = 'personnel' | 'routings'
export interface DirectoryOption {
  id: string
  version?: number | null
  description?: string | null
  status?: string | null
  name: string
  code: string | null
  parentId: string | null
  departmentId: string | null
}
export interface DirectoryPage {
  items: DirectoryOption[]
  total: number
  offset: number
  limit: number
}
export const directoryPermissions: Record<DirectoryResource, string> = {
  personnel: 'business:directory:personnel:read',
  routings: 'routing:list'
}
export function listDirectory(resource: DirectoryResource, keyword: string, offset = 0, departmentId?: string) {
  return request<DirectoryPage>('/api/business/directory/' + resource, {
    scope: 'factory', query: { keyword, offset, limit: 20, ...(departmentId ? { departmentId } : {}) }
  })
}
export function getDirectory(resource: DirectoryResource, id: string) {
  return request<DirectoryOption>('/api/business/directory/' + resource + '/' + encodeURIComponent(id), { scope: 'factory' })
}
