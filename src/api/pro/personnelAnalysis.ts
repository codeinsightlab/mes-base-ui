import request from '@/utils/request'

const base = '/mes/pro/personnel-analysis/accounts'

export const listPersonnelAccounts = (params:any) => request({ url: base, method: 'get', scope: 'factory', params })
export const getPersonnelOverview = (userId: any, params: any) => request({ url: `${base}/${userId}/overview`, method: 'get', scope: 'factory', params })
export const listPersonnelProcesses = (userId: any, params: any) => request({ url: `${base}/${userId}/processes`, method: 'get', scope: 'factory', params })
export const listPersonnelProducts = (userId: any, params: any) => request({ url: `${base}/${userId}/products`, method: 'get', scope: 'factory', params })
export const getPersonnelTrend = (userId: any, params: any) => request({ url: `${base}/${userId}/trend`, method: 'get', scope: 'factory', params })

export const listPersonnelRecords = (userId:any, params:any) => request({ url: `${base}/${userId}/records`, method: 'get', scope: 'factory', params })
