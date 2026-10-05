import request from '@/utils/request'
import { parseStrEmpty } from "@/utils/ruoyi";

// 查询用户列表
export function listUser(query: any) {
  return request({
    scope: 'platform', url: '/system/user/list',
    method: 'get',
    params: query
  })
}

// 查询用户详细
export function getUser(userId: any) {
  return request({
    scope: 'platform', url: '/system/user/' + parseStrEmpty(userId),
    method: 'get'
  })
}

// 新增用户
export function addUser(data: any) {
  return request({
    scope: 'platform', url: '/system/user',
    method: 'post',
    data: data
  })
}

// 修改用户
export function updateUser(data: any) {
  return request({
    scope: 'platform', url: '/system/user',
    method: 'put',
    data: data
  })
}

// 删除用户
export function delUser(userId: any) {
  return request({
    scope: 'platform', url: '/system/user/' + userId,
    method: 'delete'
  })
}

// 用户密码重置
export function resetUserPwd(userId: any, password: any) {
  const data = {
    userId,
    password
  }
  return request({
    scope: 'platform', url: '/system/user/resetPwd',
    method: 'put',
    data: data
  })
}

// 用户状态修改
export function changeUserStatus(userId: any, status: any) {
  const data = {
    userId,
    status
  }
  return request({
    scope: 'platform', url: '/system/user/changeStatus',
    method: 'put',
    data: data
  })
}

// 查询用户个人信息
export function getUserProfile() {
  return request({
    scope: 'platform', url: '/system/user/profile',
    method: 'get'
  })
}

// 修改用户个人信息
export function updateUserProfile(data: any) {
  return request({
    scope: 'platform', url: '/system/user/profile',
    method: 'put',
    data: {nickName:data.nickName,phonenumber:data.phonenumber,email:data.email,sex:data.sex}
  })
}

// 用户密码重置
export function updateUserPwd(oldPassword: any, newPassword: any) {
  const data = {
    oldPassword,
    newPassword
  }
  return request({
    scope: 'platform', url: '/system/user/profile/updatePwd',
    method: 'put',
    data: data
  })
}

// 用户头像上传
export function uploadAvatar(data: any) {
  return request({
    scope: 'platform', url: '/system/user/profile/avatar',
    method: 'post',
    data: data
  })
}

// 查询授权角色
export function getAuthRole(userId: any) {
  return request({
    scope: 'platform', url: '/system/user/authRole/' + userId,
    method: 'get'
  })
}

// 保存授权角色
export function updateAuthRole(data: any) {
  return request({
    scope: 'platform', url: '/system/user/authRole',
    method: 'put',
    params: data
  })
}
