// TEST ONLY: synthetic rows and in-memory writes. No backend or database requests.
export function createPersonMock() {
  let rows = Array.from({ length: 26 }, (_, index) => ({ id: String(9007199254740993n + BigInt(index)), name: ['张三', '李四', '王五', '赵六'][index % 4] + (index < 4 ? '' : ` ${index + 1}`) }))
  let nextId = 9007199254741020n
  let failNext = false
  return {
    fail() { failNext = true },
    reset() { rows = [] },
    async fetch(input: RequestInfo | URL, options: RequestInit = {}) {
      await new Promise(resolve => setTimeout(resolve, 150))
      if (failNext) { failNext = false;return new Response(JSON.stringify({ errorCode: 'MOCK_FAILURE', message: 'Mock 错误' }), { status: 503 }) }
      const url = new URL(String(input), 'http://fixture.local')
      if (!/^\/api\/acceptance\/person(?:\/[^/]+)?$/.test(url.pathname)) return new Response('{}', { status: 404 })
      const id = decodeURIComponent(url.pathname.split('/')[4] ?? '')
      const method = options.method ?? 'GET'
      const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' }})
      if (method === 'GET' && !id) {
        const filtered = rows.filter(row => row.name.includes(url.searchParams.get('name') ?? ''))
        const offset = Number(url.searchParams.get('offset') ?? 0), limit = Number(url.searchParams.get('limit') ?? 20)
        return json({ items: filtered.slice(offset, offset + limit), total: filtered.length, offset, limit })
      }
      if (method === 'GET') return rows.find(row => row.id === id) ? json(rows.find(row => row.id === id)) : json({}, 404)
      if (method === 'DELETE') { if (!rows.some(row => row.id === id)) return json({}, 404);rows = rows.filter(row => row.id !== id);return new Response(null, { status: 204 }) }
      const body = JSON.parse(String(options.body)) as { name?: string }
      if (!body.name?.trim() || body.name.length > 64) return json({}, 400)
      if (method === 'POST') { const row = { id: String(nextId++), name: body.name };rows.unshift(row);return json(row) }
      if (method === 'PUT') { const row = rows.find(row => row.id === id);if (!row) return json({}, 404);row.name = body.name;return json(row) }
      return json({}, 405)
    }
  }
}
