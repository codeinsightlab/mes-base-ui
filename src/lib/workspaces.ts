export interface WorkspaceAccess { platform: boolean; factoryIds: string[] }
export type WorkspaceKind = 'platform' | 'business' | 'personal'
export function availableWorkspaces(access: WorkspaceAccess | null) {
  const result: { value: WorkspaceKind; label: string }[] = []
  if (access?.factoryIds.length) result.push({ value: 'business', label: '业务工作台' })
  if (access?.platform) result.push({ value: 'platform', label: '平台工作台' })
  return result
}
export function defaultWorkspace(access: WorkspaceAccess | null): WorkspaceKind {
  return availableWorkspaces(access)[0]?.value ?? 'personal'
}
