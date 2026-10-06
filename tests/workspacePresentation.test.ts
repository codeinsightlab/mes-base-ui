import {beforeEach,describe,expect,it} from 'vitest'
import {closeTabs,resetTabs,visitTab,workspaceTabs} from '../src/lib/workspaceTabs'
import {statusTone} from '../src/lib/status'
beforeEach(resetTabs)
describe('workspace tabs',()=>{
  it('keeps query-specific routes and updates their title',()=>{visitTab('/system/config?from=menu','参数');visitTab('/system/config','参数设置');visitTab('/system/config?from=menu','参数入口');expect(workspaceTabs.items).toHaveLength(3);expect(workspaceTabs.items[1]?.title).toBe('参数入口')})
  it('closing the active page navigates to its neighbour and keeps overview pinned',()=>{visitTab('/a','A');visitTab('/b','B');expect(closeTabs('/b','one','/b')).toBe('/a');expect(closeTabs('/','one','/')).toBe('/');expect(workspaceTabs.items[0]?.path).toBe('/')})
  it('closing others preserves the target; closing all returns to overview',()=>{visitTab('/a','A');visitTab('/b','B');expect(closeTabs('/a','others','/b')).toBe('/a');expect(workspaceTabs.items.map(t=>t.path)).toEqual(['/','/a']);expect(closeTabs('/a','all','/a')).toBe('/');expect(workspaceTabs.items).toHaveLength(1)})
  it('scope reset clears all opened pages',()=>{visitTab('/system/user','用户');resetTabs();expect(workspaceTabs.items).toEqual([{path:'/',title:'概览'}])})
})
describe('status presentation',()=>{
  it('uses business labels instead of inferring the meaning of numeric codes',()=>{expect(statusTone('正常','success')).toBe('running');expect(statusTone('禁用','success')).toBe('disabled');expect(statusTone('成功','primary')).toBe('success');expect(statusTone('0')).toBe('disabled');expect(statusTone('1')).toBe('disabled')})
  it('expresses pending and unknown states as warning and failures as error',()=>{expect(statusTone('待处理')).toBe('warning');expect(statusTone('UNKNOWN')).toBe('warning');expect(statusTone('失败')).toBe('error');expect(statusTone('自定义状态','danger')).toBe('error')})
})
