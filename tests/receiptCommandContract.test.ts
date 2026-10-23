import { beforeEach, expect, it, vi } from 'vitest'
import { productionClosure } from '../src/api/production/productionClosure'
import { qualityTreatment } from '../src/api/quality/qualityTreatment'
import { executionStatusLabel } from '../src/lib/production/executionState'

const request=vi.hoisted(()=>vi.fn())
vi.mock('../src/lib/request',()=>({request}))
beforeEach(()=>request.mockReset())

it('retired completion and return commands cannot be sent through active API adapters',()=>{
 expect(()=>productionClosure.execute('1',{action:'complete',body:{requestId:'old',reason:'原请求'}} as any)).toThrow('手动完工已停用')
 expect(()=>qualityTreatment.dispose('d1',{requestId:'old',destination:'RETURN_NODE',warehouseId:null,quantity:'1',expectedRevision:1,reason:'原请求'} as any)).toThrow('不良只办理正式入仓')
 expect(request).not.toHaveBeenCalled()
})

it('keeps the historical end state distinct from full receipt in every shared execution label',()=>{
 expect(executionStatusLabel('FULLY_RECEIVED')).toBe('完全入库')
 expect(executionStatusLabel('COMPLETED')).toBe('历史已结束')
})

it('uses the dedicated receipt recheck endpoint without an old completion command or stock request',async()=>{
 request.mockResolvedValueOnce({receiptState:'PARTIAL',blockedReason:'存在未决领料'})
 const summary=await productionClosure.recheckReceipt('9007199254740999')
 expect(request).toHaveBeenCalledExactlyOnceWith('/api/production/executions/9007199254740999/actions/recheck-receipt',{method:'POST',scope:'factory'})
 expect(summary.blockedReason).toBe('存在未决领料')
})
