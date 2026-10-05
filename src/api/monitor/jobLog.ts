import request from '@/utils/request'

// 查询调度日志列表
export function listJobLog(query: any) {
  return request({
    scope: 'platform', url: '/monitor/jobLog/list',
    method: 'get',
    params: query
  })
}

// 删除调度日志
export function delJobLog(jobLogId: any) {
  return request({
    scope: 'platform', url: '/monitor/jobLog/' + jobLogId,
    method: 'delete'
  })
}

// 清空调度日志
export function cleanJobLog() {
  return request({
    scope: 'platform', url: '/monitor/jobLog/clean',
    method: 'delete'
  })
}
