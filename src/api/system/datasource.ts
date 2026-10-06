import { request } from '@/lib/request'
import {ElMessage} from 'element-plus'
const call=async(url:string,method='GET',body?:unknown)=>{try{return await request<any>('/api/system/'+url,{method,body,scope:'platform'})}catch(e){ElMessage.error(e instanceof Error?e.message:'操作失败');throw e}}
export const listDatasources=(query={pageNum:1,pageSize:100})=>request<any>('/api/system/datasource',{scope:'platform',query})
export const getDatasource=(id:any)=>call(`datasource/${id}`)
export const createDatasource=(data:any)=>call('datasource','POST',data)
export const updateDatasource=(data:any)=>call('datasource','PUT',data)
export const enableDatasource=(id:any)=>call(`datasource/${id}/enable`,'POST')
export const disableDatasource=(id:any)=>call(`datasource/${id}/disable`,'POST')
export const deleteDatasource=(id:any)=>call(`datasource/${id}`,'DELETE')
export const downloadDatasourceDdl=(id:any)=>call(`datasource/${id}/ddl`)
export const refreshDatasourceDdl=(id:any)=>call(`datasource/${id}/ddl/refresh`,'POST')
export const listFactories=(query={pageNum:1,pageSize:100})=>request<any>('/api/system/factory',{scope:'platform',query})
export const createFactory=(data:any)=>call('factory','POST',data)
export const saveFactory=(data:any)=>call('factory','PUT',data)
export const deleteFactory=(id:any,revision:number)=>request<void>(`/api/system/factory/${id}`,{method:'DELETE',scope:'platform',query:{revision}})
