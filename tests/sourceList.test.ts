import {describe,it,expect} from 'vitest'
import {sourceList} from '../src/utils/sourceList'
import {passwordError} from '../src/utils/passwordPolicy'

describe('Source page query lifecycle',()=>{
  it('a slow old search cannot overwrite the latest rows or loading state',async()=>{
    const page={loading:false,queryError:'',rows:[] as string[]}
    let finishOld!:(value:string[])=>void
    const first=sourceList(page,()=>new Promise<string[]>(resolve=>{finishOld=resolve}),value=>{page.rows=value})
    await sourceList(page,()=>Promise.resolve(['current filter']),value=>{page.rows=value})
    finishOld(['old filter']);await first
    expect(page.rows).toEqual(['current filter']);expect(page.loading).toBe(false)
  })
  it('a failed query clears loading and a retry clears the visible error',async()=>{
    const page={loading:false,queryError:'',rows:[] as string[]}
    await sourceList(page,()=>Promise.reject(new Error('连接失败')),()=>{throw new Error('unexpected result')})
    expect(page.loading).toBe(false);expect(page.queryError).toBe('连接失败')
    await sourceList(page,()=>Promise.resolve(['retry result']),value=>{page.rows=value})
    expect(page.queryError).toBe('');expect(page.rows).toEqual(['retry result'])
  })
  it('rejects a UTF8 password whose character count fits but BCrypt bytes overflow',()=>{
    const policy={minLength:5,maxLength:128,maxBytes:72}
    expect(passwordError('厂'.repeat(24),policy)).toBeUndefined()
    expect(passwordError('厂'.repeat(25),policy)).toContain('72')
  })
})
