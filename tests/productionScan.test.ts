import { beforeEach, expect, it, vi } from 'vitest'
import { readProductionIdentity } from '../src/api/production/productionIdentity'
import { productionReporting } from '../src/api/production/productionReporting'
import { scanExecution } from '../src/api/production/productionScan'
const request=vi.hoisted(()=>vi.fn())
vi.mock('../src/lib/request',()=>({request}))
beforeEach(()=>request.mockReset())

it.each(['EXECUTION_LOOKUP','REPORTING','DEFECT_DECLARATION'] as const)('uses one shared contract for %s without rewriting the code',async type=>{
 const identity={executionId:'9007199254740999',batchNo:'BATCH-001'}
 request.mockResolvedValueOnce(identity)
 expect(await scanExecution(type,' WO:PRODUCT#BATCH ','IMAGE')).toBe(identity)
 expect(request).toHaveBeenCalledExactlyOnceWith('/api/production/scan',{method:'POST',body:{type,code:' WO:PRODUCT#BATCH ',inputMethod:'IMAGE'},scope:'factory'})
})
it('defaults manually entered codes to TEXT without parsing or normalizing them',async()=>{
 await scanExecution('EXECUTION_LOOKUP','WO001:P001#9007199254740999')
 expect(request.mock.calls[0]![1].body).toEqual({type:'EXECUTION_LOOKUP',code:'WO001:P001#9007199254740999',inputMethod:'TEXT'})
})

it('reads a known execution by its ID path without performing a scan or synthesizing a code',async()=>{
 request.mockResolvedValueOnce({executionId:'9007199254740999',batchNo:null,qrCode:null})
 const identity=await readProductionIdentity('9007199254740999')
 expect(identity.qrCode).toBeNull()
 expect(request).toHaveBeenCalledExactlyOnceWith('/api/production/identity/9007199254740999',{scope:'factory'})
})
it('reads reporting context by exact executionId rather than a scan code',async()=>{
 await productionReporting.context('9007199254740999')
 expect(request).toHaveBeenCalledExactlyOnceWith('/api/production/reporting/context',{query:{executionId:'9007199254740999'},scope:'factory'})
})
it.each(['EXE:9007199254740999','MES1.old.identity.code','MES2.old.identity.code'])('propagates authoritative rejection of withdrawn format %s without a fallback lookup',async code=>{
 const failure=new Error('扫码格式应为工单号:品号#批次号');request.mockRejectedValueOnce(failure)
 await expect(scanExecution('EXECUTION_LOOKUP',code)).rejects.toBe(failure)
 expect(request).toHaveBeenCalledOnce()
})
