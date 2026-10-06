import request from '@/utils/request'

const root = '/system/open-api/clients'
export const listClients = (params: any) => request({ scope: 'platform', url: root, method: 'get', params })
export const getClient = (id: any) => request({ scope: 'platform', url: `${root}/${id}`, method: 'get' })
export const createClient = (data: any) => request({ scope: 'platform', url: root, method: 'post', data })
export const changeStatus = (data: any) => request({ scope: 'platform', url: `${root}/status`, method: 'put', data })
export const resetSecret = (clientId: any) => request({ scope: 'platform', url: `${root}/reset-secret`, method: 'post', data: { clientId }})
export const getApiCatalog = () => request({ scope: 'platform', url: `${root}/api-catalog`, method: 'get' })
export const getClientApis = (id: any) => request({ scope: 'platform', url: `${root}/${id}/apis`, method: 'get' })
export const replaceClientApis = (data: any) => request({ scope: 'platform', url: `${root}/apis`, method: 'put', data })

export const getDataScope = () => request({ scope: 'platform', url: `${root}/data-scope`, method: 'get' })
