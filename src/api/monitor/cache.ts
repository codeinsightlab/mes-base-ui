import request from '@/utils/request'

// 查询缓存详细
export function getCache() {
  return request({
    scope: 'platform', url: '/monitor/cache',
    method: 'get'
  })
}
