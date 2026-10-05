import request from '@/utils/request'

// 查询消息列表
export function listMessage(query: any) {
  return request({
    scope: 'platform', url: '/system/message/list',
    method: 'get',
    params: query
  })
}

// 查询消息详细
export function getMessage(messageId: any) {
  return request({
    scope: 'platform', url: '/system/message/' + messageId,
    method: 'get'
  })
}

// 新增消息
export function addMessage(data: any) {
  return request({
    scope: 'platform', url: '/system/message',
    method: 'post',
    data: data
  })
}

// 修改消息
export function updateMessage(data: any) {
  return request({
    scope: 'platform', url: '/system/message',
    method: 'put',
    data: data
  })
}

// 删除消息
export function delMessage(messageId: any) {
  return request({
    scope: 'platform', url: '/system/message/' + messageId,
    method: 'delete'
  })
}
