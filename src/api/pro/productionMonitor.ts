import request from '@/utils/request'
const base='/mes/pro/production-monitor'
export const getProductionMonitorSummary=(params:any)=>request({url:base+'/summary',method:'get',scope:'factory',params})
export const listProductionMonitorWorkorders=(params:any)=>request({url:base+'/workorders',method:'get',scope:'factory',params})
export const getProductionMonitorWorkorder=(workorderId:any)=>request({url:base+'/workorders/'+workorderId,scope:'factory'})
export const listProductionMonitorTimeline=(workorderId:any,params:any)=>request({url:base+'/workorders/'+workorderId+'/timeline',scope:'factory',params})
export const getProductionMonitorRouteTrack=(workorderId:any,xtransferNo:any,routeId:any)=>request({url:base+'/workorders/'+workorderId+'/flowcards/'+encodeURIComponent(xtransferNo)+'/routes/'+routeId,scope:'factory'})
