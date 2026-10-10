import { request } from '@/lib/request'

export type DirectoryResource = 'personnel' | 'departments' | 'posts'
export interface DirectoryOption {
  id: string
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
  departments: 'business:directory:department:read',
  posts: 'business:directory:post:read'
}
export function listDirectory(resource: DirectoryResource, keyword: string, offset = 0, departmentId?: string) {
  return request<DirectoryPage>('/api/business/directory/' + resource, {
    scope: 'factory', query: { keyword, offset, limit: 20, ...(departmentId ? { departmentId } : {}) }
  })
}
export function getDirectory(resource: DirectoryResource, id: string) {
  return request<DirectoryOption>('/api/business/directory/' + resource + '/' + encodeURIComponent(id), { scope: 'factory' })
}
