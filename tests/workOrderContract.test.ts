import { expect, it } from 'vitest'
import { saveBody, parseWorkOrderResponse, type Save } from '../src/api/production/workorder'
it('demand save does not require a batch and rejects deprecated batch payloads', () => {
  const demand: Save = { code: 'WO', productId: '9007199254740993', routingId: '2', plannedQty: '1000.000001', plannedStartAt: null, plannedEndAt: null, externalId: null, externalCode: null, remark: null }
  expect(saveBody(demand)).not.toHaveProperty('batches')
  expect(saveBody(demand).plannedQty).toBe('1000.000001')
  expect(() => saveBody({ ...demand, batches: [] } as Save)).toThrow('旧分批写入已停用')
})
it('sends the chosen WORK_ORDER rule only on create and never generates a number in the browser', () => {
  const demand: Save = { ruleCode: 'WO_RULE', productId: '1', routingId: '2', plannedQty: '10', plannedStartAt: null, plannedEndAt: null, externalId: null, externalCode: null, remark: null }
  expect(saveBody(demand, true)).toMatchObject({ ruleCode: 'WO_RULE' })
  expect(saveBody(demand)).not.toHaveProperty('ruleCode')
  expect(saveBody(demand, true)).not.toHaveProperty('code')
})
it('decodes quantities exactly while keeping count and revision numeric', () => {
  const value = parseWorkOrderResponse('{"plannedQty":99999999999999.999999,"revision":3,"total":7,"remark":"quantity text: \\"plannedQty\\":123","batches":[{"plannedQty":0.000001}]}') as { plannedQty: string; revision: number; total: number; remark: string; batches: { plannedQty: string }[] }
  expect(value.plannedQty).toBe('99999999999999.999999')
  expect(value.batches[0]?.plannedQty).toBe('0.000001')
  expect(value.revision).toBe(3)
  expect(value.total).toBe(7)
  expect(value.remark).toBe('quantity text: "plannedQty":123')
})
