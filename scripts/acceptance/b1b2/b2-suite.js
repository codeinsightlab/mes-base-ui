import {request,requestBlob,requestStream,configureRequests} from './request.js';
const out=document.querySelector('#out');let current,callbacks,results=[];
function reset(){current={token:'synthetic-a',factoryId:'SYNTHETIC_FACTORY',revision:1};callbacks={unauthorized:0,factory:0};configureRequests(()=>current,()=>callbacks.unauthorized++,()=>callbacks.factory++);}
async function test(id,query,kind='json',action=null,expect='NETWORK_ERROR',min=850,max=1800){
 reset();const controller=new AbortController();const t=performance.now();let timer;
 if(action)timer=setTimeout(()=>action(controller),action.delay??200);
 let actual;try{const fn=kind==='blob'?requestBlob:request;const v=await fn('/api/probe?'+new URLSearchParams({id,...query}),{timeoutMs:1000,signal:controller.signal});actual={code:'OK',undefined:v===undefined};}catch(e){actual={code:e.code,status:e.status,requestId:e.requestId};}finally{clearTimeout(timer)}
 const elapsed=Math.round(performance.now()-t);const pass=actual.code===expect&&elapsed>=min&&elapsed<=max&&(expect!=='NETWORK_ERROR'||actual.status===0&&actual.requestId==='probe-'+id)&&callbacks.unauthorized===0&&callbacks.factory===0;
 results.push({id,query,kind,expected:expect,elapsed,actual,callbacks,pass});out.textContent=JSON.stringify(results,null,2);
}
document.querySelector('#run').onclick=async()=>{
 document.querySelector('#run').disabled=true;
 await test('success-body-stall',{body:'3'});
 await test('error-body-stall',{body:'3',status:'403'});
 await test('blob-body-stall',{body:'3'},'blob');
 await test('shared-deadline',{head:'.65',body:'.65'});
 await test('before-deadline',{head:'.1',body:'.2'},'json',null,'OK',200,950);
 await test('empty',{empty:'1'},'json',null,'OK',0,950);
 await test('204',{status:'204'},'json',null,'OK',0,950);
 await test('cancel-body',{body:'3'},'json',c=>c.abort(),'NETWORK_ERROR',100,850);
 await test('interrupted-body',{body:'.2',cut:'1'},'json',null,'NETWORK_ERROR',100,950);
 for(const change of ['factory','login'])for(const status of ['200','401','422']){
  await test('late-'+change+'-'+status,{body:'.5',status,code:'FACTORY_SELECTION_REQUIRED'},'json',()=>{current={...current,revision:2,...(change==='factory'?{factoryId:'SYNTHETIC_OTHER'}:{token:'synthetic-b'})}},'CONTEXT_CHANGED',400,950);
 }
 reset();let t=performance.now(),ctrl=new AbortController(),sse;
 try{const response=await requestStream('/api/probe?id=sse-success&sse=1&body=3',{timeoutMs:1000,signal:ctrl.signal});const reader=response.body.getReader();const first=await reader.read();const event=new TextDecoder().decode(first.value);await new Promise(r=>setTimeout(r,1300));const alive=!ctrl.signal.aborted;ctrl.abort();let cancelled=false;try{await reader.read()}catch{cancelled=true}sse={id:'sse-success',elapsed:Math.round(performance.now()-t),alive,cancelled,event,pass:alive&&cancelled&&event.startsWith('data:')};}catch(e){sse={id:'sse-success',pass:false,error:e.code??e.name}}results.push(sse);
 reset();t=performance.now();let error;try{await requestStream('/api/probe?id=sse-error&status=403&sse=1&body=3',{timeoutMs:1000})}catch(e){error={code:e.code,status:e.status,requestId:e.requestId}}const elapsed=Math.round(performance.now()-t);results.push({id:'sse-error',elapsed,error,pass:error?.code==='NETWORK_ERROR'&&error?.status===0&&error?.requestId==='probe-sse-error'&&elapsed>=850&&elapsed<1800});
 out.textContent=JSON.stringify({completed:true,total:results.length,passed:results.filter(x=>x.pass).length,results},null,2);await fetch('/results',{method:'POST',body:out.textContent});
};
