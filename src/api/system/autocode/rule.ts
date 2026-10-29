import request from '@/utils/request'

export type AutoCodeRuleType = 'WORK_ORDER' | 'STOCK_OUT' | 'STOCK_IN'
export interface AutoCodeRuleOption { ruleCode: string; ruleName: string; prefix: string }
export interface AutoCodeRule { ruleId: string; ruleCode: string; ruleType: AutoCodeRuleType | null; ruleName: string; factoryId: string | null; enableFlag: 'Y' | 'N'; maxLength: number }

export function previewCode(ruleCode: string, inputCharacter?: string | null) {
  return request({
    scope: 'platform', url: '/system/autocode/preview',
    method: 'post', data: { ruleCode, ...(inputCharacter == null ? {} : { inputCharacter }) }
  })
}

export function genCode(ruleCode: string, inputCharacter?: string | null) {
  return request({
    scope: 'platform', url: '/system/autocode/generate',
    method: 'post', data: { ruleCode, ...(inputCharacter == null ? {} : { inputCharacter }) }
  })
}

// 查询字典类型列表
export function listRule(query: any) {
  return request({
    scope: 'platform', url: '/system/autocode/rule/list',
    method: 'get',
    params: query
  })
}

// 查询字典类型详细
export function getRule(ruleId: any) {
  return request({
    scope: 'platform', url: '/system/autocode/rule/' + ruleId,
    method: 'get'
  })
}

export function getRuleDocument(ruleId: string) {
  return request({ scope: 'platform', url: '/system/autocode/rule/' + ruleId + '/document', method: 'get' })
}

// 一次创建规则及完整组成
export function addRule(data: any) {
  return request({
    scope: 'platform', url: '/system/autocode/rule',
    method: 'post',
    data: data
  })
}

// 一次修改规则及组成，携带读取时的版本
export function updateRule(data: any) {
  return request({
    scope: 'platform', url: '/system/autocode/rule',
    method: 'put',
    data: data
  })
}

// 删除字典类型
export function delRule(ruleId: any) {
  return request({
    scope: 'platform', url: '/system/autocode/rule/' + ruleId,
    method: 'delete'
  })
}
