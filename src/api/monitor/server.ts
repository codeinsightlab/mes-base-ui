import request from '@/utils/request'

// 获取服务信息
export function getServer() {
  return request({
    scope: 'platform', url: '/monitor/server',
    method: 'get'
  })
}
