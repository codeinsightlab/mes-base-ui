import { beforeEach, expect, it, vi } from 'vitest'

const request = vi.hoisted(() => vi.fn())
vi.mock('../src/lib/request', () => ({ request }))

import { productionInput } from '../src/api/production/productionInput'

beforeEach(() => request.mockReset())

it('loads numbering rules only for the fixed STOCK_OUT category in the current factory scope', async() => {
  await productionInput.numberingRules()
  expect(request).toHaveBeenCalledExactlyOnceWith('/api/wm/stock-documents/numbering-rules', {
    query: { type: 'STOCK_OUT' }, scope: 'factory'
  })
})

it('keeps the selected rule code in a production input command request snapshot', async() => {
  const command = { requestId: 'request-1', ruleCode: 'OUT_RULE' }
  await productionInput.draft(command as never)
  expect(request).toHaveBeenCalledExactlyOnceWith('/api/production/input/drafts', {
    method: 'POST', body: command, scope: 'factory'
  })
})
