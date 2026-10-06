import {reactive} from 'vue'
export interface WorkspaceTab {path:string; title:string}
export const workspaceTabs = reactive({items:[{path:'/',title:'概览'}] as WorkspaceTab[], refresh:0})
export function visitTab(path:string,title:string) {
  const existing=workspaceTabs.items.find(item=>item.path===path)
  if(existing)existing.title=title
  else workspaceTabs.items.push({path,title})
}
export function resetTabs() {workspaceTabs.items=[{path:'/',title:'概览'}];workspaceTabs.refresh++}
export function closeTabs(target:string,mode:'one'|'others'|'all',current:string) {
  const index=workspaceTabs.items.findIndex(item=>item.path===target)
  workspaceTabs.items=workspaceTabs.items.filter(item=>item.path==='/'||(mode==='one'?item.path!==target:mode==='others'?item.path===target:false))
  if(workspaceTabs.items.some(item=>item.path===current))return current
  return mode==='others'?target:workspaceTabs.items[Math.max(0,index-1)]?.path??'/'
}
