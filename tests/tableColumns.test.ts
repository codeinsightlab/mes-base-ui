import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { defineComponent, reactive, h, KeepAlive } from 'vue'
import ElementPlus from 'element-plus'
import CrudPage from '../src/components/CrudPage.vue'
import ColumnSettings from '../src/components/ColumnSettings.vue'
import { useAuth } from '../src/stores/auth'
import { configureRequests } from '../src/lib/request'
import { mergeColumns, normalizeTableUrl, tableRouteUrl } from '../src/lib/tableColumns'
import { useTableColumns } from '../src/lib/useTableColumns'
import type { Field } from '../src/lib/crud'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { createRouter, createMemoryHistory, RouterView, useRoute } from 'vue-router'

const fields: Field[] = [{ key: 'id', label: '编号', kind: 'text', columnHideable: false, columnMovable: false },
  { key: 'code', label: '编码', kind: 'text' }, { key: 'name', label: '名称', kind: 'text' }]
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); configureRequests(() => ({ token: '', factoryId: '', revision: 0 }), () => {}) })
function login() {
  const pinia = createPinia(), auth = useAuth(pinia)
  auth.$patch({ token: 'TEST_ONLY_U1', username: 'U1', factoryId: 'A', factoryPermissions: ['test:read', 'test:update', 'test:delete'] })
  configureRequests(() => ({ token: auth.token, factoryId: auth.factoryId, revision: auth.revision }), () => {})
  return { pinia, auth }
}
function json(value: unknown) { return new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' }}) }
function host() {
  const { pinia, auth } = login()
  const route = reactive({ url: '/list', key: 'test:list' })
  let controller!: ReturnType<typeof useTableColumns<Field>>
  const wrapper = mount(defineComponent({ setup() { controller = useTableColumns(() => fields, () => route.key, () => route.url); return () => null } }), { global: { plugins: [pinia] }})
  return { wrapper, auth, route, get controller() { return controller } }
}

describe('column identity and merge', () => {
  it('normalizes hash/history URLs and prefers stable route templates', () => {
    expect(normalizeTableUrl('https://example.test/#/material/material?offset=99')).toBe('/material/material')
    expect(normalizeTableUrl('https://example.test/material/material/?offset=20#anchor')).toBe('/material/material')
    expect(tableRouteUrl({ path: '/orders/7', matched: [{ path: '/orders/:id' }] } as RouteLocationNormalizedLoaded)).toBe('/orders/:id')
  })
  it('ignores removed, unknown and duplicate keys, appends new fields and preserves rendering metadata', () => {
    const defaults = [...fields, { key: 'status', label: '状态', kind: 'select', columnVisible: false,
      options: [{ label: '启用', value: 'ENABLED' }] } as Field]
    const result = mergeColumns(defaults, [{ key: 'deleted', visible: true }, { key: 'name', visible: true },
      { key: 'code', visible: false }, { key: 'name', visible: false }, { key: 'id', visible: false }])
    expect(result.map(column => column.key)).toEqual(['id', 'name', 'code', 'status'])
    expect(result[0]!.visible).toBe(true)
    expect(result[1]!.visible).toBe(true)
    expect(result[3]!.options).toEqual(defaults[3]!.options)
    expect(result[3]!.visible).toBe(false)
  })
  it('preserves fixed positions and prevents empty tables from invalid old configurations', () => {
    const result = mergeColumns([{ key: 'left', label: '固定', columnFixed: 'left' }, ...fields,
      { key: 'right', label: '操作', columnFixed: 'right' }], fields.map(column => ({ key: column.key, visible: false })))
    expect(result.at(0)!.key).toBe('left'); expect(result.at(-1)!.key).toBe('right')
    expect(result.at(0)!.visible).toBe(true); expect(result.at(-1)!.visible).toBe(true)
    expect(mergeColumns([{ key: 'code', label: '编码' }], [{ key: 'code', visible: false }])[0]!.visible).toBe(true)
  })
})

describe('personal column lifecycle', () => {
  it('loads only the active cached page with its own URL and table key', async() => {
    const { pinia, auth } = login()
    const requests: Array<{ url: string | null; tableKey: string | null; factory: string | null }> = []
    let finishFirst!: (response: Response) => void
    vi.stubGlobal('fetch', vi.fn().mockImplementation((path, options) => {
      const query = new URL(path, 'http://localhost').searchParams
      requests.push({ url: query.get('url'), tableKey: query.get('tableKey'), factory: options.headers.get('X-Factory-Id') })
      if (requests.length === 1) return new Promise<Response>(resolve => { finishFirst = resolve })
      return Promise.resolve(json({ columns: [{ key: 'code', visible: false }] }))
    }))
    const controllers = new Map<string, ReturnType<typeof useTableColumns<Field>>>()
    const page = (key: string) => defineComponent({ setup() {
      const route = useRoute()
      controllers.set(key, useTableColumns(() => fields, () => key, () => tableRouteUrl(route)))
      return () => h('div', key)
    } })
    const router = createRouter({ history: createMemoryHistory(), routes: [
      { path: '/one', component: page('one:list') }, { path: '/two', component: page('two:list') },
      { path: '/other', component: defineComponent({ render: () => h('div', 'other') }) }
    ] })
    await router.push('/one'); await router.isReady()
    const wrapper = mount(defineComponent({ setup: () => () => h(RouterView, {}, {
      default: ({ Component, route }: { Component: any; route: RouteLocationNormalizedLoaded }) =>
        h(KeepAlive, {}, { default: () => h(Component, { key: route.fullPath }) })
    }) }), { global: { plugins: [pinia, router] }})
    try {
      await flushPromises()
      expect(requests).toEqual([{ url: '/one', tableKey: 'one:list', factory: 'A' }])
      await router.push('/two'); await flushPromises()
      expect(requests).toHaveLength(2)
      expect(requests[1]).toEqual({ url: '/two', tableKey: 'two:list', factory: 'A' })
      expect(controllers.get('one:list')!.available.value).toBe(false)
      finishFirst(json({ columns: [{ key: 'name', visible: false }] })); await flushPromises()
      expect(controllers.get('one:list')!.state.saved).toBeNull()
      auth.factoryId = 'B'; auth.revision++; await flushPromises()
      expect(requests).toHaveLength(3)
      expect(requests[2]).toEqual({ url: '/two', tableKey: 'two:list', factory: 'B' })
      await router.push('/one'); await flushPromises()
      expect(requests).toHaveLength(4)
      expect(requests[3]).toEqual({ url: '/one', tableKey: 'one:list', factory: 'B' })
      await router.push('/one?search=test'); await flushPromises()
      expect(requests).toHaveLength(5)
      expect(requests[4]).toEqual({ url: '/one', tableKey: 'one:list', factory: 'B' })
      await router.push('/other'); await flushPromises()
      auth.factoryId = 'C'; auth.revision++; await flushPromises()
      expect(requests).toHaveLength(5)
    } finally { wrapper.unmount() }
  })
  it('loads defaults, uses independent drafts, persists refresh and resets by DELETE', async() => {
    let stored: unknown = null
    const fetch = vi.fn().mockImplementation(async(_path, options) => {
      if (options.method === 'PUT') { stored = JSON.parse(options.body).columns; return new Response(null, { status: 204 }) }
      if (options.method === 'DELETE') { stored = null; return new Response(null, { status: 204 }) }
      return json({ columns: stored })
    }); vi.stubGlobal('fetch', fetch)
    const page = host(); await flushPromises()
    expect(page.controller.columns.value.map(column => column.key)).toEqual(['id', 'code', 'name'])
    page.controller.edit(); page.controller.state.draft[1]!.visible = false; page.controller.move('name', 'code')
    page.controller.cancel()
    expect(page.controller.columns.value.map(column => column.key)).toEqual(['id', 'code', 'name'])
    page.controller.edit(); page.controller.state.draft[1]!.visible = false; page.controller.move('name', 'code')
    await page.controller.save()
    expect(page.controller.columns.value.map(column => column.key)).toEqual(['id', 'name'])
    const body = JSON.parse(fetch.mock.calls.find(call => call[1].method === 'PUT')![1].body)
    expect(body).toEqual({ url: '/list', tableKey: 'test:list', columns: [{ key: 'id', visible: true }, { key: 'name', visible: true }, { key: 'code', visible: false }] })
    page.wrapper.unmount()
    const fresh = host(); await flushPromises()
    expect(fresh.controller.columns.value.map(column => column.key)).toEqual(['id', 'name'])
    fresh.controller.edit(); await fresh.controller.reset()
    expect(stored).toBeNull(); expect(fresh.controller.columns.value.map(column => column.key)).toEqual(['id', 'code', 'name'])
    fresh.wrapper.unmount()
  })
  it('retains draft on save failure and falls back on read failure', async() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 503 })))
    const page = host(); await flushPromises()
    expect(page.controller.columns.value).toHaveLength(3); expect(page.controller.state.error).not.toBe('')
    page.controller.edit(); page.controller.state.draft[1]!.visible = false; await page.controller.save()
    expect(page.controller.state.open).toBe(true); expect(page.controller.state.draft[1]!.visible).toBe(false)
    expect(page.controller.columns.value).toHaveLength(3)
    page.wrapper.unmount()
  })
  it('rejects late scope responses and reloads user, URL and table identities', async() => {
    let resolveA!: (value: Response) => void
    const fetch = vi.fn().mockImplementation(async(_path, options) => options.headers.get('X-Factory-Id') === 'A'
      ? new Promise<Response>(resolve => { resolveA = resolve }) : json({ columns: [{ key: 'name', visible: false }] }))
    vi.stubGlobal('fetch', fetch)
    const page = host(); await flushPromises()
    page.auth.factoryId = 'B'; page.auth.revision++; await flushPromises()
    expect(page.controller.columns.value.map(column => column.key)).toEqual(['id', 'code'])
    resolveA(json({ columns: [{ key: 'code', visible: false }] })); await flushPromises()
    expect(page.controller.columns.value.map(column => column.key)).toEqual(['id', 'code'])
    page.auth.username = 'U2'; page.auth.token = 'TEST_ONLY_U2'; await flushPromises()
    page.route.url = '/other'; await flushPromises(); page.route.key = 'test:other'; await flushPromises()
    expect(fetch).toHaveBeenCalledTimes(5)
    page.wrapper.unmount()
  })
  it('applies configured columns to the actual shared table and retains operation columns', async() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ columns: [{ key: 'name', visible: true }, { key: 'code', visible: false }] })))
    const { pinia } = login()
    const api = { list: vi.fn().mockResolvedValue({ items: [{ id: '1', code: 'C', name: 'N' }], total: 1, offset: 0, limit: 20 }),
      detail: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), delids: vi.fn() }
    const wrapper = mount(CrudPage, { props: { title: '生成样例', permission: 'test', tableKey: 'test:list', api, fields },
      global: { plugins: [pinia, ElementPlus], stubs: { teleport: true, ElSelect: true, ElOption: true }}})
    try {
      await flushPromises()
      const headers = wrapper.findAll('.el-table__header-wrapper th').map(header => header.text())
      expect(headers).toContain('名称'); expect(headers).not.toContain('编码'); expect(headers).toContain('操作')
      expect(wrapper.findComponent(ColumnSettings).exists()).toBe(true)
      await wrapper.findAll('button').find(button => button.text() === '列配置')!.trigger('click'); await flushPromises()
      expect(wrapper.findAll('[data-column-key]')).toHaveLength(3)
      await wrapper.find('[data-column-key="name"]').trigger('dragstart', { dataTransfer: { setData() {} }})
      await wrapper.find('[data-column-key="code"]').trigger('drop'); await flushPromises()
      expect(api.list).toHaveBeenCalledWith({ offset: 0, limit: 20 })
    } finally { wrapper.unmount() }
  })
})
