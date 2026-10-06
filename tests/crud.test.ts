import { describe, it, expect, vi } from 'vitest'
import { commandFromDraft, formatValue } from '../src/lib/crud'
import { pageApi, pages } from '../src/lib/platform'
import { configureRequests } from '../src/lib/request'
describe('CRUD display and input contracts', () => {
  it('formats precision without floating-point conversion', () => { expect(formatValue('123456789012345678.1234', 'decimal')).toBe('123,456,789,012,345,678.1234');expect(formatValue(null, 'decimal')).toBe('—') })
  it('does not invent timestamp zone or unknown state meaning', () => { expect(formatValue('2026-10-05T10:00:00', 'datetime')).toBe('2026-10-05 10:00:00');expect(formatValue(7, 'number')).toBe('7') })
  it('whitelists fields and excludes factory, owner, hidden conditional fields', () => { const fields = [{ key: 'factoryId', label: 'Factory', kind: 'text', readonly: true }, { key: 'name', label: '名称', kind: 'text' }, { key: 'id', label: 'ID', kind: 'text' }, { key: 'factoryChoice', label: 'Scope', kind: 'text', showWhen: { key: 'kind', value: 'FACTORY' }}] as const;expect(commandFromDraft([...fields], { id: '1', name: 'hello', factoryId: 'A', userId: 'forged', factoryChoice: 'A', kind: 'PLATFORM' }, true, 'id')).toEqual({ name: 'hello' }) })
  it('user creation separates User DTO and Password DTO', async() => { configureRequests(() => ({ token: 'TEST', factoryId: '', revision: 0 }), () => {});const fetcher = vi.fn().mockResolvedValue(new Response('{}'));vi.stubGlobal('fetch', fetcher);await pageApi(pages.users!).create({ username: 'TEST', displayName: 'TEST ONLY', status: 'ENABLED', password: 'TEST ONLY secret', factoryId: 'forged' });const body = JSON.parse(fetcher.mock.calls[0]![1].body);expect(body).toEqual({ user: { username: 'TEST', displayName: 'TEST ONLY', status: 'ENABLED' }, credential: { password: 'TEST ONLY secret' }}) })
})
