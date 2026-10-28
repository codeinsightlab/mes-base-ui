import { beforeEach, expect, it, vi } from 'vitest'

const request = vi.hoisted(() => vi.fn())
vi.mock('../src/utils/request', () => ({ default: request }))

import { genCode, previewCode } from '../src/api/system/autocode/rule'

beforeEach(() => request.mockReset())

it('uses the rule code as the type and sends no client-generated date or serial values', async() => {
  await previewCode('SALES_ORDER')
  expect(request).toHaveBeenCalledExactlyOnceWith({
    scope: 'platform', url: '/system/autocode/preview', method: 'post', data: { ruleCode: 'SALES_ORDER' }
  })

  request.mockClear()
  await genCode('STOCK_RECEIPT')
  expect(request).toHaveBeenCalledExactlyOnceWith({
    scope: 'platform', url: '/system/autocode/generate', method: 'post', data: { ruleCode: 'STOCK_RECEIPT' }
  })
})

it('preserves the optional platform input-character value for preview and generation', async() => {
  await previewCode('PLATFORM_RULE', 'A7')
  expect(request).toHaveBeenCalledExactlyOnceWith({
    scope: 'platform', url: '/system/autocode/preview', method: 'post',
    data: { ruleCode: 'PLATFORM_RULE', inputCharacter: 'A7' }
  })

  request.mockClear()
  await genCode('PLATFORM_RULE', 'B8')
  expect(request).toHaveBeenCalledExactlyOnceWith({
    scope: 'platform', url: '/system/autocode/generate', method: 'post',
    data: { ruleCode: 'PLATFORM_RULE', inputCharacter: 'B8' }
  })
})
