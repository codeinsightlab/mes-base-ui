interface ListState { loading: boolean;queryError: string }
const versions = new WeakMap<object, number>()
/** Keep the Source page's newest query authoritative, including failure/loading state. */
export async function sourceList<T>(owner:ListState, load:() => Promise<T>, apply:(response:T) => void):Promise<void> {
  const version = (versions.get(owner) ?? 0) + 1;versions.set(owner, version)
  owner.loading = true;owner.queryError = ''
  try { const response = await load();if (versions.get(owner) === version)apply(response) } catch(error) { if (versions.get(owner) === version)owner.queryError = error instanceof Error ? error.message : '加载失败' } finally { if (versions.get(owner) === version)owner.loading = false }
}
