import request from '@/utils/request'

// 查询岗位列表
export function listPost(query: any) {
  return request({
    scope: 'platform', url: '/system/post/list',
    method: 'get',
    params: query
  })
}

// 查询所有可用岗位,以列表方式返回
export function listAllPost() {
  return request({
    scope: 'platform', url: '/system/post/listAll',
    method: 'get'
  })
}

// 查询岗位详细
export function getPost(postId: any) {
  return request({
    scope: 'platform', url: '/system/post/' + postId,
    method: 'get'
  })
}

// 新增岗位
export function addPost(data: any) {
  return request({
    scope: 'platform', url: '/system/post',
    method: 'post',
    data: data
  })
}

// 修改岗位
export function updatePost(data: any) {
  return request({
    scope: 'platform', url: '/system/post',
    method: 'put',
    data: data
  })
}

// 删除岗位
export function delPost(postId: any) {
  return request({
    scope: 'platform', url: '/system/post/' + postId,
    method: 'delete'
  })
}
