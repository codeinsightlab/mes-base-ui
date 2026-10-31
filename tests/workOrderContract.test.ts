import { expect, it, vi } from 'vitest'
import { emptyMaterialDemand, materialDemandBody, materialDemandDraft, workorderMaterial } from '../src/api/production/workorderMaterial'
import { saveBody, parseWorkOrderResponse, type Save } from '../src/api/production/workorder'
const calls = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('../src/lib/request', () => ({ request: calls.request }))
it('demand save contains only current workorder fields and no batch collection', () => {
  const demand: Save = { code: 'WO', productId: '9007199254740993', routingId: '2', plannedQty: '1000.000001', plannedStartAt: null, plannedEndAt: null, externalId: null, externalCode: null, remark: null, material: emptyMaterialDemand() }
  expect(saveBody(demand)).not.toHaveProperty('batches')
  expect(saveBody(demand).plannedQty).toBe('1000.000001')
  expect(Object.keys(saveBody(demand))).not.toContain('batches')
})
it('sends the chosen WORK_ORDER rule only on create and never generates a number in the browser', () => {
  const demand: Save = { ruleCode: 'WO_RULE', productId: '1', routingId: '2', plannedQty: '10', plannedStartAt: null, plannedEndAt: null, externalId: null, externalCode: null, remark: null, material: emptyMaterialDemand() }
  expect(saveBody(demand, true)).toMatchObject({ ruleCode: 'WO_RULE' })
  expect(saveBody(demand)).not.toHaveProperty('ruleCode')
  expect(saveBody(demand, true)).not.toHaveProperty('code')
})
it('decodes quantities exactly while keeping count and revision numeric', () => {
  const value = parseWorkOrderResponse('{"plannedQty":99999999999999.999999,"revision":3,"total":7,"remark":"quantity text: \\"plannedQty\\":123"}') as { plannedQty: string; revision: number; total: number; remark: string }
  expect(value.plannedQty).toBe('99999999999999.999999')
  expect(value.revision).toBe(3)
  expect(value.total).toBe(7)
  expect(value.remark).toBe('quantity text: "plannedQty":123')
})

it('submits exact line quantities and excludes stock batches and client display fields', () => {
  const value = emptyMaterialDemand()
  value.items = [{ id: '9007199254740993', bomItemId: '7', materialId: '8', unitId: '9', totalRequiredQty: '99999999999999.999999', manuallyAdjusted: true, standardRequiredQty: '3', stockId: '10', batchNo: 'RAW' } as never]
  expect(materialDemandBody(value).items).toEqual([{ id: '9007199254740993', bomItemId: '7', materialId: '8', unitId: '9', totalRequiredQty: '99999999999999.999999', manuallyAdjusted: true }])
})
it('rejects an outdated material response as a local region error', async() => {
  calls.request.mockResolvedValue({ id: '1', totalRequiredQty: '3' })
  await expect(workorderMaterial.get('1')).rejects.toThrow('工单用料接口版本尚未更新')
})

it('preserves warehouse BIGINT identifiers in the stored configuration', () => {
  expect(materialDemandDraft({ workorderId: '1', bomId: null, bomRevision: null, frozenAt: null, warehouseIds: '[9007199254740993,"7"]', workCenter: '', revision: '1', status: 'ENABLED', updatedAt: null, items: [] }).warehouseIds).toEqual(['9007199254740993', '7'])
})
