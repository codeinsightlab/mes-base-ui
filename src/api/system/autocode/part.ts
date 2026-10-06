import request from '@/utils/request'

// 查询规则组成
export function listPart(query: any) {
  return request({
    scope: 'platform', url: '/system/autocode/part/list',
    method: 'get',
    params: query
  })
}

// 查询规则组成详细
export function getPart(partId: any) {
  return request({
    scope: 'platform', url: '/system/autocode/part/' + partId,
    method: 'get'
  })
}

// 新增规则组成
export function addPart(data: any) {
  return request({
    scope: 'platform', url: '/system/autocode/part',
    method: 'post',
    data: data
  })
}

// 修改规则组成
export function updatePart(data: any) {
  return request({
    scope: 'platform', url: '/system/autocode/part',
    method: 'put',
    data: data
  })
}

// 删除规则组成
export function delPart(partIds: any) {
  return request({
    scope: 'platform', url: '/system/autocode/part/' + partIds,
    method: 'delete'
  })
}
