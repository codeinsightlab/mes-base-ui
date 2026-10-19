import { onBeforeUnmount, ref, shallowRef } from 'vue'
import { ApiError } from '@/lib/request'
/** A frozen command survives unknown responses and drawer reopen. Scope changes invalidate all callbacks. */
export function useClosureCommand<T>(storageKey:()=>string){
 const pending=shallowRef<T|null>(null),busy=ref(false),error=ref('');let generation=0,uncertain=false
 function clear(){generation++;pending.value=null;busy.value=false;error.value='';uncertain=false}
 function restore(){const saved=sessionStorage.getItem(storageKey());if(!saved)return;try{pending.value=JSON.parse(saved) as T;uncertain=true}catch{error.value='原请求无法读取，请核对流水后处理'}}
 async function run(create:()=>T,execute:(c:T)=>Promise<unknown>,success:()=>Promise<void>){
  if(busy.value)return
  if(!pending.value){pending.value=JSON.parse(JSON.stringify(create())) as T;sessionStorage.setItem(storageKey(),JSON.stringify(pending.value))}
  const g=generation,key=storageKey(),command=pending.value;busy.value=true;error.value=''
  try{await execute(command);if(g!==generation)return;sessionStorage.removeItem(key);pending.value=null;uncertain=false;await success()}
  catch(e){if(g!==generation)return;error.value=e instanceof Error?e.message:'结果未知，请核实原请求';if(!uncertain&&e instanceof ApiError&&e.status>=400&&e.status<500){sessionStorage.removeItem(key);pending.value=null}else uncertain=true}
  finally{if(g===generation)busy.value=false}
 }
 onBeforeUnmount(clear)
 return {pending,busy,error,clear,restore,run}
}
